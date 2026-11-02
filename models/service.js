/**
 * Model: catálogo de serviços.
 *
 * Os serviços são **dados** (esta tabela), cadastrados pelo administrador em
 * `/admin/services` e sugeridos por qualquer usuário autenticado; os grupos são
 * estrutura fixa (`lib/serviceGroups.js`). A separação é a mesma das categorias
 * de asset, e o motivo também: o grupo é a única coisa que só o código sabe
 * renderizar.
 *
 * Um serviço **em uso** não é excluído, e sim desativado. `is_active = false` o
 * tira do seletor e dos filtros mas preserva os vínculos `organization_services`
 * — apagá-lo removeria a declaração de todos os estúdios sem ninguém pedir.
 */

import database from "infra/database.js";
import { NotFoundError, ValidationError } from "infra/errors.js";
import { generateUniqueSlug } from "lib/slug";
import { SERVICE_GROUP_KEYS, isValidServiceGroup } from "lib/serviceGroups";

const FIELDS = `
  id, slug, name, description, group_key, display_order, is_active,
  created_at, updated_at`;

/** Quantos estúdios declaram cada serviço — o número que admin e chips mostram. */
const USAGE_SELECT = `
  (SELECT count(*)::int FROM organization_services os WHERE os.service_id = s.id) AS usage_count`;

/**
 * Lista o catálogo.
 *
 * @param {object} [options]
 * @param {boolean} [options.includeInactive] — só faz sentido para o admin; a
 *   listagem pública precisa apenas dos ativos.
 * @param {string} [options.group] — chave de grupo (já validada pela rota).
 */
async function findAll({ includeInactive = false, group = "" } = {}) {
  const result = await database.query({
    text: `
      SELECT
        s.id, s.slug, s.name, s.description, s.group_key,
        s.display_order, s.is_active, s.created_at, s.updated_at,
        ${USAGE_SELECT}
      FROM services s
      WHERE ($1::boolean OR s.is_active)
        AND ($2 = '' OR s.group_key = $2)
      ORDER BY s.group_key, s.display_order, s.name
    `,
    values: [includeInactive, group],
  });
  return result.rows;
}

async function findById(id) {
  const result = await database.query({
    text: `SELECT ${FIELDS} FROM services WHERE id = $1`,
    values: [id],
  });

  if (!result.rows[0]) {
    throw new NotFoundError({ message: "Serviço não encontrado." });
  }

  return result.rows[0];
}

/** Linha crua (inclusive inativa), ou `null` — usado para validar filtros. */
async function findBySlug(slug) {
  const result = await database.query({
    text: `SELECT ${FIELDS} FROM services WHERE slug = $1`,
    values: [slug],
  });
  return result.rows[0] ?? null;
}

async function create({ name, description, group_key, display_order = 0 }) {
  const normalizedName = normalizeName(name);
  const groupKey = normalizeGroupKey(group_key);
  const slug = await generateUniqueSlug(normalizedName, "services", "slug", null, 60);

  const result = await database.query({
    text: `
      INSERT INTO services (slug, name, description, group_key, display_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING ${FIELDS}
    `,
    values: [slug, normalizedName, normalizeDescription(description), groupKey, normalizeDisplayOrder(display_order)],
  });

  return result.rows[0];
}

/**
 * Atualiza o catálogo.
 *
 * `slug` **não** é regenerado quando o nome muda: o endereço do serviço está em
 * `?servico=` de links compartilhados e em `organization_services`, e renomear
 * "Portabilidade" para "Portabilidade Multiplataforma" não deveria quebrar o
 * filtro que alguém colou no Twitter.
 */
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
    text: `UPDATE services SET ${fields.join(", ")} WHERE id = $${index} RETURNING ${FIELDS}`,
    values,
  });

  if (!result.rows[0]) {
    throw new NotFoundError({ message: "Serviço não encontrado." });
  }

  return result.rows[0];
}

/**
 * Exclui um serviço **sem uso**.
 *
 * Em uso, a resposta é 400 com a contagem: cascata removeria a declaração de
 * estúdios que não pediram nada, e eles perderiam a referência de por que
 * ofereciam aquele serviço. Para aposentar, desative.
 */
async function deleteService(id) {
  const usage = await countStudios(id);

  if (usage > 0) {
    throw new ValidationError({
      message: `Este serviço está em uso por ${usage} ${usage === 1 ? "estúdio" : "estúdios"}.`,
      action: "Desative o serviço em vez de excluí-lo.",
    });
  }

  const result = await database.query({
    text: `DELETE FROM services WHERE id = $1 RETURNING ${FIELDS}`,
    values: [id],
  });

  if (!result.rowCount) {
    throw new NotFoundError({ message: "Serviço não encontrado." });
  }

  return result.rows[0];
}

async function countStudios(id) {
  const result = await database.query({
    text: `SELECT count(*)::int AS total FROM organization_services WHERE service_id = $1`,
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
      message: "O nome do serviço deve ter entre 2 e 80 caracteres.",
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

  if (!isValidServiceGroup(value)) {
    throw new ValidationError({
      message: "Grupo de serviço inválido.",
      action: `Informe um dos grupos: ${SERVICE_GROUP_KEYS.join(", ")}.`,
    });
  }

  return value;
}

function normalizeDisplayOrder(raw) {
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const service = {
  findAll,
  findById,
  findBySlug,
  create,
  update,
  deleteService,
  countStudios,
};

export default service;
