import database from "infra/database.js";
import { NotFoundError, ValidationError } from "infra/errors.js";
import { generateUniqueSlug } from "lib/slug";
import { MAX_ASSET_CATEGORIES } from "lib/assetGroups";
import { ASSET_LICENSES, DEFAULT_ASSET_LICENSE } from "lib/assetLicenses";
import { normalizeAssetUrl } from "lib/assetUrl";
import uploadFile from "@/infra/uploadFile.js";
import moderation from "./moderation.js";
import notification from "./notification.js";

/**
 * Model: Assets.
 *
 * O que o site guarda é **metadado + endereço**: o arquivo do asset vive em
 * outro lugar (itch.io, Kenney, OpenGameArt, GitHub, site do estúdio) e
 * `external_url` é a referência. A única imagem que sobe para o nosso storage é
 * a **capa opcional** — e, sem capa, o card cai no placeholder.
 *
 * Duas invariantes estão na estrutura, não no código:
 *  - `owner_org_id` é NOT NULL na tabela (asset só de estúdio);
 *  - as categorias são N:N e a categoria é validada como **ativa** no momento
 *    do vínculo (uma categoria aposentada continua nos assets que já a tinham,
 *    mas não pode ser escolhida de novo).
 */

/** Teto de categorias por asset — a mesma constante que o formulário usa. */
export const MAX_CATEGORIES_PER_ASSET = MAX_ASSET_CATEGORIES;

/** Limites das interações — valem no model, não só na tela. */
const MAX_COMMENT_LENGTH = 2000;
const MAX_REVIEW_LENGTH = 1000;

const CATEGORIES_AGG = `
  COALESCE((
    SELECT json_agg(
      json_build_object(
        'id', c.id,
        'slug', c.slug,
        'name', c.name,
        'group_key', c.group_key,
        'is_active', c.is_active
      )
      ORDER BY c.group_key, c.display_order, c.name
    )
    FROM asset_category_links l
    JOIN asset_categories c ON c.id = l.category_id
    WHERE l.asset_id = a.id
  ), '[]'::json) AS categories`;

const SELECT_BASE = `
  SELECT
    a.id, a.slug, a.name, a.short_description, a.description,
    a.external_url, a.source_name, a.credit, a.license, a.is_free, a.price,
    a.file_format, a.created_at, a.updated_at,
    a.owner_org_id, a.owner_id, a.cover_image_id,
    ui.secure_url AS cover_url,
    o.name AS studio_name,
    o.slug AS studio_slug,
    ui_logo.secure_url AS studio_logo_url,
    ${CATEGORIES_AGG},
    COALESCE((SELECT ROUND(AVG(r.rating), 1) FROM asset_reviews r WHERE r.asset_id = a.id), 0) AS avg_rating,
    COALESCE((SELECT COUNT(*)::int FROM asset_reviews r WHERE r.asset_id = a.id), 0) AS review_count,
    COALESCE((SELECT COUNT(*)::int FROM asset_likes lk WHERE lk.asset_id = a.id), 0) AS likes_count,
    COALESCE((SELECT COUNT(*)::int FROM asset_comments cm WHERE cm.asset_id = a.id), 0) AS comments_count
  FROM assets a
  LEFT JOIN uploaded_images ui      ON ui.id = a.cover_image_id
  LEFT JOIN organizations o         ON o.id = a.owner_org_id
  LEFT JOIN uploaded_images ui_logo ON ui_logo.id = o.img`;

/**
 * Filtro de moderação — esconde asset bloqueado e asset de estúdio bloqueado.
 *
 * Vem como condição (e não como sufixo `AND ...`) para poder ser combinado com
 * uma lista de filtros que pode começar vazia.
 */
function moderationCondition(alias = "a") {
  return `NOT EXISTS (
    SELECT 1
    FROM moderation_actions ma
    WHERE ma.revoked_at IS NULL
      AND (ma.expires_at IS NULL OR ma.expires_at > now())
      AND (
        (ma.target_type = 'asset' AND ma.target_id = ${alias}.id::text)
        OR (ma.target_type = 'studio' AND ma.target_id = ${alias}.owner_org_id::text)
      )
  )`;
}

