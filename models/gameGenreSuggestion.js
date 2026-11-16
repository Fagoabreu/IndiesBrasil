import database from "infra/database.js";
import { NotFoundError, ValidationError } from "infra/errors";
import gameGenre from "./gameGenre";
import { MAX_GENRE_NAME_LENGTH, normalizeGenreName } from "lib/gameGenres";

/**
 * Model: sugestões de gênero de jogo.
 *
 * Espelho de `professionSuggestion`, com uma diferença que muda o fluxo: a
 * sugestão carrega `game_id`, e **aprovar vincula o gênero àquele jogo** — quem
 * sugeriu já estava classificando a obra, e obrigar a pessoa a voltar e
 * reselecionar o gênero novo seria o passo que faz a fila nunca esvaziar.
 *
 * A fila fica separada do catálogo porque a decisão editorial é do admin;
 * misturar faria a sugestão de qualquer usuário aparecer no seletor de todo
 * mundo antes de alguém olhar.
 */

const FIELDS = `
  gs.id, gs.name, gs.parent_name, gs.justification, gs.status, gs.game_id,
  gs.created_at, gs.reviewed_at,
  u.username AS suggested_by_username,
  g.name AS game_name, g.slug AS game_slug`;

const JOINS = `
  FROM game_genre_suggestions gs
  INNER JOIN users u ON u.id = gs.suggested_by
  INNER JOIN games g ON g.id = gs.game_id
  LEFT JOIN  users r ON r.id = gs.reviewed_by`;

const STATUSES = ["pending", "approved", "rejected"];

async function findAll({ status = "pending" } = {}) {
  if (!STATUSES.includes(status)) {
    throw new ValidationError({
      message: `Status inválido: "${status}".`,
      action: `Use um destes: ${STATUSES.join(", ")}.`,
    });
  }

  const result = await database.query({
    text: `SELECT ${FIELDS} ${JOINS} WHERE gs.status = $1 ORDER BY gs.created_at ASC`,
    values: [status],
  });

  return result.rows;
}

async function findById(id) {
  const result = await database.query({
    text: `SELECT ${FIELDS} ${JOINS} WHERE gs.id = $1`,
    values: [id],
  });

  if (!result.rows[0]) {
    throw new NotFoundError({ message: "Sugestão não encontrada." });
  }

  return result.rows[0];
}

/**
 * Cria uma sugestão pendente.
 *
 * Nome que já é gênero do catálogo (ativo ou não) responde 400 **dizendo qual**:
 * o admin aprovaria uma duplicata sem perceber.
 */
async function create({ name, justification, game_id }, userId) {
  const normalizedName = normalizeName(name);

  if (!game_id) {
    throw new ValidationError({
      message: "Informe o jogo onde o gênero foi sugerido.",
      action: "A sugestão precisa de um jogo de origem: aprovada, o gênero é vinculado a ele.",
    });
  }

  const existing = await gameGenre.findByKey(normalizedName);

  if (existing) {
    throw new ValidationError({
      message: `O gênero "${existing.name}" já está no catálogo.`,
      action: "Escolha-o na lista de gêneros do jogo.",
    });
  }

  const result = await database.query({
    text: `INSERT INTO game_genre_suggestions (suggested_by, name, justification, game_id)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
    values: [userId, normalizedName, normalizeJustification(justification), game_id],
  });

  return findById(result.rows[0].id);
}

/**
 * Aprova (criando o gênero e vinculando ao jogo de origem) ou recusa.
 *
 * Só sugestão `pending` pode ser revista — reaprovar criaria uma segunda linha
 * com o mesmo nome no catálogo.
 *
 * O pai é escolhido pelo admin no momento da aprovação (`parent_name`). Pode ser
 * `null` quando o gênero sugerido é de primeiro nível — decisão editorial, não
 * algo que a sugestão possa resolver sozinha.
 */
async function review(id, body = {}, reviewerId) {
  const suggestion = await findById(id);

  if (suggestion.status !== "pending") {
    throw new ValidationError({
      message: `Esta sugestão já foi ${suggestion.status === "approved" ? "aprovada" : "recusada"}.`,
    });
  }

  const status = body.status;

  if (status !== "approved" && status !== "rejected") {
    throw new ValidationError({ message: 'Informe `status: "approved"` ou `status: "rejected"`.' });
  }

  if (status === "rejected") {
    return markReviewed(id, { status: "rejected" }, reviewerId);
  }

  const parentName = typeof body.parent_name === "string" && body.parent_name.trim() ? body.parent_name.trim() : null;

  // O gênero é criado ANTES de marcar a sugestão: se a criação falhar (nome
  // duplicado que apareceu nesse meio-tempo, pai inexistente), a sugestão
  // continua `pending` para o admin resolver, em vez de ficar aprovada sem
  // gênero nenhum.
  const created = await gameGenre.create({
    name: body.name?.trim() || suggestion.name,
    parent_name: parentName,
    description: body.description,
    display_order: body.display_order,
  });

  await gameGenre.attachToGame(suggestion.game_id, created.name);

  return markReviewed(id, { status: "approved" }, reviewerId);
}

async function markReviewed(id, { status }, reviewerId) {
  const result = await database.query({
    text: `UPDATE game_genre_suggestions
           SET status = $2, reviewed_by = $3, reviewed_at = now()
           WHERE id = $1
           RETURNING id`,
    values: [id, status, reviewerId],
  });

  if (!result.rowCount) {
    throw new NotFoundError({ message: "Sugestão não encontrada." });
  }

  return findById(id);
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

function normalizeJustification(raw) {
  if (raw === undefined || raw === null) return null;

  const value = String(raw).trim();
  return value ? value.slice(0, 500) : null;
}

const gameGenreSuggestion = {
  findAll,
  findById,
  create,
  review,
};

export default gameGenreSuggestion;
