import database from "infra/database";
import { NotFoundError, ValidationError, ForbiddenError } from "infra/errors.js";
import organization from "models/organization.js";

/* =========================================================
 * Constantes
 * ========================================================= */

export const STAGES = {
  concept: "Conceito",
  prototype: "Protótipo",
  alpha: "Alpha",
  beta: "Beta",
  early_access: "Acesso Antecipado",
  released: "Lançado",
  cancelled: "Cancelado",
};

export const PLATFORMS = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  ps5: "PlayStation 5",
  ps4: "PlayStation 4",
  xbox_series: "Xbox Series",
  xbox_one: "Xbox One",
  switch: "Nintendo Switch",
  ios: "iOS",
  android: "Android",
  browser: "Navegador",
};

/* =========================================================
 * Helpers
 * ========================================================= */

function generateSlug(name, id) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base}-${id.slice(0, 8)}`;
}

/* =========================================================
 * Leitura
 * ========================================================= */

async function findAll({ page = 1, limit = 20, search = "", genre = "", stage = "" } = {}) {
  const offset = (page - 1) * limit;
  const result = await database.query({
    text: `
      SELECT
        g.id, g.slug, g.name, g.short_description, g.genre, g.stage,
        g.release_date, g.created_at, g.content_rating,
        g.has_lootboxes, g.has_in_game_purchases, g.has_excessive_ads,
        ui_cover.secure_url  AS cover_url,
        ui_ban.secure_url    AS banner_url,
        o.name               AS studio_name,
        o.slug               AS studio_slug,
        ui_logo.secure_url   AS studio_logo_url,
        COUNT(DISTINCT gf.follower_id) AS follower_count,
        ROUND(AVG(gr.rating), 1)       AS avg_rating,
        COUNT(DISTINCT gr.id)          AS review_count,
        ARRAY_AGG(DISTINCT gp.platform) FILTER (WHERE gp.platform IS NOT NULL) AS platforms
      FROM games g
      LEFT JOIN uploaded_images ui_cover ON ui_cover.id = g.cover_image_id
      LEFT JOIN uploaded_images ui_ban   ON ui_ban.id   = g.banner_image_id
      LEFT JOIN organizations o          ON o.id = g.owner_org_id
      LEFT JOIN uploaded_images ui_logo  ON ui_logo.id  = o.img
      LEFT JOIN game_followers gf        ON gf.game_id  = g.id
      LEFT JOIN game_reviews   gr        ON gr.game_id  = g.id
      LEFT JOIN game_platforms gp        ON gp.game_id  = g.id
      WHERE ($3 = '' OR g.name ILIKE '%' || $3 || '%' OR g.short_description ILIKE '%' || $3 || '%')
        AND ($4 = '' OR g.genre = $4)
        AND ($5 = '' OR g.stage = $5)
      GROUP BY g.id, ui_cover.secure_url, ui_ban.secure_url,
               o.name, o.slug, ui_logo.secure_url
      ORDER BY g.created_at DESC
      LIMIT $1 OFFSET $2
    `,
    values: [limit, offset, search, genre, stage],
  });
  return result.rows;
}

async function findBySlug(slug) {
  const result = await database.query({
    text: `
      SELECT
        g.*,
        ui_cover.secure_url  AS cover_url,
        ui_ban.secure_url    AS banner_url,
        o.name               AS studio_name,
        o.slug               AS studio_slug,
        o.pitch              AS studio_pitch,
        ui_logo.secure_url   AS studio_logo_url,
        u.username           AS owner_username,
        COUNT(DISTINCT gf.follower_id) AS follower_count,
        ROUND(AVG(gr.rating), 1)       AS avg_rating,
        COUNT(DISTINCT gr.id)          AS review_count
      FROM games g
      LEFT JOIN uploaded_images ui_cover ON ui_cover.id = g.cover_image_id
      LEFT JOIN uploaded_images ui_ban   ON ui_ban.id   = g.banner_image_id
      LEFT JOIN organizations o          ON o.id = g.owner_org_id
      LEFT JOIN uploaded_images ui_logo  ON ui_logo.id  = o.img
      LEFT JOIN users u                  ON u.id = g.owner_id
      LEFT JOIN game_followers gf        ON gf.game_id  = g.id
      LEFT JOIN game_reviews   gr        ON gr.game_id  = g.id
      WHERE g.slug = $1
      GROUP BY g.id, ui_cover.secure_url, ui_ban.secure_url,
               o.name, o.slug, o.pitch, ui_logo.secure_url, u.username
    `,
    values: [slug],
  });

  if (!result.rows[0]) {
    throw new NotFoundError({ message: `Jogo "${slug}" não encontrado.` });
  }

  const game = result.rows[0];

  // Carregar dados relacionados em paralelo
  const [platforms, media, team, storePages, tags] = await Promise.all([
    findPlatforms(game.id),
    findMedia(game.id),
    findTeam(game.id),
    findStorePages(game.id),
    findTags(game.id),
  ]);

  return { ...game, platforms, media, team, store_pages: storePages, tags };
}

async function findByOrg(orgId) {
  const result = await database.query({
    text: `
      SELECT
        g.id, g.slug, g.name, g.short_description, g.genre, g.stage,
        g.release_date, g.created_at, g.content_rating,
        g.has_lootboxes, g.has_in_game_purchases, g.has_excessive_ads,
        ui_cover.secure_url AS cover_url,
        ui_ban.secure_url   AS banner_url,
        COUNT(DISTINCT gf.follower_id) AS follower_count,
        ROUND(AVG(gr.rating), 1)       AS avg_rating,
        COUNT(DISTINCT gr.id)          AS review_count
      FROM games g
      LEFT JOIN uploaded_images ui_cover ON ui_cover.id = g.cover_image_id
      LEFT JOIN uploaded_images ui_ban   ON ui_ban.id   = g.banner_image_id
      LEFT JOIN game_followers gf ON gf.game_id = g.id
      LEFT JOIN game_reviews   gr ON gr.game_id = g.id
      WHERE g.owner_org_id = $1
      GROUP BY g.id, ui_cover.secure_url, ui_ban.secure_url
      ORDER BY g.created_at DESC
    `,
    values: [orgId],
  });
  return result.rows;
}

async function findById(id) {
  const result = await database.query({
    text: `SELECT * FROM games WHERE id = $1`,
    values: [id],
  });
  if (!result.rows[0]) throw new NotFoundError({ message: "Jogo não encontrado." });
  return result.rows[0];
}

async function findPlatforms(gameId) {
  const result = await database.query({
    text: `SELECT platform FROM game_platforms WHERE game_id = $1 ORDER BY platform`,
    values: [gameId],
  });
  return result.rows.map((r) => r.platform);
}

async function findMedia(gameId) {
  const result = await database.query({
    text: `
      SELECT id, media_type, url, caption, display_order
      FROM game_media
      WHERE game_id = $1
      ORDER BY display_order, id
    `,
    values: [gameId],
  });
  return result.rows;
}

async function findTeam(gameId) {
  const result = await database.query({
    text: `
      SELECT gt.id, gt.roles, u.username, u.resumo AS display_name,
             ui.secure_url AS avatar_url
      FROM games_teams gt
      JOIN users u ON u.id = gt.team_member_id
      LEFT JOIN uploaded_images ui ON ui.id = u.avatar_image
      WHERE gt.game_id = $1
      ORDER BY gt.id
    `,
    values: [gameId],
  });
  return result.rows;
}

async function findStorePages(gameId) {
  const result = await database.query({
    text: `
      SELECT sp.id, sp.page_url, sp.price, gs.name AS store_name, gs.id AS store_type_id
      FROM store_page sp
      LEFT JOIN game_store gs ON gs.id = sp.store_type_id
      WHERE sp.game_id = $1
      ORDER BY sp.id
    `,
    values: [gameId],
  });
  return result.rows;
}

async function findTags(gameId) {
  const result = await database.query({
    text: `
      SELECT t.id, t.name
      FROM game_tags gt
      JOIN tags t ON t.id = gt.tag_id
      WHERE gt.game_id = $1
      ORDER BY t.name
    `,
    values: [gameId],
  });
  return result.rows;
}

async function findStoreTypes() {
  const result = await database.query({ text: `SELECT id, name FROM game_store ORDER BY id` });
  return result.rows;
}

/* =========================================================
 * Criação
 * ========================================================= */

async function create(orgId, userId, data) {
  if (!data.name?.trim()) {
    throw new ValidationError({ message: "O nome do jogo é obrigatório." });
  }

  const idResult = await database.query({ text: `SELECT gen_random_uuid() AS id` });
  const newId = idResult.rows[0].id;
  const slug = generateSlug(data.name, newId);

  const result = await database.query({
    text: `
      INSERT INTO games
        (id, slug, name, short_description, description, genre, engine, stage,
         release_date, website_url, trailer_url, owner_org_id, owner_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `,
    values: [
      newId,
      slug,
      data.name.trim(),
      data.short_description?.trim() || null,
      data.description?.trim() || null,
      data.genre?.trim() || "Indefinido",
      data.engine?.trim() || null,
      data.stage || "concept",
      data.release_date || null,
      data.website_url?.trim() || null,
      data.trailer_url?.trim() || null,
      orgId,
      userId,
    ],
  });

  return result.rows[0];
}

/* =========================================================
 * Atualização
 * ========================================================= */

async function update(slug, data) {
  const game = await findById((await database.query({ text: `SELECT id FROM games WHERE slug = $1`, values: [slug] })).rows[0]?.id);

  const updatable = ["name", "short_description", "description", "genre", "engine", "stage", "release_date", "website_url", "trailer_url"];
  const fields = [];
  const values = [];
  let idx = 1;

  for (const key of updatable) {
    if (key in data) {
      fields.push(`${key} = $${idx++}`);
      const val = data[key];
      values.push(val === "" ? null : (val ?? null));
    }
  }

  if (fields.length > 0) {
    values.push(game.id);
    await database.query({
      text: `UPDATE games SET ${fields.join(", ")}, updated_at = now() WHERE id = $${idx}`,
      values,
    });
  }

  // Atualizar plataformas se fornecidas
  if (Array.isArray(data.platforms)) {
    await updatePlatforms(game.id, data.platforms);
  }

  // Atualizar links de lojas se fornecidos
  if (Array.isArray(data.store_pages)) {
    await updateStorePages(game.id, data.store_pages);
  }

  return findBySlug(slug);
}

async function updatePlatforms(gameId, platforms) {
  await database.query({
    text: `DELETE FROM game_platforms WHERE game_id = $1`,
    values: [gameId],
  });

  if (platforms.length > 0) {
    const valuesClauses = platforms.map((_, i) => `($1, $${i + 2})`).join(", ");
    await database.query({
      text: `INSERT INTO game_platforms (game_id, platform) VALUES ${valuesClauses} ON CONFLICT DO NOTHING`,
      values: [gameId, ...platforms],
    });
  }
}

async function updateStorePages(gameId, storePages) {
  await database.query({
    text: `DELETE FROM store_page WHERE game_id = $1`,
    values: [gameId],
  });

  for (const sp of storePages) {
    if (!sp.store_type_id || !sp.page_url?.trim()) continue;
    await database.query({
      text: `INSERT INTO store_page (game_id, store_type_id, page_url, price) VALUES ($1, $2, $3, $4)`,
      values: [gameId, sp.store_type_id, sp.page_url.trim(), sp.price ?? null],
    });
  }
}

/* =========================================================
 * Imagens
 * ========================================================= */

async function saveCover(slug, imageId) {
  await database.query({
    text: `UPDATE games SET cover_image_id = $1, updated_at = now() WHERE slug = $2`,
    values: [imageId, slug],
  });
}

async function saveBanner(slug, imageId) {
  await database.query({
    text: `UPDATE games SET banner_image_id = $1, updated_at = now() WHERE slug = $2`,
    values: [imageId, slug],
  });
}

/* =========================================================
 * Mídia (screenshots e vídeos)
 * ========================================================= */

async function addMedia(gameId, { media_type, url, caption = null, display_order = 0 }) {
  if (!["image", "video"].includes(media_type)) {
    throw new ValidationError({ message: "media_type deve ser 'image' ou 'video'." });
  }
  const result = await database.query({
    text: `
      INSERT INTO game_media (game_id, media_type, url, caption, display_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    values: [gameId, media_type, url, caption, display_order],
  });
  return result.rows[0];
}

