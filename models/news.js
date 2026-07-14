import database from "infra/database.js";
import { NotFoundError, ValidationError } from "@/infra/errors.js";

const newsFields = `
  n.id,
  n.author_id,
  n.title,
  n.summary,
  n.body,
  n.img,
  n.source_url,
  n.source_label,
  n.created_at,
  n.updated_at,
  u.username AS author_username,
  u.avatar_image AS author_avatar_image,
  uui.secure_url AS author_avatar_url,
  ui.secure_url AS img_url,
  COALESCE(r.avg_rating, 0) AS avg_rating,
  COALESCE(r.rating_count, 0) AS rating_count,
  COALESCE(fc.factcheck_count, 0) AS factcheck_count,
  COALESCE(fk.fake_count, 0) AS fake_count,
  COALESCE(c.comment_count, 0) AS comment_count
`;

const baseJoins = `
  INNER JOIN users u ON u.id = n.author_id
  LEFT JOIN uploaded_images uui ON uui.id = u.avatar_image
  LEFT JOIN uploaded_images ui ON ui.id = n.img
  LEFT JOIN LATERAL (
    SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS rating_count
    FROM news_ratings nr
    WHERE nr.news_id = n.id
  ) r ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS factcheck_count
    FROM news_factchecks nf
    WHERE nf.news_id = n.id AND nf.vote = 'factcheck'
  ) fc ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS fake_count
    FROM news_factchecks nf
    WHERE nf.news_id = n.id AND nf.vote = 'fake'
  ) fk ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS comment_count
    FROM news_comments nc
    WHERE nc.news_id = n.id
  ) c ON true
`;

// ─── CREATE ───────────────────────────────────────────
async function create(input) {
  const { author_id, title, summary, body, img, source_url, source_label } =
    input;

  const result = await database.query({
    text: `
      INSERT INTO news (author_id, title, summary, body, img, source_url, source_label)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    values: [
      author_id,
      title,
      summary,
      body,
      img || null,
      source_url || null,
      source_label || null,
    ],
  });

  return result.rows[0];
}

// ─── GET ALL ───────────────────────────────────────────
async function findAll() {
  const result = await database.query({
    text: `
      SELECT ${newsFields}
      FROM news n
      ${baseJoins}
      ORDER BY n.created_at DESC
    `,
  });
  return result.rows;
}

// ─── GET BY ID ─────────────────────────────────────────
async function findById(id) {
  const result = await database.query({
    text: `
      SELECT ${newsFields}
      FROM news n
      ${baseJoins}
      WHERE n.id = $1
    `,
    values: [id],
  });

  if (result.rowCount === 0) {
    throw new NotFoundError({
      message: "Notícia não encontrada.",
      action: "Verifique se o ID está correto.",
    });
  }

  return result.rows[0];
}

// ─── UPDATE ────────────────────────────────────────────
async function update(id, author_id, input) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (input.title !== undefined) {
    fields.push(`title = $${idx++}`);
    values.push(input.title);
  }
  if (input.summary !== undefined) {
    fields.push(`summary = $${idx++}`);
    values.push(input.summary);
  }
  if (input.body !== undefined) {
    fields.push(`body = $${idx++}`);
    values.push(input.body);
  }
  if (input.img !== undefined) {
    fields.push(`img = $${idx++}`);
    values.push(input.img);
  }
  if (input.source_url !== undefined) {
    fields.push(`source_url = $${idx++}`);
    values.push(input.source_url);
  }
  if (input.source_label !== undefined) {
    fields.push(`source_label = $${idx++}`);
    values.push(input.source_label);
  }

  if (fields.length === 0) {
    throw new ValidationError({
      message: "Nenhum campo para atualizar.",
      action: "Envie ao menos um campo.",
    });
  }

  fields.push(`updated_at = timezone('utc', now())`);

  values.push(id);
  values.push(author_id);

  const result = await database.query({
    text: `
      UPDATE news
      SET ${fields.join(", ")}
      WHERE id = $${idx++} AND author_id = $${idx}
      RETURNING *
    `,
    values,
  });

  if (result.rowCount === 0) {
    throw new NotFoundError({
      message: "Notícia não encontrada ou você não é o autor.",
      action: "Verifique o ID e se você é o autor da notícia.",
    });
  }

  return result.rows[0];
}

// ─── DELETE ────────────────────────────────────────────
async function deleteByIdAndAuthor(id, author_id) {
  const result = await database.query({
    text: `DELETE FROM news WHERE id = $1 AND author_id = $2 RETURNING *`,
    values: [id, author_id],
  });

  if (result.rowCount === 0) {
    throw new NotFoundError({
      message: "Notícia não encontrada ou você não é o autor.",
      action: "Verifique o ID e se você é o autor da notícia.",
    });
  }

  return result.rows[0];
}

// ─── RATING ────────────────────────────────────────────
async function setRating(news_id, user_id, rating) {
  // Verifica se a notícia existe
  const exists = await database.query({
    text: `SELECT 1 FROM news WHERE id = $1`,
    values: [news_id],
  });
  if (exists.rowCount === 0) {
    throw new NotFoundError({
      message: "Notícia não encontrada.",
      action: "Verifique o ID da notícia.",
    });
  }

  // Upsert
  const result = await database.query({
    text: `
      INSERT INTO news_ratings (news_id, user_id, rating)
      VALUES ($1, $2, $3)
      ON CONFLICT (news_id, user_id)
      DO UPDATE SET rating = EXCLUDED.rating
      RETURNING *
    `,
    values: [news_id, user_id, rating],
  });

  return result.rows[0];
}

async function getRatingByUser(news_id, user_id) {
  const result = await database.query({
    text: `SELECT rating FROM news_ratings WHERE news_id = $1 AND user_id = $2`,
    values: [news_id, user_id],
  });
  return result.rows[0] || null;
}

// ─── FACTCHECK ─────────────────────────────────────────
async function setFactcheck(news_id, user_id, vote) {
  if (!["factcheck", "fake"].includes(vote)) {
    throw new ValidationError({
      message: "Voto inválido. Use 'factcheck' ou 'fake'.",
      action: "Corrija o valor do voto.",
    });
  }

  const exists = await database.query({
    text: `SELECT 1 FROM news WHERE id = $1`,
    values: [news_id],
  });
  if (exists.rowCount === 0) {
    throw new NotFoundError({
      message: "Notícia não encontrada.",
      action: "Verifique o ID da notícia.",
    });
  }

  const result = await database.query({
    text: `
      INSERT INTO news_factchecks (news_id, user_id, vote)
      VALUES ($1, $2, $3)
      ON CONFLICT (news_id, user_id)
      DO UPDATE SET vote = EXCLUDED.vote
      RETURNING *
    `,
    values: [news_id, user_id, vote],
  });

  return result.rows[0];
}

async function getFactcheckByUser(news_id, user_id) {
  const result = await database.query({
    text: `SELECT vote FROM news_factchecks WHERE news_id = $1 AND user_id = $2`,
    values: [news_id, user_id],
  });
  return result.rows[0] || null;
}

// ─── SOURCES ───────────────────────────────────────────
async function addSource(news_id, url, label) {
  const result = await database.query({
    text: `
      INSERT INTO news_sources (news_id, url, label)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    values: [news_id, url, label || null],
  });
  return result.rows[0];
}

