import database from "infra/database";
import { NotFoundError, ValidationError, ForbiddenError } from "infra/errors.js";
import organization from "models/organization.js";
import { generateUniqueSlug } from "lib/slug";
import moderation from "./moderation.js";
import notification from "./notification";
import reputation from "./reputation";
import gameGenre from "./gameGenre";
import gameTag from "./gameTag";
import { FILTER_NONE } from "lib/productFilters";
import { NO_GENRE, splitGenreNames } from "lib/gameGenres";

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
 * Leitura
 * ========================================================= */

async function findAll({ page = 1, limit = 20, search = "", genre = "", stage = "", tag = "", contentRating = "", aiLevel = "" } = {}) {
  const offset = (page - 1) * limit;
  const filters = [];
  const values = [limit, offset, search, genre, stage, tag];

  // `"none"` filtra o que ainda não foi classificado (`IS NULL`); qualquer
  // outro valor já vem validado por `lib/productFilters.js` na rota.
  if (contentRating === FILTER_NONE) {
    filters.push(`g.content_rating IS NULL`);
  } else if (contentRating) {
    values.push(contentRating);
    filters.push(`g.content_rating = $${values.length}`);
  }

  if (aiLevel === FILTER_NONE) {
    filters.push(`g.ai_level IS NULL`);
  } else if (aiLevel) {
    values.push(Number(aiLevel));
    filters.push(`g.ai_level = $${values.length}`);
  }

  const filterSql = filters.length ? `AND ${filters.join("\n        AND ")}` : "";

  const result = await database.query({
    text: `
      SELECT
        g.id, g.slug, g.name, g.short_description, g.stage,
        -- 'genre' continua existindo para quem lê a string (card, press kit,
        -- JSON-LD), mas agora é DERIVADO dos vínculos, e mostra os PAIS: a
        -- lista de subgêneros estouraria o ellipsis do card ("Hack and
        -- Slash" sozinho já ocupa a linha inteira). A coluna antiga é o último
        -- recurso, para jogo que a migration não conseguiu interpretar.
        COALESCE(
          (SELECT string_agg(DISTINCT parent.name, ', ')
             FROM game_genre_links gl
             JOIN game_genres child  ON child.name  = gl.genre_name
             JOIN game_genres parent ON parent.name = COALESCE(child.parent_name, child.name)
            WHERE gl.game_id = g.id),
          NULLIF(g.genre, 'Indefinido')
        ) AS genre,
        -- Subconsulta correlacionada (e não LATERAL + array_agg): um JOIN a
        -- mais multiplicaria as linhas de seguidores e reviews e inflaria
        -- follower_count/avg_rating. Mesmo motivo do json_agg correlacionado
        -- em organization.findAll.
        COALESCE(
          (SELECT array_agg(t.name ORDER BY t.name)
             FROM game_tags gt
             JOIN tags t ON t.id = gt.tag_id
            WHERE gt.game_id = g.id),
          '{}'
        ) AS tags,
        g.release_date, g.created_at, g.content_rating, g.ai_level,
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
      WHERE ($3 = '' OR g.name ILIKE '%' || $3 || '%' OR g.short_description ILIKE '%' || $3 || '%'
        -- Busca livre cobre tag: quem digita "coop" acha o jogo marcado #coop
        -- mesmo sem a palavra no nome nem no resumo.
        OR EXISTS (
          SELECT 1
          FROM game_tags gt_search
          JOIN tags t_search ON t_search.id = gt_search.tag_id
          WHERE gt_search.game_id = g.id
            AND t_search.name ILIKE '%' || $3 || '%'
        ))
        -- Hierárquico de propósito: filtrar por "Ação" tem de achar o jogo
        -- marcado como "Shooter". Igualdade contra a coluna devolvia vazio
        -- porque o valor gravado era a frase inteira; igualdade contra o
        -- vínculo devolveria só quem marcou o pai — e ninguém marca o pai
        -- quando existe subgênero mais preciso.
        AND ($4 = '' OR EXISTS (
          SELECT 1
          FROM game_genre_links gl_filter
          JOIN game_genres gg_filter ON gg_filter.name = gl_filter.genre_name
          WHERE gl_filter.game_id = g.id
            AND (gg_filter.name = $4 OR gg_filter.parent_name = $4)
        ))
        AND ($5 = '' OR g.stage = $5)
        -- 'tag=' em query é valor EXATO de tag (o clique no chip), diferente de
        -- 'q=', que casa trecho em nome, resumo e tag. Mesma distinção de
        -- 'profession=' em /membros.
        AND ($6 = '' OR EXISTS (
          SELECT 1
          FROM game_tags gt_filter
          JOIN tags t_filter ON t_filter.id = gt_filter.tag_id
          WHERE gt_filter.game_id = g.id
            AND t_filter.name = $6
        ))
        ${filterSql}
        AND NOT EXISTS (
          SELECT 1
          FROM moderation_actions ma
          WHERE ma.revoked_at IS NULL
            AND (ma.expires_at IS NULL OR ma.expires_at > now())
            AND (
              (ma.target_type = 'game' AND ma.target_id = g.id::text)
              OR (ma.target_type = 'studio' AND ma.target_id = g.owner_org_id::text)
            )
        )
      GROUP BY g.id, ui_cover.secure_url, ui_ban.secure_url,
               o.name, o.slug, ui_logo.secure_url
      ORDER BY g.created_at DESC
      LIMIT $1 OFFSET $2
    `,
    values,
  });
  return result.rows;
}

