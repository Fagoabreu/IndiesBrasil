import database from "infra/database.js";
import { NotFoundError, ValidationError } from "infra/errors";
import { MAX_GAME_GENRES, MAX_GENRE_NAME_LENGTH, genreKey, normalizeGenreName, normalizeSelection } from "lib/gameGenres";

/**
 * Model: catálogo de gêneros de jogo (gênero › subgênero).
 *
 * Mesma forma de `profession` e `assetCategory`: a chave é o próprio nome, o
 * catálogo é editável pelo admin e um jogo pode ter vários gêneros.
 *
 * ## Duas diferenças que importam
 *
 *  1. **Hierarquia é dado** (`parent_name` auto-referência), não código — o pai
 *     é um gênero linkável, não um agrupamento visual.
 *  2. **Gênero em uso é desativado, não excluído**: `ON DELETE RESTRICT` nos
 *     vínculos + 400 com a contagem. Cascata apagaria a classificação de jogos
 *     existentes sem ninguém pedir.
 */

const COLUMNS = "name, parent_name, description, display_order, is_active, created_at, updated_at";

/** Quantos jogos usam cada gênero — o número que a tela de admin mostra. */
const USAGE_SELECT = `(SELECT count(*)::int FROM game_genre_links l WHERE l.genre_name = gg.name)`;

/** Todos os nós (plano), para normalizar seleção e validar escrita. */
async function findAllNodes({ includeInactive = false } = {}) {
  const result = await database.query({
    text: `SELECT ${COLUMNS.split(", ")
      .map((column) => `gg.${column}`)
      .join(", ")}, ${USAGE_SELECT} AS usage_count
           FROM game_genres gg
           WHERE ($1::boolean OR gg.is_active)
           ORDER BY gg.display_order, gg.name`,
    values: [includeInactive],
  });
  return result.rows;
}

/**
 * Catálogo em árvore, na ordem de exibição.
 *
 * A tela usa `<optgroup>` e o admin usa tabela indentada — as duas precisam dos
 * filhos aninhados, não de uma lista plana com `parent_name` solto.
 */
async function findTree({ includeInactive = false } = {}) {
  const nodes = await findAllNodes({ includeInactive });

  return nodes
    .filter((node) => !node.parent_name)
    .map((parent) => ({
      ...parent,
      children: nodes.filter((node) => node.parent_name === parent.name),
    }));
}

async function findByName(name) {
  const result = await database.query({
    text: `SELECT ${COLUMNS.split(", ")
      .map((column) => `gg.${column}`)
      .join(", ")}, ${USAGE_SELECT} AS usage_count
           FROM game_genres gg WHERE gg.name = $1`,
    values: [name],
  });
  return result.rows[0] ?? null;
}

/**
 * Busca tolerante (sem acento, sem caixa) — usada por sugestão e por escrita.
 *
 * A coluna é texto, então `"Fighting Game"` e `"fighting game"` viram duas linhas
 * se a comparação for `=`. A comparação em JS sobre o catálogo inteiro é viável
 * porque a lista tem dezenas de linhas, não milhares.
 */
async function findByKey(value) {
  const key = genreKey(value);
  if (!key) return null;

  const result = await database.query({ text: "SELECT name FROM game_genres" });
  const match = result.rows.find((row) => genreKey(row.name) === key);
  return match ? findByName(match.name) : null;
}