/* =========================================================
 * Leitura
 * ========================================================= */

async function findAll({ page = 1, limit = 20, search = "", category = "", group = "", free = null } = {}) {
  const offset = Math.max(0, (page - 1) * limit);
  const conditions = [moderationCondition("a")];
  const values = [];

  const term = typeof search === "string" ? search.trim() : "";
  if (term) {
    values.push(term);
    conditions.push(`(
      a.name ILIKE '%' || $${values.length} || '%'
      OR a.short_description ILIKE '%' || $${values.length} || '%'
      OR a.description ILIKE '%' || $${values.length} || '%'
    )`);
  }

  if (category) {
    values.push(category);
    conditions.push(`EXISTS (
      SELECT 1 FROM asset_category_links lc
      JOIN asset_categories c ON c.id = lc.category_id
      WHERE lc.asset_id = a.id AND c.slug = $${values.length}
    )`);
  }

  if (group) {
    values.push(group);
    conditions.push(`EXISTS (
      SELECT 1 FROM asset_category_links lg
      JOIN asset_categories c ON c.id = lg.category_id
      WHERE lg.asset_id = a.id AND c.group_key = $${values.length}
    )`);
  }

  if (free === true || free === false) {
    values.push(free);
    conditions.push(`a.is_free = $${values.length}`);
  }

  values.push(limit, offset);

  const result = await database.query({
    text: `
      ${SELECT_BASE}
      WHERE ${conditions.join("\n        AND ")}
      ORDER BY a.created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `,
    values,
  });

  return result.rows;
}

/** Linha crua pelo slug (sem filtro de moderação) — `null` quando não existe. */
async function selectBySlug(slug) {
  const result = await database.query({
    text: `${SELECT_BASE} WHERE a.slug = $1`,
    values: [slug],
  });
  return result.rows[0] ?? null;
}

/**
 * Linha crua, para as respostas de escrita (`create`/`update`).
 *
 * Passar essas respostas por `findBySlug` faria a criação **falhar depois do
 * INSERT** quando o estúdio estivesse bloqueado: o registro existe, mas a
 * leitura pública responde 404. Quem escreve é o dono/admin do estúdio, e ele
 * precisa receber o que acabou de gravar.
 */
async function findBySlugRaw(slug) {
  const assetRow = await selectBySlug(slug);
  if (!assetRow) {
    throw new NotFoundError({ message: `Asset "${slug}" não encontrado.` });
  }
  return assetRow;
}

async function findBySlug(slug) {
  const assetRow = await selectBySlug(slug);

  if (!assetRow) {
    throw new NotFoundError({ message: `Asset "${slug}" não encontrado.` });
  }

  const studioBlocked = await moderation.isBlocked("studio", assetRow.owner_org_id);
  if ((await moderation.isBlocked("asset", assetRow.id)) || studioBlocked) {
    throw new NotFoundError({ message: `Asset "${slug}" não encontrado.` });
  }

  return assetRow;
}

async function findByOrg(orgId) {
  const result = await database.query({
    text: `
      ${SELECT_BASE}
      WHERE a.owner_org_id = $1
        AND ${moderationCondition("a")}
      ORDER BY a.created_at DESC
    `,
    values: [orgId],
  });
  return result.rows;
}

/**
 * Lista para o sitemap: só o endereço (`slug`) e quando mudou.
 *
 * Mesma razão de `game.findAllForSitemap`: `findAll` monta o card, corta por
 * página e não devolve `updated_at`. O filtro de moderação é repetido aqui para
 * asset bloqueado — ou de estúdio bloqueado — não virar endereço anunciado.
 */
async function findAllForSitemap() {
  const result = await database.query({
    text: `
      SELECT a.slug, a.updated_at
      FROM assets a
      WHERE ${moderationCondition("a")}
      ORDER BY a.updated_at DESC
    `,
  });
  return result.rows;
}

/* =========================================================
 * Escrita
 * ========================================================= */

