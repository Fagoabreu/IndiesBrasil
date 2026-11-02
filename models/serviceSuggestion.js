/**
 * Model: sugestões de serviço.
 *
 * Qualquer usuário autenticado sugere um serviço que falta no catálogo;
 * o administrador aprova (o que **cria** o serviço) ou recusa. A tabela existe
 * separada de `services` porque a decisão editorial é do admin, mas o conteúdo
 * nasce de quem usa a plataforma — misturar as duas faria a sugestão de um
 * usuário aparecer no seletor de todo estúdio antes de alguém olhar.
 */

import database from "infra/database.js";
import { NotFoundError, ValidationError } from "infra/errors.js";
import service from "./service";
import { SERVICE_GROUP_KEYS, isValidServiceGroup } from "lib/serviceGroups";

const FIELDS = `
  ss.id, ss.name, ss.justification, ss.status, ss.service_id,
  ss.created_at, ss.reviewed_at,
  u.username AS suggested_by_username,
  r.username AS reviewed_by_username`;

const JOINS = `
  FROM service_suggestions ss
  INNER JOIN users u ON u.id = ss.suggested_by
  LEFT JOIN  users r ON r.id = ss.reviewed_by`;

const STATUSES = ["pending", "approved", "rejected"];

const MAX_NAME_LENGTH = 80;
const MAX_JUSTIFICATION_LENGTH = 500;

async function findAll({ status = "pending" } = {}) {
  if (!STATUSES.includes(status)) {
    throw new ValidationError({
      message: `Status inválido: "${status}".`,
      action: `Use um destes: ${STATUSES.join(", ")}.`,
    });
  }

  const result = await database.query({
    text: `
      SELECT ${FIELDS}
      ${JOINS}
      WHERE ss.status = $1
      ORDER BY ss.created_at ASC
    `,
    values: [status],
  });

  return result.rows;
}

async function findById(id) {
  const result = await database.query({
    text: `
      SELECT ${FIELDS}
      ${JOINS}
      WHERE ss.id = $1
    `,
    values: [id],
  });

  if (!result.rows[0]) {
    throw new NotFoundError({ message: "Sugestão não encontrada." });
  }

  return result.rows[0];
}

/**
 * Cria uma sugestão pendente.
 *
 * Nome que já é serviço do catálogo (ativo ou não) responde 400 **dizendo qual**:
 * o admin aprovaria uma duplicata sem perceber, e o catálogo passaria a ter dois
 * serviços iguais em grupos diferentes.
 *
 * A comparação é pelo **nome normalizado**, não pelo slug: os serviços do seed
 * têm slug próprio (`qa-testes` para "QA e Testes de Bugs"), então derivar o
 * slug do nome sugerido nunca casaria com o catálogo e a duplicata passaria.
 */
async function create({ name, justification }, userId) {
  const normalizedName = normalizeName(name);
  const existing = await findExistingByName(normalizedName);

  if (existing) {
    throw new ValidationError({
      message: `O serviço "${existing.name}" já está no catálogo.`,
      action: "Escolha-o na lista do seu estúdio em vez de sugerir.",
    });
  }

  const result = await database.query({
    text: `
      WITH inserted AS (
        INSERT INTO service_suggestions (suggested_by, name, justification)
        VALUES ($1, $2, $3)
        RETURNING *
      )
      SELECT
        ss.id, ss.name, ss.justification, ss.status, ss.service_id,
        ss.created_at, ss.reviewed_at,
        u.username AS suggested_by_username,
        NULL::text AS reviewed_by_username
      FROM inserted ss
      INNER JOIN users u ON u.id = ss.suggested_by
    `,
    values: [userId, normalizedName, normalizeJustification(justification)],
  });

  return result.rows[0];
}

/**
 * Aprova ou recusa.
 *
 * Aprovar cria o serviço no catálogo **na mesma chamada**: o admin já leu o
 * nome, e mandá-lo a outro formulário para redigitar é o tipo de passo que faz
 * a fila de sugestões nunca ser esvaziada.
 *
 * Só sugestão `pending` pode ser revista — reaprovar criaria um segundo serviço
 * com o mesmo nome.
 */
