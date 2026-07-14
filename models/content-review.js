import database from "infra/database.js";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "infra/errors.js";

const VALID_CONTENT_TYPES = ["game", "boardgame", "book"];

/* =========================================================
 * Helpers
 * ========================================================= */

function generateSlug(title, id) {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base}-${id.slice(0, 8)}`;
}

function validateSections(sections) {
  if (!Array.isArray(sections)) {
    throw new ValidationError({ message: "Seções deve ser um array." });
  }
  for (const s of sections) {
    if (!["text", "image", "video"].includes(s.type)) {
      throw new ValidationError({
        message: `Tipo de seção inválido: ${s.type}. Use text, image ou video.`,
      });
    }
    if (s.type === "image" && !s.image_url && !s.image_id) {
      throw new ValidationError({
        message: "Seções do tipo image precisam de image_url ou image_id.",
      });
    }
    if (s.type === "video" && !s.embed_url) {
      throw new ValidationError({
        message: "Seções do tipo video precisam de embed_url.",
      });
    }
  }
}

/* =========================================================
 * Listagem
 * ========================================================= */

async function findAll({ page = 1, limit = 20, contentType = "" } = {}) {
  const offset = (page - 1) * limit;
  let query;

  if (contentType && VALID_CONTENT_TYPES.includes(contentType)) {
    query = {
      text: `
        SELECT
          cr.id, cr.slug, cr.title, cr.content_type, cr.content_id,
          cr.rating, cr.published_at, cr.created_at,
          cr.positive_points, cr.negative_points,
          cr.cover_url,
          u.username          AS author_username,
          uui.secure_url      AS author_avatar_url,
          cov.secure_url      AS cover_image_url,
          COALESCE(g.name, bg.name, b.title)                 AS content_name,
          COALESCE(g_cov.secure_url, bg_cov.secure_url, b_cov.secure_url, b.cover_url_external) AS content_cover_url
        FROM content_reviews cr
        JOIN users u                  ON u.id = cr.author_id
        LEFT JOIN uploaded_images uui ON uui.id = u.avatar_image
        LEFT JOIN uploaded_images cov ON cov.id = cr.cover_image_id
        LEFT JOIN games g             ON cr.content_type = 'game' AND g.id = cr.content_id
        LEFT JOIN uploaded_images g_cov ON g_cov.id = g.cover_image_id
        LEFT JOIN boardgames bg       ON cr.content_type = 'boardgame' AND bg.id = cr.content_id
        LEFT JOIN uploaded_images bg_cov ON bg_cov.id = bg.cover_image_id
        LEFT JOIN books b             ON cr.content_type = 'book' AND b.id = cr.content_id
        LEFT JOIN uploaded_images b_cov ON b_cov.id = b.cover_image_id
        WHERE cr.content_type = $3
        ORDER BY cr.published_at DESC
        LIMIT $1 OFFSET $2
      `,
      values: [limit, offset, contentType],
    };
  } else {
    query = {
      text: `
        SELECT
          cr.id, cr.slug, cr.title, cr.content_type, cr.content_id,
          cr.rating, cr.published_at, cr.created_at,
          cr.cover_url,
          u.username          AS author_username,
          uui.secure_url      AS author_avatar_url,
          cov.secure_url      AS cover_image_url,
          COALESCE(g.name, bg.name, b.title)                 AS content_name,
        COALESCE(g_cov.secure_url, bg_cov.secure_url, b_cov.secure_url, b.cover_url_external) AS content_cover_url,
        COALESCE(g.slug, bg.slug, b.slug)                   AS content_slug
        FROM content_reviews cr
        JOIN users u                  ON u.id = cr.author_id
        LEFT JOIN uploaded_images uui ON uui.id = u.avatar_image
        LEFT JOIN uploaded_images cov ON cov.id = cr.cover_image_id
        LEFT JOIN games g             ON cr.content_type = 'game' AND g.id = cr.content_id
        LEFT JOIN uploaded_images g_cov ON g_cov.id = g.cover_image_id
        LEFT JOIN boardgames bg       ON cr.content_type = 'boardgame' AND bg.id = cr.content_id
        LEFT JOIN uploaded_images bg_cov ON bg_cov.id = bg.cover_image_id
        LEFT JOIN books b             ON cr.content_type = 'book' AND b.id = cr.content_id
        LEFT JOIN uploaded_images b_cov ON b_cov.id = b.cover_image_id
        ORDER BY cr.published_at DESC
        LIMIT $1 OFFSET $2
      `,
      values: [limit, offset],
    };
  }

  const result = await database.query(query);
  return result.rows.map(parseReviewRow);
}

async function findByContent({
  contentType,
  contentId,
  page = 1,
  limit = 10,
} = {}) {
  if (!contentType || !contentId) return [];
  const offset = (page - 1) * limit;

  const result = await database.query({
    text: `
      SELECT
        cr.id, cr.slug, cr.title, cr.content_type, cr.content_id,
        cr.rating, cr.published_at, cr.created_at,
        cr.cover_url,
        u.username          AS author_username,
        uui.secure_url      AS author_avatar_url,
        cov.secure_url      AS cover_image_url,
        COALESCE(g.name, bg.name, b.title)                 AS content_name,
        COALESCE(g_cov.secure_url, bg_cov.secure_url, b_cov.secure_url, b.cover_url_external) AS content_cover_url,
        COALESCE(g.slug, bg.slug, b.slug)                   AS content_slug
      FROM content_reviews cr
      JOIN users u                  ON u.id = cr.author_id
      LEFT JOIN uploaded_images uui ON uui.id = u.avatar_image
      LEFT JOIN uploaded_images cov ON cov.id = cr.cover_image_id
      LEFT JOIN games g             ON cr.content_type = 'game' AND g.id = cr.content_id
      LEFT JOIN uploaded_images g_cov ON g_cov.id = g.cover_image_id
      LEFT JOIN boardgames bg       ON cr.content_type = 'boardgame' AND bg.id = cr.content_id
      LEFT JOIN uploaded_images bg_cov ON bg_cov.id = bg.cover_image_id
      LEFT JOIN books b             ON cr.content_type = 'book' AND b.id = cr.content_id
      LEFT JOIN uploaded_images b_cov ON b_cov.id = b.cover_image_id
      WHERE cr.content_type = $1 AND cr.content_id = $2
      ORDER BY cr.published_at DESC
      LIMIT $3 OFFSET $4
    `,
    values: [contentType, contentId, limit, offset],
  });

  return result.rows.map(parseReviewRow);
}

/* =========================================================
 * Leitura individual
 * ========================================================= */

async function findBySlug(slug) {
  const result = await database.query({
    text: `
      SELECT
        cr.*,
        u.username          AS author_username,
        u.resumo            AS author_bio,
        uui.secure_url      AS author_avatar_url,
        cov.secure_url      AS cover_image_url,
        COALESCE(g.name, bg.name, b.title)                 AS content_name,
        COALESCE(g_cov.secure_url, bg_cov.secure_url, b_cov.secure_url, b.cover_url_external) AS content_cover_url,
        COALESCE(g.slug, bg.slug, b.slug)                   AS content_slug
      FROM content_reviews cr
      JOIN users u                  ON u.id = cr.author_id
      LEFT JOIN uploaded_images uui ON uui.id = u.avatar_image
      LEFT JOIN uploaded_images cov ON cov.id = cr.cover_image_id
      LEFT JOIN games g             ON cr.content_type = 'game' AND g.id = cr.content_id
      LEFT JOIN uploaded_images g_cov ON g_cov.id = g.cover_image_id
      LEFT JOIN boardgames bg       ON cr.content_type = 'boardgame' AND bg.id = cr.content_id
      LEFT JOIN uploaded_images bg_cov ON bg_cov.id = bg.cover_image_id
      LEFT JOIN books b             ON cr.content_type = 'book' AND b.id = cr.content_id
      LEFT JOIN uploaded_images b_cov ON b_cov.id = b.cover_image_id
      WHERE cr.slug = $1
    `,
    values: [slug],
  });

  if (!result.rows[0]) {
    throw new NotFoundError({ message: `Análise "${slug}" não encontrada.` });
  }

  return parseFullReview(result.rows[0]);
}

async function findById(id) {
  const result = await database.query({
    text: `
      SELECT
        cr.*,
        u.username          AS author_username,
        u.resumo            AS author_bio,
        uui.secure_url      AS author_avatar_url,
        cov.secure_url      AS cover_image_url,
        COALESCE(g.name, bg.name, b.title)                 AS content_name,
        COALESCE(g_cov.secure_url, bg_cov.secure_url, b_cov.secure_url, b.cover_url_external) AS content_cover_url,
        COALESCE(g.slug, bg.slug, b.slug)                   AS content_slug
      FROM content_reviews cr
      JOIN users u                  ON u.id = cr.author_id
      LEFT JOIN uploaded_images uui ON uui.id = u.avatar_image
      LEFT JOIN uploaded_images cov ON cov.id = cr.cover_image_id
      LEFT JOIN games g             ON cr.content_type = 'game' AND g.id = cr.content_id
      LEFT JOIN uploaded_images g_cov ON g_cov.id = g.cover_image_id
      LEFT JOIN boardgames bg       ON cr.content_type = 'boardgame' AND bg.id = cr.content_id
      LEFT JOIN uploaded_images bg_cov ON bg_cov.id = bg.cover_image_id
      LEFT JOIN books b             ON cr.content_type = 'book' AND b.id = cr.content_id
      LEFT JOIN uploaded_images b_cov ON b_cov.id = b.cover_image_id
      WHERE cr.id = $1
    `,
    values: [id],
  });

  if (!result.rows[0]) {
    throw new NotFoundError({ message: `Análise não encontrada.` });
  }

  return parseFullReview(result.rows[0]);
}

/* =========================================================
 * Criação
 * ========================================================= */

async function create({
  title,
  authorId,
  contentType,
  contentId,
  coverImageId = null,
  coverUrl = null,
  rating = null,
  sections = [],
  positivePoints = [],
  negativePoints = [],
}) {
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    throw new ValidationError({ message: "Título é obrigatório." });
  }
  if (!authorId) {
    throw new ValidationError({ message: "Autor é obrigatório." });
  }
  if (!VALID_CONTENT_TYPES.includes(contentType)) {
    throw new ValidationError({
      message: `Tipo de conteúdo inválido: ${contentType}.`,
    });
  }
  if (!contentId) {
    throw new ValidationError({
      message: "Conteúdo (jogo/boardgame/livro) é obrigatório.",
    });
  }
  if (rating != null && (rating < 1 || rating > 5)) {
    throw new ValidationError({ message: "Nota deve ser entre 1 e 5." });
  }

  validateSections(sections);

  const id = crypto.randomUUID();

  if (!Array.isArray(positivePoints)) positivePoints = [];
  if (!Array.isArray(negativePoints)) negativePoints = [];

  const result = await database.query({
    text: `
      INSERT INTO content_reviews
        (id, slug, title, author_id, content_type, content_id,
         cover_image_id, cover_url, rating, sections, positive_points, negative_points)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `,
    values: [
      id,
      generateSlug(title, id),
      title.trim(),
      authorId,
      contentType,
      contentId,
      coverImageId,
      coverUrl,
      rating,
      JSON.stringify(sections),
      JSON.stringify(positivePoints),
      JSON.stringify(negativePoints),
    ],
  });

  return parseFullReview(result.rows[0]);
}

/* =========================================================
 * Atualização
 * ========================================================= */

async function update(reviewId, userId, fields) {
  const existing = await findById(reviewId);

  if (existing.author_id !== userId) {
    throw new ForbiddenError({
      message: "Você não pode editar a análise de outro usuário.",
    });
  }

  const allowedFields = [
    "title",
    "cover_image_id",
    "cover_url",
    "rating",
    "sections",
    "positive_points",
    "negative_points",
  ];
  const setClauses = [];
  const values = [];
  let idx = 1;

  for (const key of allowedFields) {
    if (fields[key] === undefined) continue;

    if (key === "sections") {
      validateSections(fields[key]);
      setClauses.push(`${key} = $${idx++}`);
      values.push(JSON.stringify(fields[key]));
    } else if (key === "positive_points" || key === "negative_points") {
      const arr = Array.isArray(fields[key]) ? fields[key] : [];
      setClauses.push(`${key} = $${idx++}`);
      values.push(JSON.stringify(arr));
    } else if (key === "rating") {
      if (fields[key] != null && (fields[key] < 1 || fields[key] > 5)) {
        throw new ValidationError({ message: "Nota deve ser entre 1 e 5." });
      }
      setClauses.push(`${key} = $${idx++}`);
      values.push(fields[key]);
    } else if (key === "title" && fields[key]) {
      setClauses.push(`${key} = $${idx++}`);
      values.push(fields[key].trim());
      // Atualiza slug
      setClauses.push(`slug = $${idx++}`);
      values.push(generateSlug(fields[key].trim(), reviewId));
    } else if (key === "cover_image_id") {
      const UUID_REGEX =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      setClauses.push(`${key} = $${idx++}`);
      values.push(
        fields[key] && UUID_REGEX.test(fields[key]) ? fields[key] : null,
      );
    } else {
      setClauses.push(`${key} = $${idx++}`);
      values.push(fields[key]);
    }
  }

  if (setClauses.length === 0) return existing;

  setClauses.push(`updated_at = now()`);
  values.push(reviewId);

  const result = await database.query({
    text: `UPDATE content_reviews SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
    values,
  });

  return parseFullReview(result.rows[0]);
}