async function create(userId, orgId, data = {}) {
  const name = normalizeName(data.name);
  const externalUrl = requireExternalUrl(data.external_url);
  const license = normalizeLicense(data.license);
  const isFree = data.is_free === undefined ? true : parseBoolean(data.is_free, "is_free");

  // Categorias validadas ANTES do INSERT: uma lista inválida não pode deixar
  // um asset pela metade no banco (registro sem classificação e sem retorno).
  const categoryIds = await validateCategories(data.category_ids, null);

  const slug = await generateUniqueSlug(name, "assets", "slug", null, 120);

  const result = await database.query({
    text: `
      INSERT INTO assets (
        slug, name, short_description, description, external_url,
        source_name, credit, license, is_free, price, file_format,
        owner_org_id, owner_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, slug
    `,
    values: [
      slug,
      name,
      normalizeOptionalText(data.short_description, 255),
      normalizeOptionalText(data.description, 20000),
      externalUrl,
      normalizeOptionalText(data.source_name, 60),
      normalizeOptionalText(data.credit, 255),
      license,
      isFree,
      normalizePrice(data.price, isFree),
      normalizeOptionalText(data.file_format, 120),
      orgId,
      userId,
    ],
  });

  const created = result.rows[0];
  await replaceCategories(created.id, categoryIds);

  return findBySlugRaw(created.slug);
}

async function update(slug, data = {}) {
  const existing = await database.query({
    text: `SELECT id FROM assets WHERE slug = $1`,
    values: [slug],
  });

  if (!existing.rows[0]) {
    throw new NotFoundError({ message: `Asset "${slug}" não encontrado.` });
  }

  const assetId = existing.rows[0].id;
  const fields = [];
  const values = [];
  let index = 1;

  // Valida antes de qualquer UPDATE, pelo mesmo motivo do `create`.
  let categoryIds = null;
  if (Array.isArray(data.category_ids)) {
    categoryIds = await validateCategories(data.category_ids, assetId);
  }

  if ("name" in data) {
    fields.push(`name = $${index++}`);
    values.push(normalizeName(data.name));
  }

  if ("short_description" in data) {
    fields.push(`short_description = $${index++}`);
    values.push(normalizeOptionalText(data.short_description, 255));
  }

  if ("description" in data) {
    fields.push(`description = $${index++}`);
    values.push(normalizeOptionalText(data.description, 20000));
  }

  if ("external_url" in data) {
    fields.push(`external_url = $${index++}`);
    values.push(requireExternalUrl(data.external_url));
  }

  if ("source_name" in data) {
    fields.push(`source_name = $${index++}`);
    values.push(normalizeOptionalText(data.source_name, 60));
  }

  if ("credit" in data) {
    fields.push(`credit = $${index++}`);
    values.push(normalizeOptionalText(data.credit, 255));
  }

  if ("license" in data) {
    fields.push(`license = $${index++}`);
    values.push(normalizeLicense(data.license));
  }

  if ("is_free" in data) {
    fields.push(`is_free = $${index++}`);
    values.push(parseBoolean(data.is_free, "is_free"));
  }

  if ("price" in data) {
    // `is_free` pode estar na mesma requisição; o preço é normalizado com o
    // estado final para um asset gratuito nunca guardar preço.
    const willBeFree = "is_free" in data ? parseBoolean(data.is_free, "is_free") : await findIsFree(assetId);
    fields.push(`price = $${index++}`);
    values.push(normalizePrice(data.price, willBeFree));
  }

  if ("file_format" in data) {
    fields.push(`file_format = $${index++}`);
    values.push(normalizeOptionalText(data.file_format, 120));
  }

  // Se o nome mudou, regenera o slug — como em jogos e livros. O endereço
  // antigo deixa de responder; por isso o formulário mostra o novo slug ao
  // salvar.
  let effectiveSlug = slug;
  if ("name" in data) {
    const newSlug = await generateUniqueSlug(String(data.name).trim(), "assets", "slug", slug, 120);
    if (newSlug !== slug) {
      effectiveSlug = newSlug;
      fields.push(`slug = $${index++}`);
      values.push(newSlug);
    }
  }

  if (fields.length > 0) {
    fields.push("updated_at = now()");
    values.push(assetId);
    await database.query({
      text: `UPDATE assets SET ${fields.join(", ")} WHERE id = $${index}`,
      values,
    });
  }

  if (categoryIds) {
    await replaceCategories(assetId, categoryIds);
  }

  return findBySlugRaw(effectiveSlug);
}

