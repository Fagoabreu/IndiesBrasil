import database from "infra/database.js";
import { NotFoundError, ValidationError } from "infra/errors.js";
import { generateUniqueSlug } from "lib/slug";
import { ASSET_GROUP_KEYS, isValidGroupKey } from "lib/assetGroups";

/**
 * Model: Categorias de asset.
 *
 * A taxonomia é **fixa em dois níveis**: os seis grupos vivem em
 * `lib/assetGroups.js` (estrutura de apresentação) e as categorias vivem nesta
 * tabela, cadastradas pelo administrador em `/admin/asset-categories` — mesmo
 * padrão de profissões e tipos de contato.
 *
 * Um asset pode ter várias categorias (`asset_category_links`). A categoria é
 * **desativada**, não excluída, quando ainda está em uso: excluir apagaria a
 * classificação de assets existentes sem ninguém pedir.
 */

const FIELDS = `
  id, slug, name, description, group_key, display_order, is_active,
  created_at, updated_at`;

/** Quantos assets usam cada categoria — o número que a tela de admin mostra. */
const USAGE_SELECT = `
  (SELECT count(*)::int FROM asset_category_links l WHERE l.category_id = c.id) AS usage_count`;

async function findAll({ includeInactive = false } = {}) {
  const result = await database.query({
    text: `
      SELECT
        c.id, c.slug, c.name, c.description, c.group_key,
        c.display_order, c.is_active, c.created_at, c.updated_at,
        ${USAGE_SELECT}
      FROM asset_categories c
      WHERE ($1::boolean OR c.is_active)
      ORDER BY c.group_key, c.display_order, c.name
    `,
    values: [includeInactive],
  });
  return result.rows;
}

async function findById(id) {
  const result = await database.query({
    text: `SELECT ${FIELDS} FROM asset_categories WHERE id = $1`,
    values: [id],
  });

  if (!result.rows[0]) {
    throw new NotFoundError({ message: "Categoria de asset não encontrada." });
  }

  return result.rows[0];
}

/** Linha crua (inclusive inativa), ou `null` — usado para validar filtros. */
async function findBySlug(slug) {
  const result = await database.query({
    text: `SELECT ${FIELDS} FROM asset_categories WHERE slug = $1`,
    values: [slug],
  });
  return result.rows[0] ?? null;
}

async function create({ name, description, group_key, display_order = 0 }) {
  const normalizedName = normalizeName(name);
  const groupKey = normalizeGroupKey(group_key);
  const slug = await generateUniqueSlug(normalizedName, "asset_categories", "slug", null, 60);

  const result = await database.query({
    text: `
      INSERT INTO asset_categories (slug, name, description, group_key, display_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING ${FIELDS}
    `,
    values: [slug, normalizedName, normalizeDescription(description), groupKey, normalizeDisplayOrder(display_order)],
  });

  return result.rows[0];
}

async function update(id, body = {}) {
  const existing = await findById(id);

  const fields = [];
  const values = [];
  let index = 1;

  if ("name" in body) {
    fields.push(`name = $${index++}`);
    values.push(normalizeName(body.name));
  }

  if ("description" in body) {
    fields.push(`description = $${index++}`);
    values.push(normalizeDescription(body.description));
  }

  if ("group_key" in body) {
    fields.push(`group_key = $${index++}`);
    values.push(normalizeGroupKey(body.group_key));
  }

  if ("display_order" in body) {
    fields.push(`display_order = $${index++}`);
    values.push(normalizeDisplayOrder(body.display_order));
  }

  if ("is_active" in body) {
    fields.push(`is_active = $${index++}`);
    values.push(Boolean(body.is_active));
  }

  if (fields.length === 0) {
    return existing;
  }

  fields.push("updated_at = now()");
  values.push(id);

  const result = await database.query({
    text: `UPDATE asset_categories SET ${fields.join(", ")} WHERE id = $${index} RETURNING ${FIELDS}`,
    values,
  });

  if (!result.rows[0]) {
    throw new NotFoundError({ message: "Categoria de asset não encontrada." });
  }

  return result.rows[0];
}

/**
 * Exclui uma categoria **sem uso**.
 *
 * Em uso, a resposta é 400 com a contagem: a alternativa (cascata) removeria a
 * classificação de assets existentes sem que ninguém tivesse pedido, e o admin
 * perderia a referência de por que aquela categoria existia. Para aposentar uma
 * categoria, desative-a.
 */
async function deleteCategory(id) {
  const usage = await countAssets(id);

  if (usage > 0) {
    throw new ValidationError({
      message: `Esta categoria está em uso por ${usage} ${usage === 1 ? "asset" : "assets"}.`,
      action: "Desative a categoria em vez de excluí-la.",
    });
  }

  const result = await database.query({
    text: `DELETE FROM asset_categories WHERE id = $1 RETURNING ${FIELDS}`,
    values: [id],
  });

  if (!result.rowCount) {
    throw new NotFoundError({ message: "Categoria de asset não encontrada." });
  }

  return result.rows[0];
}

async function countAssets(id) {
  const result = await database.query({
    text: `SELECT count(*)::int AS total FROM asset_category_links WHERE category_id = $1`,
    values: [id],
  });
  return result.rows[0].total;
}

/* =========================================================
 * Validações
 * ========================================================= */

function normalizeName(raw) {
  const value = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";

  if (value.length < 2 || value.length > 80) {
    throw new ValidationError({
      message: "O nome da categoria deve ter entre 2 e 80 caracteres.",
    });
  }

  return value;
}

function normalizeDescription(raw) {
  if (raw === undefined || raw === null) return null;

  const value = String(raw).trim();
  if (!value) return null;

  return value.slice(0, 255);
}

function normalizeGroupKey(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";

  if (!isValidGroupKey(value)) {
    throw new ValidationError({
      message: "Grupo de categoria inválido.",
      action: `Informe um dos grupos: ${ASSET_GROUP_KEYS.join(", ")}.`,
    });
  }

  return value;
}

function normalizeDisplayOrder(raw) {
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const assetCategory = {
  findAll,
  findById,
  findBySlug,
  create,
  update,
  deleteCategory,
  countAssets,
};

export default assetCategory;