/* =========================================================
 * Exclusão
 * ========================================================= */

async function deleteReview(reviewId, userId) {
  const existing = await findById(reviewId);

  if (existing.author_id !== userId) {
    throw new ForbiddenError({
      message: "Você não pode excluir a análise de outro usuário.",
    });
  }

  await database.query({
    text: `DELETE FROM content_reviews WHERE id = $1`,
    values: [reviewId],
  });
}

/* =========================================================
 * Cover image
 * ========================================================= */

async function updateCoverImage(reviewSlug, userId, imageId) {
  const existing = await findBySlug(reviewSlug);

  if (existing.author_id !== userId) {
    throw new ForbiddenError({
      message: "Você não pode alterar a capa de outra pessoa.",
    });
  }

  const result = await database.query({
    text: `UPDATE content_reviews SET cover_image_id = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    values: [imageId, existing.id],
  });

  return parseFullReview(result.rows[0]);
}

async function removeCoverImage(reviewSlug, userId) {
  const existing = await findBySlug(reviewSlug);

  if (existing.author_id !== userId) {
    throw new ForbiddenError({
      message: "Você não pode alterar a capa de outra pessoa.",
    });
  }

  const result = await database.query({
    text: `UPDATE content_reviews SET cover_image_id = NULL, updated_at = now() WHERE id = $1 RETURNING *`,
    values: [existing.id],
  });

  return parseFullReview(result.rows[0]);
}

/* =========================================================
 * Parsers
 * ========================================================= */

function parseReviewRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    content_type: row.content_type,
    content_id: row.content_id,
    content_name: row.content_name,
    content_cover_url: row.content_cover_url,
    content_slug: row.content_slug,
    rating: row.rating,
    published_at: row.published_at,
    created_at: row.created_at,
    author_username: row.author_username,
    author_avatar_url: row.author_avatar_url,
    cover_url: row.cover_url || row.cover_image_url,
  };
}

function parseFullReview(row) {
  return {
    ...row,
    cover_url: row.cover_url || row.cover_image_url || null,
    content_name: row.content_name || null,
    content_cover_url: row.content_cover_url || null,
    content_slug: row.content_slug || null,
    sections: parseJsonField(row.sections),
    positive_points: parseJsonField(row.positive_points),
    negative_points: parseJsonField(row.negative_points),
  };
}

function parseJsonField(field) {
  if (!field) return [];
  if (typeof field === "object") return field;
  try {
    return JSON.parse(field);
  } catch {
    return [];
  }
}

/* =========================================================
 * Export
 * ========================================================= */

const contentReview = {
  findAll,
  findByContent,
  findBySlug,
  findById,
  create,
  update,
  updateCoverImage,
  removeCoverImage,
  delete: deleteReview,
  VALID_CONTENT_TYPES,
};

export default contentReview;