async function getSources(news_id) {
  const result = await database.query({
    text: `SELECT * FROM news_sources WHERE news_id = $1 ORDER BY created_at ASC`,
    values: [news_id],
  });
  return result.rows;
}

async function deleteSource(id) {
  await database.query({
    text: `DELETE FROM news_sources WHERE id = $1`,
    values: [id],
  });
}

// ─── COMMENTS ──────────────────────────────────────────
async function createComment(news_id, author_id, content) {
  const result = await database.query({
    text: `
      INSERT INTO news_comments (news_id, author_id, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    values: [news_id, author_id, content],
  });
  return result.rows[0];
}

async function getComments(news_id) {
  const result = await database.query({
    text: `
      SELECT
        nc.id,
        nc.news_id,
        nc.content,
        nc.created_at,
        u.username AS author_username,
        u.avatar_image AS author_avatar_image,
        cu.secure_url AS author_avatar_url
      FROM news_comments nc
      INNER JOIN users u ON u.id = nc.author_id
      LEFT JOIN uploaded_images cu ON cu.id = u.avatar_image
      WHERE nc.news_id = $1
      ORDER BY nc.created_at DESC
    `,
    values: [news_id],
  });
  return result.rows;
}

async function deleteComment(id) {
  await database.query({
    text: `DELETE FROM news_comments WHERE id = $1`,
    values: [id],
  });
}

const news = {
  create,
  findAll,
  findById,
  update,
  deleteByIdAndAuthor,
  setRating,
  getRatingByUser,
  setFactcheck,
  getFactcheckByUser,
  addSource,
  getSources,
  deleteSource,
  createComment,
  getComments,
  deleteComment,
};

export default news;