async function removeMedia(mediaId, gameId) {
  const result = await database.query({
    text: `DELETE FROM game_media WHERE id = $1 AND game_id = $2 RETURNING id`,
    values: [mediaId, gameId],
  });
  if (!result.rowCount) throw new NotFoundError({ message: "Mídia não encontrada." });
}

/* =========================================================
 * Follow / Unfollow
 * ========================================================= */

async function followGame(gameId, userId) {
  await database.query({
    text: `INSERT INTO game_followers (game_id, follower_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    values: [gameId, userId],
  });
}

async function unfollowGame(gameId, userId) {
  await database.query({
    text: `DELETE FROM game_followers WHERE game_id = $1 AND follower_id = $2`,
    values: [gameId, userId],
  });
}

async function isFollowing(gameId, userId) {
  const result = await database.query({
    text: `SELECT 1 FROM game_followers WHERE game_id = $1 AND follower_id = $2`,
    values: [gameId, userId],
  });
  return result.rows.length > 0;
}

async function findFollowedBy(userId) {
  const result = await database.query({
    text: `
      SELECT
        g.id, g.slug, g.name, g.short_description, g.genre, g.stage,
        g.release_date, g.created_at, g.content_rating,
        g.has_lootboxes, g.has_in_game_purchases, g.has_excessive_ads,
        ui_cover.secure_url  AS cover_url,
        ui_ban.secure_url    AS banner_url,
        o.name               AS studio_name,
        o.slug               AS studio_slug,
        ui_logo.secure_url   AS studio_logo_url,
        COUNT(DISTINCT gf.follower_id) AS follower_count,
        ROUND(AVG(gr.rating), 1)       AS avg_rating,
        COUNT(DISTINCT gr.id)          AS review_count,
        ARRAY_AGG(DISTINCT gp.platform) FILTER (WHERE gp.platform IS NOT NULL) AS platforms
      FROM game_followers ugf
      JOIN games g           ON g.id = ugf.game_id
      LEFT JOIN uploaded_images ui_cover ON ui_cover.id = g.cover_image_id
      LEFT JOIN uploaded_images ui_ban   ON ui_ban.id   = g.banner_image_id
      LEFT JOIN organizations o          ON o.id = g.owner_org_id
      LEFT JOIN uploaded_images ui_logo  ON ui_logo.id  = o.img
      LEFT JOIN game_followers gf        ON gf.game_id  = g.id
      LEFT JOIN game_reviews   gr        ON gr.game_id  = g.id
      LEFT JOIN game_platforms gp        ON gp.game_id  = g.id
      WHERE ugf.follower_id = $1
      GROUP BY g.id, ui_cover.secure_url, ui_ban.secure_url,
               o.name, o.slug, ui_logo.secure_url
      ORDER BY g.created_at DESC
    `,
    values: [userId],
  });
  return result.rows;
}

/* =========================================================
 * Reviews
 * ========================================================= */

async function createReview(gameId, userId, { rating, content = null }) {
  rating = Number(rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError({ message: "A nota deve ser um número inteiro entre 1 e 5." });
  }

  // Verifica se já avaliou
  const existing = await database.query({
    text: `SELECT id FROM game_reviews WHERE game_id = $1 AND reviewer_id = $2`,
    values: [gameId, userId],
  });
  if (existing.rows[0]) {
    throw new ValidationError({ message: "Você já avaliou este jogo. Edite sua avaliação existente." });
  }

  const result = await database.query({
    text: `
      INSERT INTO game_reviews (game_id, reviewer_id, rating, content)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    values: [gameId, userId, rating, content?.trim() || null],
  });
  return result.rows[0];
}

