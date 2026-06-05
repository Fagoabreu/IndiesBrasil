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
        b.website_url, b.buy_url,
        COALESCE(ui.secure_url, b.cover_url_external) AS cover_url,
        o.name               AS studio_name,
        o.slug               AS studio_slug,
        ui_logo.secure_url   AS studio_logo_url,
        COUNT(DISTINCT bf.follower_id) AS follower_count
      FROM books b
      LEFT JOIN uploaded_images ui      ON ui.id = b.cover_image_id
      LEFT JOIN organizations o         ON o.id = b.owner_org_id
      LEFT JOIN uploaded_images ui_logo ON ui_logo.id = o.img
      LEFT JOIN book_followers bf       ON bf.book_id = b.id
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
        b.isbn, b.publisher, b.edition,
        COALESCE(ui.secure_url, b.cover_url_external) AS cover_url,
        o.name               AS studio_name,
        o.slug               AS studio_slug,
        ui_logo.secure_url   AS studio_logo_url,
        COUNT(DISTINCT bf.follower_id) AS follower_count
      FROM book_followers ubf
      JOIN books b                      ON b.id = ubf.book_id
      LEFT JOIN uploaded_images ui      ON ui.id = b.cover_image_id
      LEFT JOIN organizations o         ON o.id = b.owner_org_id
      LEFT JOIN uploaded_images ui_logo ON ui_logo.id = o.img
      LEFT JOIN book_followers bf       ON bf.book_id = b.id
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
        COUNT(DISTINCT bf.follower_id) AS follower_count
      FROM books b
      LEFT JOIN uploaded_images ui      ON ui.id = b.cover_image_id
      LEFT JOIN organizations o         ON o.id = b.owner_org_id
      LEFT JOIN uploaded_images ui_logo ON ui_logo.id = o.img
      LEFT JOIN users u                 ON u.id = b.owner_id
      LEFT JOIN book_followers bf       ON bf.book_id = b.id
      WHERE b.slug = $1
      GROUP BY b.id, ui.secure_url, o.name, o.slug, o.pitch, ui_logo.secure_url, u.username
    `,
    values: [slug],
  });

  if (!result.rows[0]) {
    throw new NotFoundError({ message: `Livro/quadrinho "${slug}" não encontrado.` });
  }
  return result.rows[0];
}

async function findByOrg(orgId) {
  const result = await database.query({
    text: `
      SELECT
        b.id, b.slug, b.title, b.subtitle, b.short_description,
        b.book_type, b.stage, b.release_date, b.created_at,
        b.isbn, b.publisher, b.edition, b.website_url, b.buy_url,
        COALESCE(ui.secure_url, b.cover_url_external) AS cover_url,
        COUNT(DISTINCT bf.follower_id) AS follower_count
      FROM books b
      LEFT JOIN uploaded_images ui  ON ui.id = b.cover_image_id
      LEFT JOIN book_followers bf   ON bf.book_id = b.id
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
  return result.rows[0];
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
      LEFT JOIN org_members om ON om.organization_id = b.owner_org_id AND om.user_id = $2 AND om.status = 'active'
      WHERE b.id = $1
        AND (b.owner_id = $2 OR om.user_id IS NOT NULL)
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

const book = {
  findAll,
  findFollowedBy,
  findBySlug,
  findByOrg,
  create,
  update,
  saveCover,
  followBook,
  unfollowBook,
  isFollowing,
  canEdit,
};

export default book;