async function findIsFree(assetId) {
  const result = await database.query({
    text: `SELECT is_free FROM assets WHERE id = $1`,
    values: [assetId],
  });
  return Boolean(result.rows[0]?.is_free);
}

/**
 * Valida e normaliza a lista de categorias, **sem gravar**.
 *
 * Aceita categoria ativa **ou** categoria já vinculada a este asset: a segunda
 * parte é o que permite salvar um asset que usa uma categoria aposentada sem
 * que o simples "salvar" apague a classificação. Vincular uma categoria
 * inativa que ainda não estava lá continua recusado.
 *
 * @returns {Promise<number[]>} ids únicos, prontos para `replaceCategories`
 */
async function validateCategories(categoryIds, assetId) {
  if (categoryIds === undefined || categoryIds === null) {
    throw new ValidationError({
      message: "Selecione ao menos uma categoria para o asset.",
    });
  }

  if (!Array.isArray(categoryIds)) {
    throw new ValidationError({
      message: "O campo category_ids deve ser uma lista de categorias.",
    });
  }

  const unique = [...new Set(categoryIds.map((value) => Number.parseInt(value, 10)).filter((value) => Number.isInteger(value)))];

  if (unique.length === 0) {
    throw new ValidationError({
      message: "Selecione ao menos uma categoria para o asset.",
    });
  }

  if (unique.length > MAX_CATEGORIES_PER_ASSET) {
    throw new ValidationError({
      message: `Selecione no máximo ${MAX_CATEGORIES_PER_ASSET} categorias.`,
      action: "Um asset com muitas categorias deixa de ser classificável.",
    });
  }

  const found = await database.query({
    text: `
      SELECT c.id
      FROM asset_categories c
      WHERE c.id = ANY($1::int[])
        AND (
          c.is_active
          OR EXISTS (
            SELECT 1 FROM asset_category_links l
            WHERE l.category_id = c.id AND l.asset_id = $2
          )
        )
    `,
    values: [unique, assetId],
  });

  if (found.rowCount !== unique.length) {
    throw new ValidationError({
      message: "Uma das categorias informadas não existe ou está desativada.",
      action: "Recarregue a lista de categorias e escolha novamente.",
    });
  }

  return unique;
}

/** Substitui os vínculos do asset pela lista já validada. */
async function replaceCategories(assetId, categoryIds) {
  await database.query({
    text: `DELETE FROM asset_category_links WHERE asset_id = $1`,
    values: [assetId],
  });

  await database.query({
    text: `INSERT INTO asset_category_links (asset_id, category_id) SELECT $1, unnest($2::int[])`,
    values: [assetId, categoryIds],
  });
}

/* =========================================================
 * Curtidas
 * ========================================================= */

/**
 * Liga/desliga a curtida e devolve o estado final — idempotente por design.
 *
 * `liked` ausente inverte o estado atual, como em jogos e livros: o botão da
 * interface só manda o alvo (`!liked`), e a rota não precisa saber o estado
 * anterior.
 */