/**
 * Lista para o sitemap: só o endereço (`slug`) e quando mudou.
 *
 * Não reaproveita `findAll`: ela faz seis JOINs e agregações para montar o
 * card, devolve colunas que o sitemap descarta e não traz `updated_at` — que é
 * justamente o dado do `<lastmod>`. Aqui é uma varredura simples, sem
 * paginação, porque o sitemap precisa de todas as linhas de uma vez.
 *
 * O filtro de moderação é o mesmo de `findAll`: jogo bloqueado — ou de estúdio
 * bloqueado — não pode entrar no sitemap, senão o Google recebe o endereço de
 * uma página que responde 404.
 */
async function findAllForSitemap() {
  const result = await database.query({
    text: `
      SELECT g.slug, g.updated_at
      FROM games g
      WHERE NOT EXISTS (
        SELECT 1
        FROM moderation_actions ma
        WHERE ma.revoked_at IS NULL
          AND (ma.expires_at IS NULL OR ma.expires_at > now())
          AND (
            (ma.target_type = 'game' AND ma.target_id = g.id::text)
            OR (ma.target_type = 'studio' AND ma.target_id = g.owner_org_id::text)
          )
      )
      ORDER BY g.updated_at DESC
    `,
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

  const studioBlocked = game.owner_org_id ? await moderation.isBlocked("studio", game.owner_org_id) : false;
  if ((await moderation.isBlocked("game", game.id)) || studioBlocked) {
    throw new NotFoundError({ message: `Jogo "${slug}" não encontrado.` });
  }

  // Carregar dados relacionados em paralelo
  const [platforms, media, team, storePages, tags, genres] = await Promise.all([
    findPlatforms(game.id),
    findMedia(game.id),
    findTeam(game.id),
    findStorePages(game.id),
    // `gameTag.findByGame` devolve **nomes**, que é a forma que o card, a ficha e
    // o JSON-LD consomem. A função local que existia aqui devolvia as linhas
    // (`{ id, name }`) e a ficha renderizava o objeto como texto — dava 500
    // ("Objects are not valid as a React child") em qualquer jogo com tag. Era
    // latente porque `game_tags` nunca tinha recebido um INSERT.
    gameTag.findByGame(game.id),
    gameGenre.findByGame(game.id),
  ]);

  return {
    ...game,
    // `genre` é a forma curta de uma linha (card, press kit, JSON-LD) e mostra os
    // PAIS, na mesma definição de `findAll`. Sem isso a ficha mostraria os
    // subgêneros ("Shooter, Plataforma") e o card o gênero ("Ação") — duas
    // respostas para o mesmo campo, dependendo de onde se lê.
    genre: derivedGenreLine(genres, game.genre),
    // `genres` traz o pai junto: a ficha monta "Ação › Shooter" e o link de
    // cada nível leva ao filtro correspondente.
    genres,
    genre_paths: genres.map((genre) => (genre.parent_name ? `${genre.parent_name} › ${genre.name}` : genre.name)),
    platforms,
    media,
    team,
    store_pages: storePages,
    tags,
  };
}

async function findByOrg(orgId) {
  const result = await database.query({
    text: `
      SELECT
        g.id, g.slug, g.name, g.short_description, g.genre, g.stage,
        g.release_date, g.created_at, g.content_rating,
        g.ai_level, g.ai_level_notes,
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

async function findStoreTypes() {
  const result = await database.query({
    text: `SELECT id, name FROM game_store ORDER BY id`,
  });
  return result.rows;
}

/**
 * Resolve o que gravar como gênero.
 *
 * `genre_names` (array) é o formato novo. `genre` (string livre) continua aceito
 * porque o formulário antigo e chamadas de API existentes o enviam — e é
 * quebrado nos mesmos separadores usados pela migration.
 */
function resolveGenreNames(data) {
  if (Array.isArray(data.genre_names)) return data.genre_names;
  if (typeof data.genre === "string") return splitGenreNames(data.genre);
  return null;
}

/**
 * Coluna legada (`games.genre`) em sincronia com os vínculos.
 *
 * Ela não é mais fonte de verdade — a leitura deriva dos vínculos — mas continua
 * sendo o último recurso para jogo cujo gênero não casou com o catálogo, e é o
 * que uma API cliente antiga lê. Truncada no limite de 50 da coluna.
 */
function legacyGenreValue(names) {
  return (names.join(", ") || NO_GENRE).slice(0, 50);
}

/**
 * Linha curta de gêneros a partir dos vínculos: os PAIS, sem repetir.
 *
 * A lista de subgêneros estouraria o `ellipsis` do card ("Hack and Slash"
 * sozinho já ocupa a linha inteira) e o press kit/JSON-LD só precisam do nível
 * alto. Sem vínculo, cai para a coluna legada — e "Indefinido" vira `null`, que
 * é a forma de dizer "não classificado".
 */
function derivedGenreLine(genres, legacyValue) {
  const parents = [...new Set(genres.map((genre) => genre.parent_name ?? genre.name))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (parents.length > 0) return parents.join(", ");
  return legacyValue === NO_GENRE ? null : (legacyValue ?? null);
}

/**
 * Grava gêneros e mantém a coluna legada coerente.
 *
 * O campo legado (`genre`, texto livre) roda com `ignoreUnknown`: o que não está
 * no catálogo fica só na coluna antiga, que é o último recurso de leitura. O
 * formato novo (`genre_names`) é estrito.
 */
async function syncGenres(gameId, data) {
  const names = resolveGenreNames(data);
  if (names === null) return;

  const fromLegacyString = !Array.isArray(data.genre_names);
  const saved = await gameGenre.replaceForGame(gameId, names, { ignoreUnknown: fromLegacyString });
  const persisted = saved.map((genre) => genre.name);

  // Quando o valor veio do campo legado, a coluna antiga **não** é reescrita: é
  // ali que mora o texto que não casou com o catálogo, e é o último recurso de
  // leitura (`NULLIF(g.genre, 'Indefinido')` no `findAll`). Reescrevê-la com a
  // lista que casou apagaria "Aventura" de um jogo cujo token não existe no
  // catálogo — a classificação sumiria da ficha por não ter sido convertida.
  if (fromLegacyString) return;

  await database.query({
    text: `UPDATE games SET genre = $1 WHERE id = $2`,
    values: [legacyGenreValue(persisted), gameId],
  });
}

/* =========================================================
 * Criação
 * ========================================================= */

async function create(orgId, userId, data) {
  if (!data.name?.trim()) {
    throw new ValidationError({ message: "O nome do jogo é obrigatório." });
  }

  const idResult = await database.query({
    text: `SELECT gen_random_uuid() AS id`,
  });
  const newId = idResult.rows[0].id;
  const slug = await generateUniqueSlug(data.name, "games", "slug", null, 80);

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

  const game = result.rows[0];

  // Gêneros e tags: as duas listas vivem em tabelas próprias (N:N). Falhar aqui
  // derruba a criação inteira de propósito — um jogo publicado sem a
  // classificação que a pessoa escolheu seria pior que um erro visível.
  await syncGenres(game.id, data);

  if (Array.isArray(data.tag_names)) {
    await gameTag.replaceForGame(game.id, data.tag_names);
  }

  // Pontuação de reputação (best-effort: não bloqueia a publicação do jogo).
  try {
    await reputation.award({
      userId,
      action: "game_created",
      referenceId: game.id,
    });
  } catch (error) {
    console.error("Falha ao pontuar criação de jogo", error);
  }

  return findBySlug(game.slug);
}

/* =========================================================
 * Atualização
 * ========================================================= */

async function update(slug, data) {
  const game = await findById(
    (
      await database.query({
        text: `SELECT id FROM games WHERE slug = $1`,
        values: [slug],
      })
    ).rows[0]?.id,
  );

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

  if (
    fields.length === 0 &&
    !Array.isArray(data.platforms) &&
    !Array.isArray(data.store_pages) &&
    !Array.isArray(data.genre_names) &&
    !Array.isArray(data.tag_names) &&
    typeof data.genre !== "string"
  ) {
    return findBySlug(slug);
  }

  // Se o nome mudou, regenera o slug
  let effectiveSlug = slug;
  if (data.name) {
    const newSlug = await generateUniqueSlug(data.name, "games", "slug", slug, 80);
    if (newSlug !== slug) {
      effectiveSlug = newSlug;
      fields.push(`slug = $${idx++}`);
      values.push(newSlug);
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

  // Gêneros e tags. O gênero aceita o array novo (`genre_names`) e a string
  // legada (`genre`), e nos dois casos a coluna antiga é reescrita com a lista
  // que realmente ficou — inclusive quando o servidor removeu o pai porque um
  // filho estava selecionado.
  await syncGenres(game.id, data);

  if (Array.isArray(data.tag_names)) {
    await gameTag.replaceForGame(game.id, data.tag_names);
  }

  return findBySlug(effectiveSlug);
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
    throw new ValidationError({
      message: "media_type deve ser 'image' ou 'video'.",
    });
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
        g.release_date, g.created_at, g.content_rating, g.ai_level,
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
    throw new ValidationError({
      message: "A nota deve ser um número inteiro entre 1 e 5.",
    });
  }

  // Verifica se já avaliou
  const existing = await database.query({
    text: `SELECT id FROM game_reviews WHERE game_id = $1 AND reviewer_id = $2`,
    values: [gameId, userId],
  });
  if (existing.rows[0]) {
    throw new ValidationError({
      message: "Você já avaliou este jogo. Edite sua avaliação existente.",
    });
  }

  const result = await database.query({
    text: `
      INSERT INTO game_reviews (game_id, reviewer_id, rating, content)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    values: [gameId, userId, rating, content?.trim() || null],
  });

  await notifyOrgReview(gameId, userId);

  return result.rows[0];

  async function notifyOrgReview(gameId, userId) {
    const game = await database.query({
      text: `SELECT owner_org_id, name, slug FROM games WHERE id = $1`,
      values: [gameId],
    });
    const gameRow = game.rows[0];
    if (!gameRow?.owner_org_id) return;

    await notification.createOrgNotification({
      org_id: gameRow.owner_org_id,
      type: "org_game_reviewed",
      source_user_id: userId,
      resource_type: "game",
      resource_id: gameRow.slug,
      subject_title: gameRow.name,
    });
  }
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
    text: `SELECT * FROM game_reviews WHERE id = $1`,
    values: [reviewId],
  });
  if (!existing.rows[0]) throw new NotFoundError({ message: "Avaliação não encontrada." });
  if (existing.rows[0].reviewer_id !== userId)
    throw new ForbiddenError({
      message: "Você não pode editar a avaliação de outro usuário.",
    });

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
 * Curtidas
 * ========================================================= */

async function setLikes(gameId, userId, liked) {
  const game = await findById(gameId);

  const { rowCount } = await database.query({
    text: `SELECT 1 FROM game_likes WHERE game_id = $1 AND user_id = $2`,
    values: [gameId, userId],
  });

  const alreadyLiked = rowCount > 0;
  const shouldLike = liked === undefined ? !alreadyLiked : liked;

  if (shouldLike && !alreadyLiked) {
    await database.query({
      text: `INSERT INTO game_likes (game_id, user_id) VALUES ($1, $2)`,
      values: [gameId, userId],
    });

    if (game.owner_org_id) {
      await notification.createOrgNotification({
        org_id: game.owner_org_id,
        type: "org_game_liked",
        source_user_id: userId,
        resource_type: "game",
        resource_id: game.slug,
        subject_title: game.name,
      });
    }

    return { liked: true, action: "created" };
  }

  if (!shouldLike && alreadyLiked) {
    await database.query({
      text: `DELETE FROM game_likes WHERE game_id = $1 AND user_id = $2`,
      values: [gameId, userId],
    });
    return { liked: false, action: "removed" };
  }

  return { liked: alreadyLiked, action: "noop" };
}

async function isLiked(gameId, userId) {
  if (!userId) return false;
  const result = await database.query({
    text: `SELECT 1 FROM game_likes WHERE game_id = $1 AND user_id = $2`,
    values: [gameId, userId],
  });
  return result.rowCount > 0;
}

async function getLikesCount(gameId) {
  const result = await database.query({
    text: `SELECT COUNT(*)::int AS count FROM game_likes WHERE game_id = $1`,
    values: [gameId],
  });
  return result.rows[0].count;
}

/* =========================================================
 * Comentários
 * ========================================================= */

async function createComment(gameId, userId, content) {
  const game = await findById(gameId);

  const result = await database.query({
    text: `INSERT INTO game_comments (game_id, author_id, content) VALUES ($1, $2, $3) RETURNING *`,
    values: [gameId, userId, content],
  });

  if (game.owner_org_id) {
    await notification.createOrgNotification({
      org_id: game.owner_org_id,
      type: "org_game_commented",
      source_user_id: userId,
      resource_type: "game",
      resource_id: game.slug,
      subject_title: game.name,
    });
  }

  return result.rows[0];
}

async function getComments(gameId, userId) {
  const result = await database.query({
    text: `
      SELECT
        c.id,
        c.game_id,
        c.created_at,
        c.content,
        u.username AS author_username,
        uui.secure_url AS author_avatar_image,
        (c.author_id = $2) AS is_current_user
      FROM game_comments c
      INNER JOIN users u ON u.id = c.author_id
      LEFT JOIN uploaded_images uui ON uui.id = u.avatar_image
      WHERE c.game_id = $1
      ORDER BY c.created_at DESC
    `,
    values: [gameId, userId || null],
  });
  return result.rows;
}

async function getCommentById(commentId, userId) {
  const result = await database.query({
    text: `
      SELECT
        c.id,
        c.game_id,
        c.created_at,
        c.content,
        u.username AS author_username,
        uui.secure_url AS author_avatar_image,
        (c.author_id = $2) AS is_current_user
      FROM game_comments c
      INNER JOIN users u ON u.id = c.author_id
      LEFT JOIN uploaded_images uui ON uui.id = u.avatar_image
      WHERE c.id = $1
    `,
    values: [commentId, userId || null],
  });
  return result.rows[0];
}

async function deleteComment(commentId) {
  await database.query({
    text: `DELETE FROM game_comments WHERE id = $1`,
    values: [commentId],
  });
}

async function getCommentsCount(gameId) {
  const result = await database.query({
    text: `SELECT COUNT(*)::int AS count FROM game_comments WHERE game_id = $1`,
    values: [gameId],
  });
  return result.rows[0].count;
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
  findAllForSitemap,
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
  setLikes,
  isLiked,
  getLikesCount,
  createComment,
  getComments,
  getCommentById,
  deleteComment,
  getCommentsCount,
  canEdit,
  deleteGame,
};

export default game;
