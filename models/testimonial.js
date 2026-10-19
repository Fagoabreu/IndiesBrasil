import database from "infra/database";
import { NotFoundError, ValidationError } from "infra/errors.js";
import sanitizeHtml from "lib/sanitize.js";
import {
  MAX_TESTIMONIAL_CONTENT_LENGTH,
  MAX_TESTIMONIAL_ROLE_LENGTH,
  TESTIMONIAL_ALREADY_EXISTS_ACTION,
  TESTIMONIAL_ALREADY_EXISTS_MESSAGE,
} from "lib/testimonial";

/**
 * Model: depoimentos de membros.
 *
 * **Um depoimento por pessoa** — o índice único `testimonials_one_per_author`
 * garante a regra no banco, e o model a explica antes de chegar lá. O autor
 * pode editar e remover o próprio depoimento a qualquer momento; a página
 * pública só mostra os `approved`.
 */

const RETURNING = `id, author_id, content, role, status, created_at, updated_at`;

async function create({ content, role }, authorId) {
  const normalizedContent = requireContent(content);
  const normalizedRole = cleanRole(role);

  // A checagem explícita existe pela mensagem: só o índice único devolveria
  // `23505` e o usuário veria um erro genérico sem saber que já tem depoimento.
  const existing = await database.query({
    text: `SELECT id FROM testimonials WHERE author_id = $1 LIMIT 1`,
    values: [authorId],
  });

  if (existing.rowCount > 0) {
    throw alreadyExistsError();
  }

  try {
    const results = await database.query({
      text: `
        INSERT INTO testimonials (author_id, content, role)
        VALUES ($1, $2, $3)
        RETURNING ${RETURNING}
      `,
      values: [authorId, normalizedContent, normalizedRole],
    });

    return results.rows[0];
  } catch (error) {
    // Corrida entre dois envios do mesmo usuário: a checagem acima passou nos
    // dois e quem decide é o índice único. O erro é o mesmo 400.
    if (error.code === "23505") {
      throw alreadyExistsError();
    }

    throw error;
  }
}

async function listApproved() {
  const results = await database.query({
    text: `
      SELECT
        t.id,
        t.content,
        t.role,
        t.created_at,
        u.username,
        u.resumo,
        ui.secure_url as avatar_image
      FROM
        testimonials t
      INNER JOIN
        users u ON u.id = t.author_id
      LEFT JOIN
        uploaded_images ui ON ui.id = u.avatar_image
      WHERE
        t.status = 'approved'
      ORDER BY
        t.created_at DESC
    `,
  });

  return results.rows;
}

/**
 * Depoimento do próprio usuário, em qualquer status.
 *
 * Devolve `null` (e não 404) quando ele ainda não escreveu: para a tela, "sem
 * depoimento" é o estado inicial do formulário, não um recurso ausente.
 */
async function findByAuthor(authorId) {
  const results = await database.query({
    text: `SELECT ${RETURNING} FROM testimonials WHERE author_id = $1 LIMIT 1`,
    values: [authorId],
  });

  return results.rows[0] ?? null;
}

/**
 * Atualiza o depoimento do próprio autor.
 *
 * O `author_id` faz parte do `WHERE` — não há como editar o depoimento de outra
 * pessoa por esta função, mesmo que a rota receba um id.
 */
async function updateByAuthor(authorId, { content, role } = {}) {
  const fields = [];
  const values = [];
  let index = 1;

  if (content !== undefined) {
    fields.push(`content = $${index++}`);
    values.push(requireContent(content));
  }

  if (role !== undefined) {
    fields.push(`role = $${index++}`);
    values.push(cleanRole(role));
  }

  if (fields.length === 0) {
    return findByAuthor(authorId);
  }

  fields.push(`updated_at = now()`);
  values.push(authorId);

  const results = await database.query({
    text: `UPDATE testimonials SET ${fields.join(", ")} WHERE author_id = $${index} RETURNING ${RETURNING}`,
    values,
  });

  if (!results.rows[0]) {
    throw new NotFoundError({
      message: "Você ainda não tem um depoimento para editar.",
      action: "Escreva um depoimento primeiro.",
    });
  }

  return results.rows[0];
}

async function removeByAuthor(authorId) {
  const results = await database.query({
    text: `DELETE FROM testimonials WHERE author_id = $1 RETURNING id`,
    values: [authorId],
  });

  if (!results.rowCount) {
    throw new NotFoundError({
      message: "Você ainda não tem um depoimento para excluir.",
    });
  }

  return results.rows[0];
}

/* =========================================================
 * Validação
 * ========================================================= */

function requireContent(raw) {
  const content = cleanContent(raw);

  if (!content) {
    throw new ValidationError({
      message: "O depoimento não pode estar vazio.",
      action: "Escreva o depoimento antes de enviar.",
    });
  }

  if (content.length > MAX_TESTIMONIAL_CONTENT_LENGTH) {
    throw new ValidationError({
      message: `O depoimento deve ter no máximo ${MAX_TESTIMONIAL_CONTENT_LENGTH} caracteres.`,
    });
  }

  return content;
}

function alreadyExistsError() {
  return new ValidationError({
    message: TESTIMONIAL_ALREADY_EXISTS_MESSAGE,
    action: TESTIMONIAL_ALREADY_EXISTS_ACTION,
  });
}

/** Remove tags e normaliza espaços — o depoimento é texto puro. */
function cleanContent(content) {
  return sanitizeHtml
    .sanitize(String(content ?? ""))
    .replace(/<[^>]*>/g, "")
    .trim();
}

function cleanRole(role) {
  if (role === undefined || role === null) {
    return null;
  }

  const sanitized = sanitizeHtml
    .sanitize(String(role))
    .replace(/<[^>]*>/g, "")
    .trim();

  if (sanitized.length > MAX_TESTIMONIAL_ROLE_LENGTH) {
    throw new ValidationError({
      message: `A função deve ter no máximo ${MAX_TESTIMONIAL_ROLE_LENGTH} caracteres.`,
    });
  }

  return sanitized || null;
}

const testimonial = {
  create,
  listApproved,
  findByAuthor,
  updateByAuthor,
  removeByAuthor,
};

export default testimonial;