async function review(id, body = {}, reviewerId) {
  const suggestion = await findById(id);

  if (suggestion.status !== "pending") {
    throw new ValidationError({
      message: `Esta sugestão já foi ${suggestion.status === "approved" ? "aprovada" : "recusada"}.`,
    });
  }

  const status = body.status;

  if (status !== "approved" && status !== "rejected") {
    throw new ValidationError({
      message: 'Informe `status: "approved"` ou `status: "rejected"`.',
    });
  }

  if (status === "rejected") {
    return markReviewed(id, { status: "rejected" }, reviewerId);
  }

  const groupKey = typeof body.group_key === "string" ? body.group_key.trim() : "";

  if (!isValidServiceGroup(groupKey)) {
    throw new ValidationError({
      message: "Informe o grupo do novo serviço.",
      action: `Use um destes: ${SERVICE_GROUP_KEYS.join(", ")}.`,
    });
  }

  // O serviço é criado ANTES de marcar a sugestão: se a criação falhar (nome
  // duplicado que apareceu nesse meio-tempo), a sugestão continua `pending` para
  // o admin resolver, em vez de ficar aprovada sem serviço nenhum.
  const created = await service.create({
    name: body.name?.trim() || suggestion.name,
    description: body.description,
    group_key: groupKey,
    display_order: body.display_order,
  });

  return markReviewed(id, { status: "approved", service_id: created.id }, reviewerId);
}

async function markReviewed(id, { status, service_id = null }, reviewerId) {
  const result = await database.query({
    text: `
      UPDATE service_suggestions
      SET status = $2, service_id = $3, reviewed_by = $4, reviewed_at = now()
      WHERE id = $1
      RETURNING id
    `,
    values: [id, status, service_id, reviewerId],
  });

  if (!result.rowCount) {
    throw new NotFoundError({ message: "Sugestão não encontrada." });
  }

  return findById(id);
}

/* =========================================================
 * Validações
 * ========================================================= */

function normalizeName(raw) {
  const value = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";

  if (value.length < 2 || value.length > MAX_NAME_LENGTH) {
    throw new ValidationError({
      message: `O nome do serviço deve ter entre 2 e ${MAX_NAME_LENGTH} caracteres.`,
    });
  }

  return value;
}

function normalizeJustification(raw) {
  if (raw === undefined || raw === null) return null;

  const value = String(raw).trim();
  if (!value) return null;

  return value.slice(0, MAX_JUSTIFICATION_LENGTH);
}

/**
 * Slug a partir do nome, só para procurar duplicata.
 *
 * Não é o slug que a criação vai usar (`generateUniqueSlug` resolve colisão de
 * verdade) — aqui basta a forma canônica para reconhecer "QA" e "QA " como o
 * mesmo pedido.
 */
/**
 * Serviço do catálogo com o mesmo nome, ou `null`.
 *
 * Compara nome **normalizado** (sem acento, minúsculo, espaços colapsados) em
 * vez de slug: o slug é próprio de cada serviço (`qa-testes`, `gaas`,
 * `publicacao`) e derivá-lo do nome sugerido nunca casaria — foi assim que
 * "QA e Testes de Bugs" passou como duplicata aceita.
 *
 * A lista é buscada inteira porque o catálogo é pequeno por desenho (dezenas de
 * linhas) e a comparação precisa acontecer onde o acento existe: fazer isso em
 * SQL exigiria a extensão `unaccent`, que não está instalada.
 */
async function findExistingByName(name) {
  const result = await database.query({ text: `SELECT id, name FROM services` });
  const target = normalizeForCompare(name);

  return result.rows.find((row) => normalizeForCompare(row.name) === target) ?? null;
}

/** Forma comparável do nome: sem acento, minúsculo, sem espaços repetidos. */
function normalizeForCompare(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const serviceSuggestion = {
  findAll,
  findById,
  create,
  review,
};

export default serviceSuggestion;
