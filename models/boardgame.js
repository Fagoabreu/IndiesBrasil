import database from "infra/database.js";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "infra/errors.js";

/* =========================================================
 * List / Search
 * ========================================================= */

async function findAll({
  page = 1,
  limit = 20,
  search = "",
  category = "",
  stage = "",
} = {}) {
  const offset = (page - 1) * limit;
  const result = await database.query({
    text: `
      SELECT
        bg.id, bg.slug, bg.name, bg.short_description,
        bg.category, bg.stage, bg.release_date, bg.created_at,
        bg.player_count_min, bg.player_count_max,
        bg.play_time_min, bg.play_time_max,
        bg.age_rating, bg.weight, bg.content_rating,
        ui_cover.secure_url  AS cover_url,
        ui_ban.secure_url    AS banner_url,
        o.name               AS studio_name,
        o.slug               AS studio_slug,
        ui_logo.secure_url   AS studio_logo_url,
        COUNT(DISTINCT bf.follower_id)   AS follower_count,
        ROUND(AVG(br.rating), 1)           AS avg_rating,
        COUNT(DISTINCT br.id)              AS review_count,
        ARRAY_AGG(DISTINCT bm.mechanic) FILTER (WHERE bm.mechanic IS NOT NULL) AS mechanics
      FROM boardgames bg
      LEFT JOIN uploaded_images ui_cover ON ui_cover.id = bg.cover_image_id
      LEFT JOIN uploaded_images ui_ban   ON ui_ban.id   = bg.banner_image_id
      LEFT JOIN organizations o          ON o.id = bg.owner_org_id
      LEFT JOIN uploaded_images ui_logo  ON ui_logo.id  = o.img
      LEFT JOIN boardgame_followers bf   ON bf.boardgame_id = bg.id
      LEFT JOIN boardgame_mechanics bm   ON bm.boardgame_id = bg.id
      LEFT JOIN boardgame_reviews br     ON br.boardgame_id = bg.id
      WHERE ($3 = '' OR bg.name ILIKE '%' || $3 || '%' OR bg.short_description ILIKE '%' || $3 || '%')
        AND ($4 = '' OR bg.category = $4)
        AND ($5 = '' OR bg.stage = $5)
      GROUP BY bg.id, ui_cover.secure_url, ui_ban.secure_url,
               o.name, o.slug, ui_logo.secure_url
      ORDER BY bg.created_at DESC
      LIMIT $1 OFFSET $2
    `,
    values: [limit, offset, search, category, stage],
  });
  return result.rows;
}

async function findFollowedBy(userId) {
  const result = await database.query({
    text: `
      SELECT
        bg.id, bg.slug, bg.name, bg.short_description,
        bg.category, bg.stage, bg.release_date, bg.created_at,
        bg.player_count_min, bg.player_count_max,
        bg.play_time_min, bg.play_time_max,
        bg.age_rating, bg.weight, bg.content_rating,
        ui_cover.secure_url  AS cover_url,
        ui_ban.secure_url    AS banner_url,
        o.name               AS studio_name,
        o.slug               AS studio_slug,
        ui_logo.secure_url   AS studio_logo_url,
        COUNT(DISTINCT bf.follower_id)   AS follower_count,
        ARRAY_AGG(DISTINCT bm.mechanic) FILTER (WHERE bm.mechanic IS NOT NULL) AS mechanics
      FROM boardgame_followers ubf
      JOIN boardgames bg          ON bg.id = ubf.boardgame_id
      LEFT JOIN uploaded_images ui_cover ON ui_cover.id = bg.cover_image_id
      LEFT JOIN uploaded_images ui_ban   ON ui_ban.id   = bg.banner_image_id
      LEFT JOIN organizations o          ON o.id = bg.owner_org_id
      LEFT JOIN uploaded_images ui_logo  ON ui_logo.id  = o.img
      LEFT JOIN boardgame_followers bf   ON bf.boardgame_id = bg.id
      LEFT JOIN boardgame_mechanics bm   ON bm.boardgame_id = bg.id
      WHERE ubf.follower_id = $1
      GROUP BY bg.id, ui_cover.secure_url, ui_ban.secure_url,
               o.name, o.slug, ui_logo.secure_url
      ORDER BY bg.created_at DESC
    `,
    values: [userId],
  });
  return result.rows;
}

