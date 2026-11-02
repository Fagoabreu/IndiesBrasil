/**
 * Model: catálogo de profissões.
 *
 * As profissões são **dados** (esta tabela), cadastradas pelo administrador em
 * `/admin/professions` e sugeridas por qualquer usuário autenticado; os grupos
 * são estrutura fixa (`lib/professionGroups.js`). Mesmo desenho de `services` —
 * inclusive a regra de que profissão **em uso não é excluída, é desativada**.
 *
 * ## O que mudou, e por quê
 *
 * `portfolio_roles.name` era um enum `developer_role`, e a migration de seed
 * inseriu todos os valores do enum na tabela. Consequência: `create` colidia
 * sempre com a primary key e o endpoint respondia 500 — a tela de admin nunca
 * cadastrou nada. A migration `1793750400000` converteu a coluna para texto.
 *
 * Com texto, a unicidade deixa de vir da semântica do banco: a comparação é
 * feita aqui, por **nome normalizado** (`professionKey`), senão "Programador de
 * Jogos" e "programador de jogos" viram duas linhas.
 */

import database from "infra/database.js";
import { NotFoundError, ValidationError } from "infra/errors";
import {
  DEFAULT_PROFESSION_GROUP,
  MAX_PROFESSION_NAME_LENGTH,
  isValidProfessionGroup,
  normalizeProfessionName,
  professionKey,
} from "lib/professionGroups";
import { isValidProfessionIcon } from "lib/professionIcons";

const FIELDS = `
  p.name, p.icon_img, p.description, p.group_key, p.display_order, p.is_active,
  p.created_at, p.updated_at`;

/**
 * Quantos perfis declaram cada profissão.
 *
 * `portfolio_role_ref` referencia por **nome** (não por id), então é esta coluna
 * que liga catálogo e perfil — e é por isso que renomear exige `ON UPDATE
 * CASCADE`.
 */
const USAGE_SELECT = `
  (SELECT count(*)::int FROM portfolio_role_ref r WHERE r.portfolio_role_name = p.name) AS usage_count`;

/**
 * Lista o catálogo.
 *
 * @param {object} [options]
 * @param {boolean} [options.includeInactive] — só o admin precisa; o seletor do
 *   perfil e o formulário de sugestão trabalham com as ativas.
 * @param {string} [options.group] — chave de grupo (já validada pela rota).
 */
async function findAll({ includeInactive = false, group = "" } = {}) {
  const result = await database.query({
    text: `
      SELECT
        ${FIELDS},
        ${USAGE_SELECT}
      FROM portfolio_roles p
      WHERE ($1::boolean OR p.is_active)
        AND ($2 = '' OR p.group_key = $2)
      ORDER BY p.group_key, p.display_order, p.name
    `,
    values: [includeInactive, group],
  });
  return result.rows;
}

/** Linha crua (inclusive inativa), ou `null`. */
async function findByName(name) {
  const result = await database.query({
    text: `SELECT ${FIELDS} FROM portfolio_roles p WHERE p.name = $1`,
    values: [name],
  });
  return result.rows[0] ?? null;
}

/** Alguma linha usa este nome, ignorando caixa e acento? */
async function findByKey(name) {
  const result = await database.query({ text: `SELECT ${FIELDS} FROM portfolio_roles p` });
  const target = professionKey(name);

  return result.rows.find((row) => professionKey(row.name) === target) ?? null;
}

async function create({ name, icon_img, description, group_key, display_order = 0 }) {
  const normalizedName = normalizeName(name);
  const icon = normalizeIcon(icon_img);
  const groupKey = normalizeGroupKey(group_key);

  const existing = await findByKey(normalizedName);

  if (existing) {
    throw new ValidationError({
      message: `A profissão "${existing.name}" já está no catálogo.`,
      action: "Escolha-a no seletor de especialização em vez de cadastrar de novo.",
    });
  }

  const result = await database.query({
    text: `
      INSERT INTO portfolio_roles (name, icon_img, description, group_key, display_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING name, icon_img, description, group_key, display_order, is_active, created_at, updated_at
    `,
    values: [normalizedName, icon, normalizeDescription(description), groupKey, normalizeDisplayOrder(display_order)],
  });

  return result.rows[0];
}