async function updateReview(reviewId, userId, { rating, content }) {
  if (rating !== undefined) {
    rating = Number(rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ValidationError({ message: "A nota deve ser um número inteiro entre 1 e 5." });
    }
  }

  const existing = await database.query({
    text: `SELECT * FROM game_reviews WHERE id = $1`,
    values: [reviewId],
  });
  if (!existing.rows[0]) throw new NotFoundError({ message: "Avaliação não encontrada." });
  if (existing.rows[0].reviewer_id !== userId) throw new ForbiddenError({ message: "Você não pode editar a avaliação de outro usuário." });

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

  values.push(reviewId);
  const result = await database.query({
    text: `UPDATE game_reviews SET ${fields.join(", ")}, updated_at = now() WHERE id = $${idx} RETURNING *`,
    values,
  });
  return result.rows[0];
}

async function getReviews(gameId, { page = 1, limit = 10 } = {}) {
  const offset = (page - 1) * limit;
  const result = await database.query({
    text: `
      SELECT
        gr.id, gr.rating, gr.content, gr.created_at, gr.updated_at,
        u.username, u.resumo AS display_name,
        ui.secure_url AS avatar_url
      FROM game_reviews gr
      JOIN users u ON u.id = gr.reviewer_id
      LEFT JOIN uploaded_images ui ON ui.id = u.avatar_image
      WHERE gr.game_id = $1
      ORDER BY gr.created_at DESC
      LIMIT $2 OFFSET $3
    `,
    values: [gameId, limit, offset],
  });
  return result.rows;
}

