import database from "infra/database";
import sanitizeHtml from "lib/sanitize.js";

async function create({ content, role }, authorId) {
  const createdTestimonial = await runInsertQuery({ content, role }, authorId);
  return createdTestimonial;

  async function runInsertQuery(userInputValues, authorId) {
    const results = await database.query({
      text: `
        INSERT INTO
          testimonials (author_id, content, role)
        VALUES
          ($1, $2, $3)
        RETURNING
          id,
          author_id,
          content,
          role,
          status,
          created_at
      `,
      values: [authorId, cleanContent(userInputValues.content), cleanRole(userInputValues.role)],
    });

    return results.rows[0];
  }
}

async function listApproved() {
  const testimonials = await runSelectQuery();
  return testimonials;

  async function runSelectQuery() {
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
}

function cleanContent(content) {
  return sanitizeHtml
    .sanitize(String(content ?? ""))
    .replace(/<[^>]*>/g, "")
    .trim();
}

function cleanRole(role) {
  if (!role) {
    return null;
  }

  const sanitized = sanitizeHtml
    .sanitize(String(role))
    .replace(/<[^>]*>/g, "")
    .trim();
  return sanitized || null;
}

const testimonial = {
  create,
  listApproved,
};

export default testimonial;
