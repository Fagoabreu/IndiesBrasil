import database from "infra/database.js";
import { NotFoundError, ValidationError } from "infra/errors.js";
import sanitizeHtml from "lib/sanitize.js";

/* =========================================================
 * Constantes
 * ========================================================= */

// Alvos que podem sofrer ação de moderação (bloqueio).
export const MODERATION_TARGET_TYPES = ["post", "user", "studio", "game", "boardgame", "book"];

// Alvos que podem ser denunciados pelos usuários.
export const REPORT_TARGET_TYPES = ["post", "studio", "game", "boardgame", "book"];

// Categorias de justificativa para bloqueio (fixas — evita texto livre não padronizado).
export const MODERATION_REASONS = [
  "violacao_termos",
  "conteudo_ofensivo",
  "discurso_de_odio",
  "assedio",
  "conteudo_sexual",
  "violencia",
  "direitos_autorais",
  "fraude",
  "ordem_judicial",
  "outro",
];

export const REPORT_REASONS = [
  "conteudo_ofensivo",
  "discurso_de_odio",
  "assedio",
  "conteudo_sexual",
  "violencia",
  "direitos_autorais",
  "dados_pessoais",
  "conteudo_improprio_menores",
  "golpe_fraude",
  "spam",
  "outro",
];

export const REPORT_STATUSES = ["pending", "resolved", "dismissed"];

const MAX_JUSTIFICATION_LENGTH = 2000;

// Mapa fixo (whitelist) de alvo -> tabela. Nunca recebe entrada do usuário,
// portanto a interpolação do nome da tabela é segura.
const TARGET_TABLES = {
  post: "posts",
  user: "users",
  studio: "organizations",
  game: "games",
  boardgame: "boardgames",
  book: "books",
};

/* =========================================================
 * Helpers internos
 * ========================================================= */

function validateTargetType(targetType, allowedTypes) {
  if (!allowedTypes.includes(targetType)) {
    throw new ValidationError({
      message: "Tipo de alvo inválido.",
      action: `Informe um tipo válido: ${allowedTypes.join(", ")}.`,
    });
  }
}

function sanitizeJustification(justification) {
  if (justification === undefined || justification === null) {
    return null;
  }

  const sanitized = sanitizeHtml.sanitize(String(justification)).trim();
  if (!sanitized) {
    return null;
  }

  return sanitized.slice(0, MAX_JUSTIFICATION_LENGTH);
}

function parseExpiresAt(expiresAt) {
  if (expiresAt === undefined || expiresAt === null || expiresAt === "") {
    return null; // por tempo indeterminado
  }

  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError({
      message: "Data limite inválida.",
      action: "Informe uma data ISO válida (ex.: 2025-12-31T23:59:59Z).",
    });
  }

  if (parsed.getTime() <= Date.now()) {
    throw new ValidationError({
      message: "A data limite deve estar no futuro.",
      action: "Informe uma data futura ou remova a data para bloqueio por tempo indeterminado.",
    });
  }

  return parsed.toISOString();
}

/**
 * Verifica se um alvo existe no banco. Usado para validar denúncias e
 * bloqueios contra IDs reais (evita moderação/denúncia de alvos inexistentes).
 */
export async function targetExists(targetType, targetId) {
  const table = TARGET_TABLES[targetType];
  if (!table) {
    throw new ValidationError({
      message: "Tipo de alvo inválido.",
      action: `Informe um tipo válido: ${Object.keys(TARGET_TABLES).join(", ")}.`,
    });
  }

  const results = await database.query({
    text: `SELECT 1 FROM ${table} WHERE id::text = $1 LIMIT 1`,
    values: [String(targetId)],
  });

  return results.rowCount > 0;
}

/* =========================================================
 * Bloqueios (moderação)
 * ========================================================= */

async function findActiveBlock(targetType, targetId) {
  const results = await database.query({
    text: `
      SELECT *
      FROM moderation_actions
      WHERE target_type = $1
        AND target_id = $2
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY created_at DESC
      LIMIT 1
    `,
    values: [targetType, String(targetId)],
  });

  return results.rows[0] || null;
}

async function isBlocked(targetType, targetId) {
  const activeBlock = await findActiveBlock(targetType, targetId);
  return activeBlock !== null;
}

async function createBlock({ targetType, targetId, reason, justification, moderatorId, expiresAt }) {
  validateTargetType(targetType, MODERATION_TARGET_TYPES);

  if (!MODERATION_REASONS.includes(reason)) {
    throw new ValidationError({
      message: "Motivo do bloqueio inválido.",
      action: `Informe um motivo válido: ${MODERATION_REASONS.join(", ")}.`,
    });
  }

  if (!targetId) {
    throw new ValidationError({
      message: "O alvo do bloqueio é obrigatório.",
      action: "Informe o identificador do alvo.",
    });
  }

  const exists = await targetExists(targetType, targetId);
  if (!exists) {
    throw new NotFoundError({
      message: "O alvo informado não foi encontrado no sistema.",
      action: "Verifique o tipo e o identificador do alvo.",
    });
  }

  const alreadyBlocked = await findActiveBlock(targetType, targetId);
  if (alreadyBlocked) {
    throw new ValidationError({
      message: "Este alvo já está bloqueado.",
      action: "Revogue o bloqueio existente antes de criar um novo.",
    });
  }

  const sanitizedJustification = sanitizeJustification(justification);
  const parsedExpiresAt = parseExpiresAt(expiresAt);

  const results = await database.query({
    text: `
      INSERT INTO moderation_actions
        (target_type, target_id, action, reason, justification, moderator_id, expires_at)
      VALUES
        ($1, $2, 'block', $3, $4, $5, $6)
      RETURNING *
    `,
    values: [targetType, String(targetId), reason, sanitizedJustification, moderatorId, parsedExpiresAt],
  });

  return results.rows[0];
}

async function listBlocks({ targetType } = {}) {
  const results = await database.query({
    text: `
      SELECT
        ma.id,
        ma.target_type,
        ma.target_id,
        ma.action,
        ma.reason,
        ma.justification,
        ma.moderator_id,
        ma.expires_at,
        ma.revoked_at,
        ma.created_at,
        u.username AS moderator_username
      FROM moderation_actions ma
      LEFT JOIN users u ON u.id = ma.moderator_id
      WHERE ma.revoked_at IS NULL
        AND ($1::text IS NULL OR ma.target_type = $1)
      ORDER BY ma.created_at DESC
    `,
    values: [targetType || null],
  });

  return results.rows;
}

async function revokeBlock(id, moderatorId) {
  const results = await database.query({
    text: `
      UPDATE moderation_actions
      SET
        revoked_at = now(),
        revoked_by = $2,
        updated_at = now()
      WHERE id = $1
        AND revoked_at IS NULL
      RETURNING *
    `,
    values: [id, moderatorId],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "O bloqueio informado não foi encontrado ou já foi revogado.",
      action: "Verifique o identificador do bloqueio.",
    });
  }

  return results.rows[0];
}

const moderation = {
  findActiveBlock,
  isBlocked,
  createBlock,
  listBlocks,
  revokeBlock,
};

export default moderation;