async function getUserReview(gameId, userId) {
  const result = await database.query({
    text: `SELECT * FROM game_reviews WHERE game_id = $1 AND reviewer_id = $2`,
    values: [gameId, userId],
  });
  return result.rows[0] || null;
}

/* =========================================================
 * Permissões
 * ========================================================= */

async function canEdit(game, userId) {
  if (!userId) return false;
  if (game.owner_id === userId) return true;
  if (game.owner_org_id) {
    return organization.isAdmin(game.owner_org_id, userId);
  }
  return false;
}

/* =========================================================
 * Exclusão
 * ========================================================= */

async function deleteGame(slug) {
  const result = await database.query({
    text: `DELETE FROM games WHERE slug = $1 RETURNING id`,
    values: [slug],
  });
  if (!result.rowCount) throw new NotFoundError({ message: "Jogo não encontrado." });
}

const game = {
  STAGES,
  PLATFORMS,
  findAll,
  findBySlug,
  findByOrg,
  findById,
  findStoreTypes,
  create,
  update,
  updatePlatforms,
  updateStorePages,
  saveCover,
  saveBanner,
  findMedia,
  addMedia,
  removeMedia,
  followGame,
  unfollowGame,
  isFollowing,
  findFollowedBy,
  createReview,
  updateReview,
  getReviews,
  getUserReview,
  canEdit,
  deleteGame,
};

export default game;