async function findBySlug(slug) {
  const result = await database.query({
    text: `
      SELECT
        bg.*,
        ui_cover.secure_url  AS cover_url,
        ui_ban.secure_url    AS banner_url,
        o.name               AS studio_name,
        o.slug               AS studio_slug,
        o.pitch              AS studio_pitch,
        ui_logo.secure_url   AS studio_logo_url,
        u.username           AS owner_username,
        COUNT(DISTINCT bf.follower_id) AS follower_count,
        ROUND(AVG(br.rating), 1)       AS avg_rating,
        COUNT(DISTINCT br.id)          AS review_count,
        ARRAY_AGG(DISTINCT bm.mechanic) FILTER (WHERE bm.mechanic IS NOT NULL) AS mechanics
      FROM boardgames bg
      LEFT JOIN uploaded_images ui_cover ON ui_cover.id = bg.cover_image_id
      LEFT JOIN uploaded_images ui_ban   ON ui_ban.id   = bg.banner_image_id
      LEFT JOIN organizations o          ON o.id = bg.owner_org_id
      LEFT JOIN uploaded_images ui_logo  ON ui_logo.id  = o.img
      LEFT JOIN users u                  ON u.id = bg.owner_id
      LEFT JOIN boardgame_followers bf   ON bf.boardgame_id = bg.id
      LEFT JOIN boardgame_mechanics bm   ON bm.boardgame_id = bg.id
      LEFT JOIN boardgame_reviews br     ON br.boardgame_id = bg.id
      WHERE bg.slug = $1
      GROUP BY bg.id, ui_cover.secure_url, ui_ban.secure_url,
               o.name, o.slug, o.pitch, ui_logo.secure_url, u.username
    `,
    values: [slug],
  });

  if (!result.rows[0]) {
    throw new NotFoundError({
      message: `Jogo de mesa "${slug}" não encontrado.`,
    });
  }
  return result.rows[0];
}

async function findByOrg(orgId) {
  const result = await database.query({
    text: `
      SELECT
        bg.id, bg.slug, bg.name, bg.short_description,
        bg.category, bg.stage, bg.release_date, bg.created_at,
        bg.player_count_min, bg.player_count_max,
        bg.play_time_min, bg.play_time_max,
        bg.age_rating, bg.weight, bg.website_url, bg.content_rating,
        ui_cover.secure_url  AS cover_url,
        ui_ban.secure_url    AS banner_url,
        COUNT(DISTINCT bf.follower_id) AS follower_count
      FROM boardgames bg
      LEFT JOIN uploaded_images ui_cover ON ui_cover.id = bg.cover_image_id
      LEFT JOIN uploaded_images ui_ban   ON ui_ban.id   = bg.banner_image_id
      LEFT JOIN boardgame_followers bf   ON bf.boardgame_id = bg.id
      WHERE bg.owner_org_id = $1
      GROUP BY bg.id, ui_cover.secure_url, ui_ban.secure_url
      ORDER BY bg.created_at DESC
    `,
    values: [orgId],
  });
  return result.rows;
}

/* =========================================================
 * Follow / Unfollow
 * ========================================================= */