async function setLikes(assetId, userId, liked) {
  const assetRow = await findInteractionTarget(assetId);

  const { rowCount } = await database.query({
    text: `SELECT 1 FROM asset_likes WHERE asset_id = $1 AND user_id = $2`,
    values: [assetId, userId],
  });

  const alreadyLiked = rowCount > 0;
  const shouldLike = liked === undefined ? !alreadyLiked : liked;

  if (shouldLike && !alreadyLiked) {
    await database.query({
      text: `INSERT INTO asset_likes (asset_id, user_id) VALUES ($1, $2)`,
      values: [assetId, userId],
    });

    await notification.createOrgNotification({
      org_id: assetRow.owner_org_id,
      type: "org_asset_liked",
      source_user_id: userId,
      resource_type: "asset",
      resource_id: assetRow.slug,
      subject_title: assetRow.name,
    });

    return { liked: true, action: "created" };
  }

  if (!shouldLike && alreadyLiked) {
    await database.query({
      text: `DELETE FROM asset_likes WHERE asset_id = $1 AND user_id = $2`,
      values: [assetId, userId],
    });
    return { liked: false, action: "removed" };
  }

  return { liked: alreadyLiked, action: "noop" };
}

async function isLiked(assetId, userId) {
  if (!userId) return false;

  const result = await database.query({
    text: `SELECT 1 FROM asset_likes WHERE asset_id = $1 AND user_id = $2`,
    values: [assetId, userId],
  });
  return result.rowCount > 0;
}

/* =========================================================
 * Comentários
 * ========================================================= */

async function createComment(assetId, userId, content) {
  const text = String(content ?? "").trim();

  if (!text) {
    throw new ValidationError({
      message: "O comentário não pode estar vazio.",
      action: "Escreva um comentário antes de publicar.",
    });
  }

  if (text.length > MAX_COMMENT_LENGTH) {
    throw new ValidationError({
      message: `O comentário deve ter no máximo ${MAX_COMMENT_LENGTH} caracteres.`,
    });
  }

  const assetRow = await findInteractionTarget(assetId);

  const result = await database.query({
    text: `INSERT INTO asset_comments (asset_id, author_id, content) VALUES ($1, $2, $3) RETURNING *`,
    values: [assetId, userId, text],
  });

  await notification.createOrgNotification({
    org_id: assetRow.owner_org_id,
    type: "org_asset_commented",
    source_user_id: userId,
    resource_type: "asset",
    resource_id: assetRow.slug,
    subject_title: assetRow.name,
  });

  return result.rows[0];
}

async function getComments(assetId, userId) {
  const result = await database.query({
    text: `
      SELECT
        c.id,
        c.asset_id,
        c.created_at,
        c.content,
        u.username AS author_username,
        uui.secure_url AS author_avatar_image,
        (c.author_id = $2) AS is_current_user
      FROM asset_comments c
      INNER JOIN users u ON u.id = c.author_id
      LEFT JOIN uploaded_images uui ON uui.id = u.avatar_image
      WHERE c.asset_id = $1
      ORDER BY c.created_at DESC
    `,
    values: [assetId, userId || null],
  });
  return result.rows;
}

async function getCommentById(commentId, userId) {
  const result = await database.query({
    text: `
      SELECT
        c.id,
        c.asset_id,
        c.created_at,
        c.content,
        u.username AS author_username,
        uui.secure_url AS author_avatar_image,
        (c.author_id = $2) AS is_current_user
      FROM asset_comments c
      INNER JOIN users u ON u.id = c.author_id
      LEFT JOIN uploaded_images uui ON uui.id = u.avatar_image
      WHERE c.id = $1
    `,
    values: [commentId, userId || null],
  });
  return result.rows[0];
}

async function deleteComment(commentId) {
  await database.query({ text: `DELETE FROM asset_comments WHERE id = $1`, values: [commentId] });
}

/* =========================================================
 * Avaliações (nota de 1 a 5)
 * ========================================================= */

