import database from "infra/database.js";
import { NotFoundError, ValidationError } from "infra/errors.js";
import sanitizeHtml from "lib/sanitize.js";
import reputation from "./reputation";
import { REPORT_REASONS, REPORT_STATUSES, REPORT_TARGET_TYPES, targetExists } from "./moderation.js";

const MAX_JUSTIFICATION_LENGTH = 2000;

/* =========================================================
 * Helpers internos
 * ========================================================= */

function validateTargetType(targetType) {
  if (!REPORT_TARGET_TYPES.includes(targetType)) {
    throw new ValidationError({
      message: "Tipo de alvo inválido.",
      action: `Informe um tipo válido: ${REPORT_TARGET_TYPES.join(", ")}.`,
    });
  }
}

function validateReason(reason) {
  if (!REPORT_REASONS.includes(reason)) {
    throw new ValidationError({
      message: "Motivo da denúncia inválido.",
      action: `Informe um motivo válido: ${REPORT_REASONS.join(", ")}.`,
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

/* =========================================================
 * Denúncias
 * ========================================================= */

async function create({ reporterId, targetType, targetId, reason, justification }) {
  validateTargetType(targetType);
  validateReason(reason);

  if (!targetId) {
    throw new ValidationError({
      message: "O alvo da denúncia é obrigatório.",
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

  // Evita que o autor denuncie o próprio post (anti-abuso).
  if (targetType === "post") {
    const isOwnPost = await isPostAuthoredBy(targetId, reporterId);
    if (isOwnPost) {
      throw new ValidationError({
        message: "Você não pode denunciar o próprio post.",
        action: "Denúncias são destinadas a conteúdo de terceiros.",
      });
    }
  }

  const sanitizedJustification = sanitizeJustification(justification);

  let result;
  try {
    result = await database.query({
      text: `
        INSERT INTO reports
          (reporter_id, target_type, target_id, reason, justification)
        VALUES
          ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      values: [reporterId, targetType, String(targetId), reason, sanitizedJustification],
    });
  } catch (error) {
    // Violação do índice parcial reports_one_pending_per_target:
    // o usuário já possui uma denúncia pendente para este alvo.
    if (error.code === "23505") {
      throw new ValidationError({
        message: "Você já possui uma denúncia em análise para este conteúdo.",
        action: "Aguarde a análise da sua denúncia antes de enviar outra.",
      });
    }
    throw error;
  }

  return result.rows[0];
}

async function findAll({ status, targetType, limit = 50 } = {}) {
  if (status && !REPORT_STATUSES.includes(status)) {
    throw new ValidationError({
      message: "Status de denúncia inválido.",
      action: `Informe um status válido: ${REPORT_STATUSES.join(", ")}.`,
    });
  }

  if (targetType) {
    validateTargetType(targetType);
  }

  const results = await database.query({
    text: `
      SELECT
        r.id,
        r.target_type,
        r.target_id,
        r.reason,
        r.justification,
        r.status,
        r.created_at,
        r.resolved_at,
        r.resolved_by,
        r.resolution_note,
        reporter.username AS reporter_username,
        resolver.username AS resolver_username
      FROM reports r
      JOIN users reporter ON reporter.id = r.reporter_id
      LEFT JOIN users resolver ON resolver.id = r.resolved_by
      WHERE ($1::text IS NULL OR r.status = $1)
        AND ($2::text IS NULL OR r.target_type = $2)
      ORDER BY
        CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
        r.created_at DESC
      LIMIT $3
    `,
    values: [status || null, targetType || null, limit],
  });

  return results.rows;
}

async function resolve({ id, moderatorId, status, resolutionNote }) {
  if (!REPORT_STATUSES.includes(status) || status === "pending") {
    throw new ValidationError({
      message: "Status de resolução inválido.",
      action: `Informe "resolved" ou "dismissed".`,
    });
  }

  const sanitizedNote = sanitizeJustification(resolutionNote);

  // Resolução + ajuste de reputação do denunciante de forma atômica:
  // ou a denúncia é resolvida E o denunciante é pontuado, ou nada acontece.
  return database.transaction(async (client) => {
    const results = await client.query({
      text: `
        UPDATE reports
        SET
          status = $2,
          resolved_at = now(),
          resolved_by = $3,
          resolution_note = $4
        WHERE id = $1
          AND status = 'pending'
        RETURNING *
      `,
      values: [id, status, moderatorId, sanitizedNote],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "A denúncia informada não foi encontrada ou já foi analisada.",
        action: "Verifique o identificador da denúncia.",
      });
    }

    const report = results.rows[0];

    // Denúncia validada (+pontos) ou falsa (−pontos). A idempotência do
    // award garante que, mesmo com retries, a pontuação aconteça uma única vez.
    const action = status === "resolved" ? "report_resolved" : "report_dismissed";
    await reputation.award({
      userId: report.reporter_id,
      action,
      referenceId: report.id,
      client,
    });

    return report;
  });
}

async function isPostAuthoredBy(postId, userId) {
  const results = await database.query({
    text: `SELECT 1 FROM posts WHERE id::text = $1 AND author_id = $2 LIMIT 1`,
    values: [String(postId), userId],
  });
  return results.rowCount > 0;
}

const report = {
  create,
  findAll,
  resolve,
};

export default report;
