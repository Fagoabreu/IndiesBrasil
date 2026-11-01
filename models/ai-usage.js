/**
 * Model: declaração de uso de IA.
 *
 * Guarda `ai_level` (0..5), as notas opcionais e a data da declaração nas
 * quatro tabelas de produto. A lista dos níveis e os limites ficam em
 * `lib/ai-usage.js` — aqui só há escrita e validação de entrada.
 *
 * ## Permissão é a de edição do produto, não "estar logado"
 *
 * Quem declara o nível é quem pode editar a obra: dono, membro ativo do estúdio
 * ou administrador. Delegar para o `canEdit` de cada model evita uma segunda
 * regra de autorização que divergiria da que a edição usa — e é o que impede
 * um usuário qualquer de reescrever a declaração de um produto alheio só por
 * estar autenticado.
 */

import database from "infra/database.js";
import { ForbiddenError, NotFoundError, ValidationError } from "infra/errors.js";
import { AI_USAGE_MAX_LEVEL, MAX_AI_NOTES_LENGTH, getAiLevel, isAiLevel } from "lib/ai-usage";
import game from "./game";
import boardgame from "./boardgame";
import book from "./book";
import asset from "./asset";

/**
 * Tipo → tabela e rótulo.
 *
 * A tabela vem deste mapa fechado, nunca do corpo da requisição: interpolar
 * `type` no SQL deixaria o cliente escolher a tabela lida e escrita.
 */
const TABLE_MAP = {
  game: { table: "games", label: "Jogo" },
  boardgame: { table: "boardgames", label: "Jogo de mesa" },
  book: { table: "books", label: "Livro/quadrinho" },
  asset: { table: "assets", label: "Asset" },
};

/** Tipos aceitos — a rota também valida com esta lista. */
export const AI_USAGE_TYPES = Object.keys(TABLE_MAP);

function resolveType(type) {
  const entry = TABLE_MAP[type];

  if (!entry) {
    throw new ValidationError({
      message: `Tipo inválido: "${type}".`,
      action: `Use um destes: ${AI_USAGE_TYPES.join(", ")}.`,
    });
  }

  return entry;
}

/** Normaliza o nível recebido (`3` ou `"3"`) e recusa o que está fora de 0..5. */
function normalizeLevel(level) {
  if (!isAiLevel(level)) {
    throw new ValidationError({
      message: "Nível de uso de IA inválido.",
      action: `Informe um número inteiro de 0 a ${AI_USAGE_MAX_LEVEL}.`,
    });
  }

  return Number(level);
}

/**
 * Notas são texto puro e opcionais.
 *
 * Recusa em vez de truncar: cortar em silêncio entregaria uma declaração
 * diferente da que a pessoa escreveu, e é justamente o registro que ela leva a
 * sério.
 */
function normalizeNotes(notes) {
  if (notes === undefined || notes === null) return null;
  if (typeof notes !== "string") {
    throw new ValidationError({
      message: "As notas de uso de IA devem ser texto.",
    });
  }

  const trimmed = notes.trim();
  if (!trimmed) return null;

  if (trimmed.length > MAX_AI_NOTES_LENGTH) {
    throw new ValidationError({
      message: `As notas de uso de IA devem ter no máximo ${MAX_AI_NOTES_LENGTH} caracteres.`,
    });
  }

  return trimmed;
}

async function canEditProduct(type, row, requestUser) {
  switch (type) {
    case "game":
      return game.canEdit(row, requestUser?.id);
    case "boardgame":
      return boardgame.canEdit(row.id, requestUser);
    case "book":
      return book.canEdit(row.id, requestUser);
    case "asset":
      return asset.canEdit(row.id, requestUser);
    default:
      return false;
  }
}

/**
 * Declara o nível de uso de IA de um produto.
 *
 * @param {string} type        — game | boardgame | book | asset
 * @param {string} slug        — endereço público do produto
 * @param {number|string} level — 0..5
 * @param {string|null} notes  — explicação opcional
 * @param {object} requestUser — usuário autenticado (a rota já garantiu sessão)
 */
async function saveUsage(type, slug, level, notes, requestUser) {
  const { table, label } = resolveType(type);

  const normalizedLevel = normalizeLevel(level);
  const normalizedNotes = normalizeNotes(notes);

  const found = await database.query({
    text: `SELECT id, owner_id, owner_org_id FROM ${table} WHERE slug = $1`,
    values: [slug],
  });

  const row = found.rows[0];

  if (!row) {
    throw new NotFoundError({ message: `${label} "${slug}" não encontrado.` });
  }

  if (!requestUser?.id || !(await canEditProduct(type, row, requestUser))) {
    throw new ForbiddenError({
      message: `Você não tem permissão para classificar este ${label.toLowerCase()}.`,
    });
  }

  const updated = await database.query({
    text: `
      UPDATE ${table}
      SET ai_level = $2,
          ai_level_notes = $3,
          ai_level_rated_at = now(),
          updated_at = now()
      WHERE id = $1
      RETURNING ai_level, ai_level_notes, ai_level_rated_at
    `,
    values: [row.id, normalizedLevel, normalizedNotes],
  });

  const saved = updated.rows[0];

  return {
    type,
    slug,
    level: saved.ai_level,
    notes: saved.ai_level_notes,
    ratedAt: saved.ai_level_rated_at,
    name: getAiLevel(saved.ai_level)?.name ?? null,
  };
}

const aiUsage = {
  AI_USAGE_TYPES,
  saveUsage,
};

export default aiUsage;