async function followBoardgame(boardgameId, userId) {
  await database.query({
    text: `INSERT INTO boardgame_followers (boardgame_id, follower_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    values: [boardgameId, userId],
  });
}

async function unfollowBoardgame(boardgameId, userId) {
  await database.query({
    text: `DELETE FROM boardgame_followers WHERE boardgame_id = $1 AND follower_id = $2`,
    values: [boardgameId, userId],
  });
}

async function isFollowing(boardgameId, userId) {
  const result = await database.query({
    text: `SELECT 1 FROM boardgame_followers WHERE boardgame_id = $1 AND follower_id = $2`,
    values: [boardgameId, userId],
  });
  return result.rows.length > 0;
}

/* =========================================================
 * Slug
 * ========================================================= */

async function generateSlug(name) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);

  const existing = await database.query({
    text: `SELECT slug FROM boardgames WHERE slug LIKE $1 ORDER BY slug`,
    values: [`${base}%`],
  });

  const slugs = new Set(existing.rows.map((r) => r.slug));
  if (!slugs.has(base)) return base;

  let i = 2;
  while (slugs.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

async function saveCover(slug, imageId) {
  await database.query({
    text: `UPDATE boardgames SET cover_image_id = $1, updated_at = now() WHERE slug = $2`,
    values: [imageId, slug],
  });
}

async function saveBanner(slug, imageId) {
  await database.query({
    text: `UPDATE boardgames SET banner_image_id = $1, updated_at = now() WHERE slug = $2`,
    values: [imageId, slug],
  });
}

/* =========================================================
 * Mídia (vídeos)
 * ========================================================= */

async function findMedia(boardgameId) {
  const result = await database.query({
    text: `SELECT * FROM boardgame_media WHERE boardgame_id = $1 ORDER BY display_order, created_at`,
    values: [boardgameId],
  });
  return result.rows;
}

async function addMedia(
  boardgameId,
  { media_type, url, caption = null, display_order = 0 },
) {
  if (!["image", "video"].includes(media_type)) {
    throw new ValidationError({
      message: "media_type deve ser 'image' ou 'video'.",
    });
  }
  const result = await database.query({
    text: `
      INSERT INTO boardgame_media (boardgame_id, media_type, url, caption, display_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    values: [boardgameId, media_type, url, caption, display_order],
  });
  return result.rows[0];
}

async function removeMedia(mediaId, boardgameId) {
  const result = await database.query({
    text: `DELETE FROM boardgame_media WHERE id = $1 AND boardgame_id = $2 RETURNING id`,
    values: [mediaId, boardgameId],
  });
  if (!result.rowCount)
    throw new NotFoundError({ message: "Mídia não encontrada." });
}

/* =========================================================
 * Avaliações
 * ========================================================= */

async function createReview(boardgameId, userId, { rating, content = null }) {
  rating = Number(rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError({
      message: "A nota deve ser um número inteiro entre 1 e 5.",
    });
  }
  const existing = await database.query({
    text: `SELECT id FROM boardgame_reviews WHERE boardgame_id = $1 AND reviewer_id = $2`,
    values: [boardgameId, userId],
  });
  if (existing.rows[0]) {
    throw new ValidationError({
      message: "Você já avaliou este jogo. Edite sua avaliação existente.",
    });
  }
  const result = await database.query({
    text: `
      INSERT INTO boardgame_reviews (boardgame_id, reviewer_id, rating, content)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    values: [boardgameId, userId, rating, content?.trim() || null],
  });
  return result.rows[0];
}

async function updateReview(reviewId, userId, { rating, content }) {
  if (rating !== undefined) {
    rating = Number(rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ValidationError({
        message: "A nota deve ser um número inteiro entre 1 e 5.",
      });
    }
  }
  const existing = await database.query({
    text: `SELECT * FROM boardgame_reviews WHERE id = $1`,
    values: [reviewId],
  });
  if (!existing.rows[0])
    throw new NotFoundError({ message: "Avaliação não encontrada." });
  if (existing.rows[0].reviewer_id !== userId) {
    throw new ForbiddenError({
      message: "Você não pode editar a avaliação de outro usuário.",
    });
  }
  const fields = [];
  const values = [];
  let idx = 1;
  if (rating !== undefined) {
    fields.push(`rating = $${idx++}`);
    values.push(rating);
  }
  if (content !== undefined) {
    fields.push(`content = $${idx++}`);
    values.push(content?.trim() || null);
  }
  if (fields.length === 0) return existing.rows[0];
  fields.push(`updated_at = now()`);
  values.push(reviewId);
  const result = await database.query({
    text: `UPDATE boardgame_reviews SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values,
  });
  return result.rows[0];
}

async function getReviews(boardgameId, { page = 1, limit = 10 } = {}) {
  const offset = (page - 1) * limit;
  const result = await database.query({
    text: `
      SELECT
        br.id, br.rating, br.content, br.created_at, br.updated_at,
        u.username,
        u.resumo AS display_name,
        ui.secure_url AS avatar_url
      FROM boardgame_reviews br
      JOIN users u ON u.id = br.reviewer_id
      LEFT JOIN uploaded_images ui ON ui.id = u.avatar_image
      WHERE br.boardgame_id = $1
      ORDER BY br.created_at DESC
      LIMIT $2 OFFSET $3
    `,
    values: [boardgameId, limit, offset],
  });
  return result.rows;
}

async function getUserReview(boardgameId, userId) {
  const result = await database.query({
    text: `SELECT * FROM boardgame_reviews WHERE boardgame_id = $1 AND reviewer_id = $2`,
    values: [boardgameId, userId],
  });
  return result.rows[0] ?? null;
}

/* =========================================================
 * Create / Update
 * ========================================================= */

async function create(ownerId, ownerOrgId, data) {
  const {
    name,
    short_description,
    description,
    category,
    stage,
    player_count_min,
    player_count_max,
    play_time_min,
    play_time_max,
    age_rating,
    weight,
    release_date,
    website_url,
    mechanics = [],
  } = data;

  if (!name?.trim()) {
    throw new ValidationError({ message: "O nome do jogo é obrigatório." });
  }

  const slug = await generateSlug(name.trim());

  const result = await database.query({
    text: `
      INSERT INTO boardgames
        (slug, name, short_description, description, category, stage,
         player_count_min, player_count_max, play_time_min, play_time_max,
         age_rating, weight, release_date, owner_id, owner_org_id, website_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
    `,
    values: [
      slug,
      name.trim(),
      short_description || null,
      description || null,
      category || "board_game",
      stage || "concept",
      player_count_min || null,
      player_count_max || null,
      play_time_min || null,
      play_time_max || null,
      age_rating || null,
      weight || null,
      release_date || null,
      ownerId,
      ownerOrgId || null,
      website_url || null,
    ],
  });

  const boardgame = result.rows[0];

  if (mechanics.length > 0) {
    const values = mechanics
      .map((m) => `('${boardgame.id}', '${m.replaceAll("'", "''")}')`)
      .join(",");
    await database.query({
      text: `INSERT INTO boardgame_mechanics (boardgame_id, mechanic) VALUES ${values} ON CONFLICT DO NOTHING`,
    });
  }

  return boardgame;
}

async function update(slug, data) {
  const existing = await database.query({
    text: `SELECT id FROM boardgames WHERE slug = $1`,
    values: [slug],
  });
  const boardgameId = existing.rows[0]?.id;
  if (!boardgameId)
    throw new NotFoundError({
      message: `Jogo de mesa "${slug}" não encontrado.`,
    });

  const updatable = [
    "name",
    "short_description",
    "description",
    "category",
    "stage",
    "player_count_min",
    "player_count_max",
    "play_time_min",
    "play_time_max",
    "age_rating",
    "weight",
    "release_date",
    "website_url",
  ];
  const fields = [];
  const values = [];
  let idx = 1;

  for (const key of updatable) {
    if (key in data) {
      fields.push(`${key} = $${idx++}`);
      values.push(data[key] ?? null);
    }
  }

  if (fields.length > 0) {
    values.push(boardgameId);
    await database.query({
      text: `UPDATE boardgames SET ${fields.join(", ")}, updated_at = now() WHERE id = $${idx}`,
      values,
    });
  }

  if (Array.isArray(data.mechanics)) {
    await database.query({
      text: `DELETE FROM boardgame_mechanics WHERE boardgame_id = $1`,
      values: [boardgameId],
    });
    if (data.mechanics.length > 0) {
      const mechValues = data.mechanics
        .map((m) => `('${boardgameId}', '${m.replaceAll("'", "''")}')`)
        .join(",");
      await database.query({
        text: `INSERT INTO boardgame_mechanics (boardgame_id, mechanic) VALUES ${mechValues} ON CONFLICT DO NOTHING`,
      });
    }
  }

  return findBySlug(slug);
}

async function canEdit(boardgameId, user) {
  if (user.features.includes("update:boardgame:others")) return true;
  const result = await database.query({
    text: `SELECT owner_id, owner_org_id FROM boardgames WHERE id = $1`,
    values: [boardgameId],
  });
  if (!result.rows[0]) return false;
  const { owner_id, owner_org_id } = result.rows[0];
  if (owner_id === user.id) return true;
  if (owner_org_id) {
    const membership = await database.query({
      text: `SELECT 1 FROM org_members WHERE org_id = $1 AND member_id = $2 AND status = 'active'`,
      values: [owner_org_id, user.id],
    });
    return membership.rows.length > 0;
  }
  return false;
}

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  findAll,
  findFollowedBy,
  findByOrg,
  findBySlug,
  followBoardgame,
  unfollowBoardgame,
  isFollowing,
  create,
  update,
  canEdit,
  generateSlug,
  saveCover,
  saveBanner,
  findMedia,
  addMedia,
  removeMedia,
  createReview,
  updateReview,
  getReviews,
  getUserReview,
};