async function createReview(assetId, userId, { rating, content = null } = {}) {
  const normalizedRating = normalizeRating(rating);

  const existing = await database.query({
    text: `SELECT id FROM asset_reviews WHERE asset_id = $1 AND reviewer_id = $2`,
    values: [assetId, userId],
  });

  if (existing.rows.length > 0) {
    throw new ValidationError({
      message: "Você já avaliou este asset. Use PATCH para editar.",
    });
  }

  const assetRow = await findInteractionTarget(assetId);

  const result = await database.query({
    text: `
      INSERT INTO asset_reviews (asset_id, reviewer_id, rating, content)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    values: [assetId, userId, normalizedRating, normalizeOptionalText(content, MAX_REVIEW_LENGTH)],
  });

  await notification.createOrgNotification({
    org_id: assetRow.owner_org_id,
    type: "org_asset_reviewed",
    source_user_id: userId,
    resource_type: "asset",
    resource_id: assetRow.slug,
    subject_title: assetRow.name,
  });

  return result.rows[0];
}

async function updateReview(reviewId, userId, { rating, content } = {}) {
  const existing = await database.query({
    text: `SELECT * FROM asset_reviews WHERE id = $1`,
    values: [reviewId],
  });

  if (existing.rows.length === 0) {
    throw new NotFoundError({ message: "Avaliação não encontrada." });
  }

  if (existing.rows[0].reviewer_id !== userId) {
    throw new ValidationError({
      message: "Você não pode editar a avaliação de outro usuário.",
    });
  }

  const fields = [];
  const values = [];
  let index = 1;

  if (rating !== undefined) {
    fields.push(`rating = $${index++}`);
    values.push(normalizeRating(rating));
  }

  if (content !== undefined) {
    fields.push(`content = $${index++}`);
    values.push(normalizeOptionalText(content, MAX_REVIEW_LENGTH));
  }

  if (fields.length === 0) {
    return existing.rows[0];
  }

  fields.push("updated_at = now()");
  values.push(reviewId);

  const result = await database.query({
    text: `UPDATE asset_reviews SET ${fields.join(", ")} WHERE id = $${index} RETURNING *`,
    values,
  });

  return result.rows[0];
}

async function getReviews(assetId, { page = 1, limit = 10 } = {}) {
  const offset = (page - 1) * limit;

  const result = await database.query({
    text: `
      SELECT
        r.id, r.rating, r.content, r.created_at, r.updated_at,
        u.username,
        u.resumo AS display_name,
        ui.secure_url AS avatar_url
      FROM asset_reviews r
      JOIN users u ON u.id = r.reviewer_id
      LEFT JOIN uploaded_images ui ON ui.id = u.avatar_image
      WHERE r.asset_id = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `,
    values: [assetId, limit, offset],
  });
  return result.rows;
}

async function getUserReview(assetId, userId) {
  const result = await database.query({
    text: `SELECT * FROM asset_reviews WHERE asset_id = $1 AND reviewer_id = $2`,
    values: [assetId, userId],
  });
  return result.rows[0] || null;
}

/** Dados que a notificação do estúdio precisa (dono + título + slug). */
async function findInteractionTarget(assetId) {
  const result = await database.query({
    text: `SELECT id, slug, name, owner_org_id FROM assets WHERE id = $1`,
    values: [assetId],
  });

  if (!result.rows[0]) {
    throw new NotFoundError({ message: "Asset não encontrado." });
  }

  return result.rows[0];
}

function normalizeRating(raw) {
  const value = Number(raw);

  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new ValidationError({
      message: "A nota deve ser um número inteiro entre 1 e 5.",
    });
  }

  return value;
}

/* =========================================================
 * Capa (upload próprio — o asset em si não é hospedado aqui)
 * ========================================================= */

async function saveCover(slug, imageId) {
  await database.query({
    text: `UPDATE assets SET cover_image_id = $1, updated_at = now() WHERE slug = $2`,
    values: [imageId, slug],
  });
}

async function clearCover(slug) {
  await database.query({
    text: `UPDATE assets SET cover_image_id = NULL, updated_at = now() WHERE slug = $1`,
    values: [slug],
  });
}

/* =========================================================
 * Exclusão
 * ========================================================= */

async function deleteAsset(slug) {
  const found = await database.query({
    text: `SELECT id, cover_image_id FROM assets WHERE slug = $1`,
    values: [slug],
  });

  if (!found.rows[0]) {
    throw new NotFoundError({ message: `Asset "${slug}" não encontrado.` });
  }

  const { id: assetId, cover_image_id: coverImageId } = found.rows[0];

  if (coverImageId) {
    const image = await database.query({
      text: `SELECT public_id FROM uploaded_images WHERE id = $1`,
      values: [coverImageId],
    });

    if (image.rows[0]?.public_id) {
      try {
        await uploadFile.destroyFile(image.rows[0].public_id);
      } catch {
        // Arquivo que já não existe no Cloudinary não pode impedir a exclusão.
      }
    }

    await database.query({ text: `DELETE FROM uploaded_images WHERE id = $1`, values: [coverImageId] });
  }

  // `target_id` é texto e não tem FK: sem isto, denúncias e bloqueios ficariam
  // apontando para um asset que não existe mais.
  await database.query({ text: `DELETE FROM reports WHERE target_type = 'asset' AND target_id = $1::text`, values: [assetId] });
  await database.query({ text: `DELETE FROM moderation_actions WHERE target_type = 'asset' AND target_id = $1::text`, values: [assetId] });

  await database.query({ text: `DELETE FROM assets WHERE id = $1`, values: [assetId] });
}

/* =========================================================
 * Permissões
 * ========================================================= */

/**
 * Quem edita um asset: administrador do site, o criador ou **membro ativo** do
 * estúdio dono — a mesma regra de `book.canEdit`. A tela de configurações já
 * limita a responsável/admin; esta é a regra que vale para qualquer caminho de
 * escrita (API incluída).
 */
async function canEdit(assetId, requestUser) {
  if (!requestUser?.id) return false;
  if (requestUser.features?.includes("read:admin")) return true;

  const result = await database.query({
    text: `
      SELECT 1
      FROM assets a
      LEFT JOIN org_members om
        ON om.org_id = a.owner_org_id
       AND om.member_id = $2
       AND om.status = 'active'
      WHERE a.id = $1
        AND (a.owner_id = $2 OR om.member_id IS NOT NULL)
    `,
    values: [assetId, requestUser.id],
  });

  return result.rows.length > 0;
}

/* =========================================================
 * Validações
 * ========================================================= */

function normalizeName(raw) {
  const value = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";

  if (!value) {
    throw new ValidationError({ message: "O nome do asset é obrigatório." });
  }

  return value.slice(0, 255);
}

function requireExternalUrl(raw) {
  const href = normalizeAssetUrl(raw);

  if (!href) {
    throw new ValidationError({
      message: "Informe a URL externa do asset.",
      action: "O endereço precisa começar com http:// ou https:// e apontar para onde o asset está publicado.",
    });
  }

  return href;
}

function normalizeLicense(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return DEFAULT_ASSET_LICENSE;
  }

  const key = String(raw).trim().toLowerCase();

  if (!ASSET_LICENSES[key]) {
    throw new ValidationError({
      message: "Licença inválida.",
      action: `Informe uma licença válida: ${Object.keys(ASSET_LICENSES).join(", ")}.`,
    });
  }

  return key;
}

function normalizeOptionalText(raw, maxLength) {
  if (raw === undefined || raw === null) return null;

  const value = String(raw).trim();
  if (!value) return null;

  return value.slice(0, maxLength);
}

function parseBoolean(raw, field) {
  if (typeof raw === "boolean") return raw;
  if (raw === "true") return true;
  if (raw === "false") return false;

  throw new ValidationError({ message: `O campo ${field} deve ser booleano.` });
}

function normalizePrice(raw, isFree) {
  if (isFree) return null;
  if (raw === undefined || raw === null || raw === "") return null;

  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    throw new ValidationError({
      message: "Preço inválido.",
      action: "Informe um valor numérico maior ou igual a zero.",
    });
  }

  return Number(value.toFixed(2));
}

const asset = {
  MAX_CATEGORIES_PER_ASSET,
  findAll,
  findBySlug,
  findByOrg,
  findAllForSitemap,
  create,
  update,
  saveCover,
  clearCover,
  deleteAsset,
  canEdit,
  // interações
  setLikes,
  isLiked,
  createComment,
  getComments,
  getCommentById,
  deleteComment,
  createReview,
  updateReview,
  getReviews,
  getUserReview,
};

export default asset;