/**
 * Atualiza uma profissão.
 *
 * Renomear chega ao perfil de quem a declarou pelo `ON UPDATE CASCADE` da FK em
 * `portfolio_role_ref` — sem isso a alteração só valeria para cadastros novos, e
 * os existentes apontariam para um nome que não existe mais.
 *
 * O nome novo também passa pela checagem de duplicata: trocar "Escritor" para
 * "Designer de Jogos" com a segunda já existindo violaria a primary key e
 * viraria 500.
 */
async function update(name, body = {}) {
  const existing = await findByName(name);

  if (!existing) {
    throw new NotFoundError({ message: "Profissão não encontrada." });
  }

  const fields = [];
  const values = [];
  let index = 1;

  if ("name" in body) {
    const newName = normalizeName(body.name);

    if (professionKey(newName) !== professionKey(name)) {
      const clash = await findByKey(newName);
      if (clash) {
        throw new ValidationError({
          message: `A profissão "${clash.name}" já está no catálogo.`,
        });
      }
    }

    fields.push(`name = $${index++}`);
    values.push(newName);
  }

  if ("icon_img" in body) {
    fields.push(`icon_img = $${index++}`);
    values.push(normalizeIcon(body.icon_img));
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
  values.push(name);

  const result = await database.query({
    text: `UPDATE portfolio_roles SET ${fields.join(", ")} WHERE name = $${index} RETURNING name, icon_img, description, group_key, display_order, is_active, created_at, updated_at`,
    values,
  });

  return result.rows[0];
}

/**
 * Exclui uma profissão **sem uso**.
 *
 * Em uso, a resposta é 400 com a contagem: cascata removeria a especialidade do
 * perfil de quem a declarou sem ninguém pedir — e `portfolio_role_ref` é
 * `ON DELETE RESTRICT`, então o banco recusaria de qualquer forma (a checagem
 * aqui só transforma o erro em mensagem útil).
 */
async function deleteProfession(name) {
  const usage = await countUsers(name);

  if (usage > 0) {
    throw new ValidationError({
      message: `Esta profissão está em uso por ${usage} ${usage === 1 ? "perfil" : "perfis"}.`,
      action: "Desative a profissão em vez de excluí-la.",
    });
  }

  const result = await database.query({
    text: `DELETE FROM portfolio_roles WHERE name = $1 RETURNING name`,
    values: [name],
  });

  if (!result.rowCount) {
    throw new NotFoundError({ message: "Profissão não encontrada." });
  }

  return { name };
}

async function countUsers(name) {
  const result = await database.query({
    text: `SELECT count(*)::int AS total FROM portfolio_role_ref WHERE portfolio_role_name = $1`,
    values: [name],
  });
  return result.rows[0].total;
}

/* =========================================================
 * Validações
 * ========================================================= */

function normalizeName(raw) {
  const value = normalizeProfessionName(raw);

  if (!value) {
    throw new ValidationError({ message: "O nome da profissão é obrigatório." });
  }

  if (value.length > MAX_PROFESSION_NAME_LENGTH) {
    throw new ValidationError({
      message: `O nome da profissão deve ter no máximo ${MAX_PROFESSION_NAME_LENGTH} caracteres.`,
    });
  }

  return value;
}

/**
 * O ícone precisa existir em `public/images/professions/`.
 *
 * Sem esta checagem, `icon_img` vira `src` de um arquivo que não existe e a
 * imagem quebra no perfil — sem nenhum aviso para quem cadastrou.
 */
function normalizeIcon(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";

  if (!value) {
    throw new ValidationError({ message: "O ícone da profissão é obrigatório." });
  }

  if (!isValidProfessionIcon(value)) {
    throw new ValidationError({
      message: "Ícone de profissão inválido.",
      action: "Escolha um dos ícones disponíveis na lista.",
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
  if (raw === undefined || raw === null || raw === "") return DEFAULT_PROFESSION_GROUP;

  const value = String(raw).trim();

  if (!isValidProfessionGroup(value)) {
    throw new ValidationError({
      message: "Grupo de profissão inválido.",
    });
  }

  return value;
}

function normalizeDisplayOrder(raw) {
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const profession = {
  findAll,
  findByName,
  findByKey,
  create,
  update,
  deleteProfession,
  countUsers,
};

export default profession;
