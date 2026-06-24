import database from "infra/database.js";
import { ForbiddenError, NotFoundError, ValidationError } from "infra/errors.js";

/* =========================================================
 * List / Search
 * ========================================================= */

async function findAll({ page = 1, limit = 20, search = "", book_type = "", stage = "" } = {}) {
  const offset = (page - 1) * limit;
  const result = await database.query({
    text: `
            SELECT
        b.id, b.slug, b.title, b.subtitle, b.short_description,
        b.book_type, b.stage, b.release_date, b.created_at,
        b.isbn, b.publisher, b.edition, b.pages, b.language,
        b.website_url, b.buy_url, b.content_rating,
        COALESCE(ui.secure_url, b.cover_url_external) AS cover_url,
        o.name               AS studio_name,
        o.slug               AS studio_slug,
        ui_logo.secure_url   AS studio_logo_url,
        COUNT(DISTINCT bf.follower_id) AS follower_count,
        ROUND(AVG(br.rating), 1)       AS avg_rating,
        COUNT(DISTINCT br.id)          AS review_count
      FROM books b
      LEFT JOIN uploaded_images ui      ON ui.id = b.cover_image_id
      LEFT JOIN organizations o         ON o.id = b.owner_org_id
      LEFT JOIN uploaded_images ui_logo ON ui_logo.id = o.img
      LEFT JOIN book_followers bf       ON bf.book_id = b.id
      LEFT JOIN book_reviews br         ON br.book_id = b.id
      WHERE ($3 = '' OR b.title ILIKE '%' || $3 || '%' OR b.short_description ILIKE '%' || $3 || '%')
        AND ($4 = '' OR b.book_type = $4)
        AND ($5 = '' OR b.stage = $5)
      GROUP BY b.id, ui.secure_url, o.name, o.slug, ui_logo.secure_url
      ORDER BY b.created_at DESC
      LIMIT $1 OFFSET $2
    `,
    values: [limit, offset, search, book_type, stage],
  });
  return result.rows;
}

async function findFollowedBy(userId) {
  const result = await database.query({
    text: `
            SELECT
        b.id, b.slug, b.title, b.subtitle, b.short_description,
        b.book_type, b.stage, b.release_date, b.created_at,
        b.isbn, b.publisher, b.edition, b.content_rating,
        COALESCE(ui.secure_url, b.cover_url_external) AS cover_url,
        o.name               AS studio_name,
        o.slug               AS studio_slug,
        ui_logo.secure_url   AS studio_logo_url,
        COUNT(DISTINCT bf.follower_id) AS follower_count,
        ROUND(AVG(br.rating), 1)       AS avg_rating,
        COUNT(DISTINCT br.id)          AS review_count
      FROM book_followers ubf
      JOIN books b                      ON b.id = ubf.book_id
      LEFT JOIN uploaded_images ui      ON ui.id = b.cover_image_id
      LEFT JOIN organizations o         ON o.id = b.owner_org_id
      LEFT JOIN uploaded_images ui_logo ON ui_logo.id = o.img
      LEFT JOIN book_followers bf       ON bf.book_id = b.id
      LEFT JOIN book_reviews br         ON br.book_id = b.id
      WHERE ubf.follower_id = $1
      GROUP BY b.id, ui.secure_url, o.name, o.slug, ui_logo.secure_url
      ORDER BY b.created_at DESC
    `,
    values: [userId],
  });
  return result.rows;
}

async function findBySlug(slug) {
  const result = await database.query({
    text: `
            SELECT
        b.*,
        COALESCE(ui.secure_url, b.cover_url_external) AS cover_url,
        o.name               AS studio_name,
        o.slug               AS studio_slug,
        o.pitch              AS studio_pitch,
        ui_logo.secure_url   AS studio_logo_url,
        u.username           AS owner_username,
        COUNT(DISTINCT bf.follower_id) AS follower_count,
        ROUND(AVG(br.rating), 1)       AS avg_rating,
        COUNT(DISTINCT br.id)          AS review_count
      FROM books b
      LEFT JOIN uploaded_images ui      ON ui.id = b.cover_image_id
      LEFT JOIN organizations o         ON o.id = b.owner_org_id
      LEFT JOIN uploaded_images ui_logo ON ui_logo.id = o.img
      LEFT JOIN users u                 ON u.id = b.owner_id
      LEFT JOIN book_followers bf       ON bf.book_id = b.id
      LEFT JOIN book_reviews br         ON br.book_id = b.id
      WHERE b.slug = $1
      GROUP BY b.id, ui.secure_url, o.name, o.slug, o.pitch, ui_logo.secure_url, u.username
    `,
    values: [slug],
  });

  if (!result.rows[0]) {
    throw new NotFoundError({ message: `Livro/quadrinho "${slug}" não encontrado.` });
  }

  const bookData = result.rows[0];
  const storePages = await findStorePages(bookData.id);
  return { ...bookData, store_pages: storePages };
}