async function create({ name, parent_name, description, display_order = 0 }) {
  const normalizedName = normalizeName(name);
  const parentName = normalizeParent(parent_name);

  // A mensagem usa o nome **do catálogo**, não o que foi digitado: "acao" já
  // existe como "Ação", e apontar a grafia certa é o que faz a pessoa achar a
  // opção no seletor em vez de tentar cadastrar de novo.
  const duplicate = await findByKey(normalizedName);

  if (duplicate) {
    throw new ValidationError({
      message: `O gênero "${duplicate.name}" já está no catálogo.`,
      action: "Escolha-o no seletor em vez de cadastrar de novo.",
    });
  }

  if (parentName) {
    const parent = await findByName(parentName);
    if (!parent) {
      throw new ValidationError({
        message: `O gênero pai "${parentName}" não existe no catálogo.`,
        action: "Cadastre o gênero pai primeiro, ou deixe o campo vazio para um gênero de primeiro nível.",
      });
    }
    if (parent.parent_name) {
      throw new ValidationError({
        message: `"${parentName}" já é um subgênero e não pode ter filhos.`,
        action: "A hierarquia tem dois níveis: gênero › subgênero.",
      });
    }
  }

  const result = await database.query({
    text: `INSERT INTO game_genres (name, parent_name, description, display_order)
           VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
    values: [normalizedName, parentName, normalizeDescription(description), normalizeOrder(display_order)],
  });

  return { ...result.rows[0], usage_count: 0 };
}

async function update(name, body = {}) {
  const existing = await findByName(name);
  if (!existing) {
    throw new NotFoundError({ message: "Gênero não encontrado." });
  }

  const fields = [];
  const values = [];
  let index = 1;

  if ("name" in body) {
    fields.push(`name = $${index++}`);
    values.push(normalizeName(body.name));
  }

  if ("parent_name" in body) {
    fields.push(`parent_name = $${index++}`);
    values.push(normalizeParent(body.parent_name));
  }

  if ("description" in body) {
    fields.push(`description = $${index++}`);
    values.push(normalizeDescription(body.description));
  }

  if ("display_order" in body) {
    fields.push(`display_order = $${index++}`);
    values.push(normalizeOrder(body.display_order));
  }

  if ("is_active" in body) {
    fields.push(`is_active = $${index++}`);
    values.push(Boolean(body.is_active));
  }

  if (fields.length === 0) {
    return existing;
  }

  fields.push("updated_at = now()");
  values.push(name);

  const result = await database.query({
    text: `UPDATE game_genres SET ${fields.join(", ")} WHERE name = $${index} RETURNING ${COLUMNS}`,
    values,
  });

  return { ...result.rows[0], usage_count: existing.usage_count };
}

/**
 * Exclui um gênero **sem uso**.
 *
 * Em uso, a resposta é 400 com a contagem: a alternativa (cascata) removeria a
 * classificação de jogos existentes sem ninguém ter pedido. Para aposentar um
 * gênero, desative-o.
 */
async function deleteGenre(name) {
  const existing = await findByName(name);

  if (!existing) {
    throw new NotFoundError({ message: "Gênero não encontrado." });
  }

  if (existing.usage_count > 0) {
    throw new ValidationError({
      message: `Este gênero está em uso por ${existing.usage_count} ${existing.usage_count === 1 ? "jogo" : "jogos"}.`,
      action: "Desative o gênero em vez de excluí-lo.",
    });
  }

  // Filho órfão deixaria a árvore quebrada; a FK é `RESTRICT` e o Postgres
  // recusaria, mas um 500 não diz ao admin o que fazer.
  const children = await database.query({ text: "SELECT count(*)::int AS total FROM game_genres WHERE parent_name = $1", values: [name] });
  if (children.rows[0].total > 0) {
    throw new ValidationError({
      message: `Este gênero tem ${children.rows[0].total} subgênero(s).`,
      action: "Desative o gênero (e os subgêneros) em vez de excluí-lo.",
    });
  }

  await database.query({ text: "DELETE FROM game_genres WHERE name = $1", values: [name] });
  return existing;
}

/* =========================================================
 * Vínculo com o jogo
 * ========================================================= */

/** Gêneros de um jogo, na ordem do catálogo, com o pai para montar o caminho. */
async function findByGame(gameId) {
  const result = await database.query({
    text: `SELECT gg.name, gg.parent_name
           FROM game_genre_links l
           INNER JOIN game_genres gg ON gg.name = l.genre_name
           WHERE l.game_id = $1
           ORDER BY gg.display_order, gg.name`,
    values: [gameId],
  });
  return result.rows;
}

/**
 * Troca os gêneros de um jogo.
 *
 * `normalizeSelection` roda ANTES da validação: sem ela, "Ação" + "Shooter"
 * consumiriam dois dos cinco slots para dizer a mesma coisa.
 *
 * A validação aceita nó **ativo ou já vinculado** — sem a segunda parte, salvar
 * um jogo antigo apagaria o gênero que o admin desativou depois (mesmo
 * raciocínio de `asset.validateCategories`).
 */
async function replaceForGame(gameId, names, { ignoreUnknown = false } = {}) {
  const nodes = await database.query({ text: "SELECT name, parent_name, is_active FROM game_genres" });
  const byKey = new Map(nodes.rows.map((node) => [genreKey(node.name), node]));

  // A validação roda sobre o que o cliente ENVIOU, antes da normalização: um
  // nome fora do catálogo precisa responder 400, não sumir em silêncio.
  // `normalizeSelection` descarta o que não conhece (é o que a tela quer ao
  // filtrar opções), e usá-la como única guarda fazia `genre_names:
  // ["Gênero Inventado"]` responder 200 apagando a classificação do jogo.
  //
  // `ignoreUnknown` existe para o campo LEGADO (`games.genre`, texto livre): um
  // cliente antigo manda "Aventura" ou "RPG, Ação" e o certo é aproveitar o que
  // casa com o catálogo, deixando o resto na coluna antiga — recusar a gravação
  // inteira por causa de uma palavra que sempre foi livre quebraria quem já
  // publicava. O formato novo (`genre_names`) continua estrito.
  const requested = Array.isArray(names) ? names : [];

  for (const raw of requested) {
    if (!byKey.has(genreKey(raw)) && !ignoreUnknown) {
      throw new ValidationError({
        message: `O gênero "${raw}" não está no catálogo.`,
        action: "Escolha um gênero da lista ou sugira um novo.",
      });
    }
  }

  const selection = normalizeSelection(
    requested.filter((raw) => byKey.has(genreKey(raw))).map((raw) => byKey.get(genreKey(raw)).name),
    nodes.rows,
  );

  if (selection.length > MAX_GAME_GENRES) {
    throw new ValidationError({
      message: `Um jogo pode ter no máximo ${MAX_GAME_GENRES} gêneros.`,
      action: "Escolha os mais representativos.",
    });
  }

  const current = new Set((await findByGame(gameId)).map((node) => genreKey(node.name)));

  for (const name of selection) {
    const node = byKey.get(genreKey(name));

    if (!node.is_active && !current.has(genreKey(node.name))) {
      throw new ValidationError({
        message: `O gênero "${node.name}" está desativado.`,
        action: "Escolha outro gênero da lista.",
      });
    }
  }

  await database.query({ text: "DELETE FROM game_genre_links WHERE game_id = $1", values: [gameId] });

  for (const name of selection) {
    await database.query({
      text: "INSERT INTO game_genre_links (game_id, genre_name) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      values: [gameId, name],
    });
  }

  return findByGame(gameId);
}

/** Vincula sem apagar os existentes — usado ao aprovar uma sugestão. */
async function attachToGame(gameId, genreName) {
  await database.query({
    text: "INSERT INTO game_genre_links (game_id, genre_name) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    values: [gameId, genreName],
  });
}

/* =========================================================
 * Validações
 * ========================================================= */

function normalizeName(raw) {
  const value = normalizeGenreName(raw);

  if (!value) {
    throw new ValidationError({ message: "O nome do gênero é obrigatório." });
  }

  if (value.length > MAX_GENRE_NAME_LENGTH) {
    throw new ValidationError({
      message: `O nome do gênero deve ter no máximo ${MAX_GENRE_NAME_LENGTH} caracteres.`,
    });
  }

  return value;
}

function normalizeParent(raw) {
  if (raw === undefined || raw === null) return null;
  const value = normalizeGenreName(raw);
  return value || null;
}

function normalizeDescription(raw) {
  if (raw === undefined || raw === null) return null;

  const value = String(raw).trim();
  return value ? value.slice(0, 255) : null;
}

function normalizeOrder(raw) {
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const gameGenre = {
  findAllNodes,
  findTree,
  findByName,
  findByKey,
  create,
  update,
  deleteGenre,
  findByGame,
  replaceForGame,
  attachToGame,
};

export default gameGenre;