async function findByOrg(orgId) {
  const result = await database.query({
    text: `
            SELECT
        b.id, b.slug, b.title, b.subtitle, b.short_description,
        b.book_type, b.stage, b.release_date, b.created_at,
        b.isbn, b.publisher, b.edition, b.website_url, b.buy_url, b.pdf_url, b.content_rating,
        COALESCE(ui.secure_url, b.cover_url_external) AS cover_url,
        COUNT(DISTINCT bf.follower_id) AS follower_count,
        ROUND(AVG(br.rating), 1)       AS avg_rating,
        COUNT(DISTINCT br.id)          AS review_count
      FROM books b
      LEFT JOIN uploaded_images ui  ON ui.id = b.cover_image_id
      LEFT JOIN book_followers bf   ON bf.book_id = b.id
      LEFT JOIN book_reviews br     ON br.book_id = b.id
      WHERE b.owner_org_id = $1
      GROUP BY b.id, ui.secure_url
      ORDER BY b.created_at DESC
    `,
    values: [orgId],
  });
  return result.rows;
}

/* =========================================================
 * Create / Update
 * ========================================================= */

async function create(userId, orgId, { title, book_type = "book", stage = "concept" }) {
  if (!title?.trim()) {
    throw new ValidationError({ message: "O título é obrigatório." });
  }
  const slug = await generateSlug(title.trim());

  const result = await database.query({
    text: `
      INSERT INTO books (slug, title, book_type, stage, owner_id, owner_org_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    values: [slug, title.trim(), book_type, stage, userId, orgId],
  });
  return result.rows[0];
}

async function update(slug, body) {
  const allowed = [
    "title",
    "subtitle",
    "short_description",
    "description",
    "book_type",
    "stage",
    "isbn",
    "publisher",
    "edition",
    "pages",
    "language",
    "release_date",
    "website_url",
    "buy_url",
    "cover_url_external",
    "pdf_url",
  ];

  const fields = [];
  const values = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in body) {
      fields.push(`${key} = $${idx++}`);
      values.push(body[key] === "" ? null : body[key]);
    }
  }

  if (fields.length === 0) {
    return findBySlug(slug);
  }

  // Handle slug regeneration if title changed
  if (body.title) {
    const newSlug = await generateSlug(body.title.trim(), slug);
    if (newSlug !== slug) {
      fields.push(`slug = $${idx++}`);
      values.push(newSlug);
    }
  }

  fields.push(`updated_at = now()`);
  values.push(slug);

  const result = await database.query({
    text: `UPDATE books SET ${fields.join(", ")} WHERE slug = $${idx} RETURNING *`,
    values,
  });

  if (!result.rows[0]) throw new NotFoundError({ message: "Livro não encontrado." });

  // Atualizar store_pages se fornecido no body (não apenas se array vazio)
  if (Array.isArray(body.store_pages) && body.store_pages.length >= 0) {
    await updateStorePages(result.rows[0].id, body.store_pages);
  }

  return findBySlug(slug);
}

/* =========================================================
 * Cover image (uploaded)
 * ========================================================= */

async function saveCover(slug, imageId) {
  await database.query({
    text: `UPDATE books SET cover_image_id = $1, updated_at = now() WHERE slug = $2`,
    values: [imageId, slug],
  });
}

/* =========================================================
 * Store Pages
 * ========================================================= */

async function findStoreTypes() {
  const result = await database.query({ text: `SELECT id, name FROM book_store ORDER BY id` });
  return result.rows;
}

async function findStorePages(bookId) {
  const result = await database.query({
    text: `
      SELECT bsp.id, bsp.page_url, bsp.price, bs.name AS store_name, bsp.store_type_id
      FROM book_store_page bsp
      LEFT JOIN book_store bs ON bs.id = bsp.store_type_id
      WHERE bsp.book_id = $1
      ORDER BY bsp.id
    `,
    values: [bookId],
  });
  return result.rows;
}

async function updateStorePages(bookId, storePages) {
  await database.query({
    text: `DELETE FROM book_store_page WHERE book_id = $1`,
    values: [bookId],
  });

  for (const sp of storePages) {
    if (!sp.store_type_id || !sp.page_url?.trim()) continue;
    await database.query({
      text: `INSERT INTO book_store_page (book_id, store_type_id, page_url, price) VALUES ($1, $2, $3, $4)`,
      values: [bookId, Number(sp.store_type_id), sp.page_url.trim(), sp.price ?? null],
    });
  }
}

/* =========================================================
 * Follow / Unfollow
 * ========================================================= */

async function followBook(bookId, userId) {
  await database.query({
    text: `INSERT INTO book_followers (book_id, follower_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    values: [bookId, userId],
  });
}

async function unfollowBook(bookId, userId) {
  await database.query({
    text: `DELETE FROM book_followers WHERE book_id = $1 AND follower_id = $2`,
    values: [bookId, userId],
  });
}

async function isFollowing(bookId, userId) {
  const result = await database.query({
    text: `SELECT 1 FROM book_followers WHERE book_id = $1 AND follower_id = $2`,
    values: [bookId, userId],
  });
  return result.rows.length > 0;
}

/* =========================================================
 * Permissions
 * ========================================================= */

async function canEdit(bookId, requestUser) {
  if (!requestUser?.id) return false;
  if (requestUser.features?.includes("read:admin")) return true;

  const result = await database.query({
    text: `
            SELECT 1
      FROM books b
      LEFT JOIN org_members om ON om.org_id = b.owner_org_id AND om.member_id = $2 AND om.status = 'active'
      WHERE b.id = $1
        AND (b.owner_id = $2 OR om.member_id IS NOT NULL)
    `,
    values: [bookId, requestUser.id],
  });
  return result.rows.length > 0;
}

/* =========================================================
 * Slug
 * ========================================================= */

async function generateSlug(name, currentSlug = null) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);

  const existing = await database.query({
    text: `SELECT slug FROM books WHERE slug LIKE $1 AND slug != $2 ORDER BY slug`,
    values: [`${base}%`, currentSlug || ""],
  });

  const slugs = new Set(existing.rows.map((r) => r.slug));
  if (!slugs.has(base)) return base;

  let i = 2;
  while (slugs.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

/* =========================================================
 * Reviews
 * ========================================================= */

async function createReview(bookId, userId, { rating, content = null }) {
  rating = Number(rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError({ message: "A nota deve ser um número inteiro entre 1 e 5." });
  }

  const existing = await database.query({
    text: `SELECT id FROM book_reviews WHERE book_id = $1 AND reviewer_id = $2`,
    values: [bookId, userId],
  });

  if (existing.rows.length > 0) {
    throw new ValidationError({ message: "Você já avaliou este livro/quadrinho. Use PATCH para editar." });
  }

  const result = await database.query({
    text: `
      INSERT INTO book_reviews (book_id, reviewer_id, rating, content)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    values: [bookId, userId, rating, content],
  });
  return result.rows[0];
}

async function updateReview(reviewId, userId, { rating, content }) {
  const existing = await database.query({
    text: `SELECT * FROM book_reviews WHERE id = $1`,
    values: [reviewId],
  });

  if (existing.rows.length === 0) {
    throw new NotFoundError({ message: "Avaliação não encontrada." });
  }

  if (existing.rows[0].reviewer_id !== userId) {
    throw new ForbiddenError({ message: "Você não pode editar a avaliação de outro usuário." });
  }

  const fields = [];
  const values = [];
  let idx = 1;

  if (rating != null) {
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      throw new ValidationError({ message: "A nota deve ser um número inteiro entre 1 e 5." });
    }
    fields.push(`rating = $${idx++}`);
    values.push(r);
  }

  if (content !== undefined) {
    fields.push(`content = $${idx++}`);
    values.push(content);
  }

  if (fields.length === 0) {
    return existing.rows[0];
  }

  fields.push(`updated_at = now()`);
  values.push(reviewId);

  const result = await database.query({
    text: `UPDATE book_reviews SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values,
  });
  return result.rows[0];
}

async function getReviews(bookId, { page = 1, limit = 10 } = {}) {
  const offset = (page - 1) * limit;
  const result = await database.query({
    text: `
      SELECT
        br.id, br.rating, br.content, br.created_at, br.updated_at,
        u.username,
        u.resumo AS display_name,
        ui.secure_url AS avatar_url
      FROM book_reviews br
      JOIN users u ON u.id = br.reviewer_id
      LEFT JOIN uploaded_images ui ON ui.id = u.avatar_image
      WHERE br.book_id = $1
      ORDER BY br.created_at DESC
      LIMIT $2 OFFSET $3
    `,
    values: [bookId, limit, offset],
  });
  return result.rows;
}

async function getUserReview(bookId, userId) {
  const result = await database.query({
    text: `SELECT * FROM book_reviews WHERE book_id = $1 AND reviewer_id = $2`,
    values: [bookId, userId],
  });
  return result.rows[0] || null;
}

const book = {
  findAll,
  findFollowedBy,
  findBySlug,
  findByOrg,
  create,
  update,
  saveCover,
  findStoreTypes,
  followBook,
  unfollowBook,
  isFollowing,
  canEdit,
  createReview,
  updateReview,
  getReviews,
  getUserReview,
};

export default book;
