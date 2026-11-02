/**
 * Model: sugestões de profissão.
 *
 * Qualquer usuário autenticado sugere uma profissão que falta no catálogo; o
 * administrador aprova (o que **cria** a profissão) ou recusa. Espelho de
 * `models/serviceSuggestion.js` — a diferença é que a profissão tem ícone, e
 * aprovar exige escolhê-lo.
 *
 * A tabela existe separada de `portfolio_roles` porque a decisão editorial é do
 * admin, mas o conteúdo nasce de quem usa a plataforma: misturar as duas faria a
 * sugestão de um usuário aparecer no seletor de todo perfil antes de alguém
 * olhar.
 */

import database from "infra/database.js";
import { NotFoundError, ValidationError } from "infra/errors";
import profession from "./profession";
import { MAX_PROFESSION_NAME_LENGTH, MAX_PROFESSION_SUGGESTION_LENGTH, isValidProfessionGroup, normalizeProfessionName } from "lib/professionGroups";
import { isValidProfessionIcon } from "lib/professionIcons";

const FIELDS = `
  ps.id, ps.name, ps.justification, ps.status,
  ps.created_at, ps.reviewed_at,
  u.username AS suggested_by_username,
  r.username AS reviewed_by_username`;

const JOINS = `
  FROM profession_suggestions ps
  INNER JOIN users u ON u.id = ps.suggested_by
  LEFT JOIN  users r ON r.id = ps.reviewed_by`;

const STATUSES = ["pending", "approved", "rejected"];

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
      WHERE ps.status = $1
      ORDER BY ps.created_at ASC
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
      WHERE ps.id = $1
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
 * Nome que já é profissão do catálogo (ativa ou não) responde 400 **dizendo
 * qual**: o admin aprovaria uma duplicata sem perceber, e o catálogo passaria a
 * ter dois itens iguais em grupos diferentes. A comparação é por nome
 * normalizado — o mesmo critério do model.
 */
async function create({ name, justification }, userId) {
  const normalizedName = normalizeName(name);
  const existing = await profession.findByKey(normalizedName);

  if (existing) {
    throw new ValidationError({
      message: `A profissão "${existing.name}" já está no catálogo.`,
      action: "Escolha-a no seletor de especialização do seu perfil.",
    });
  }

  const result = await database.query({
    text: `
      WITH inserted AS (
        INSERT INTO profession_suggestions (suggested_by, name, justification)
        VALUES ($1, $2, $3)
        RETURNING *
      )
      SELECT
        ps.id, ps.name, ps.justification, ps.status,
        ps.created_at, ps.reviewed_at,
        u.username AS suggested_by_username,
        NULL::text AS reviewed_by_username
      FROM inserted ps
      INNER JOIN users u ON u.id = ps.suggested_by
    `,
    values: [userId, normalizedName, normalizeJustification(justification)],
  });

  return result.rows[0];
}

/**
 * Aprova ou recusa.
 *
 * Aprovar cria a profissão no catálogo **na mesma chamada**: o admin já leu o
 * nome e escolheu o ícone, e mandá-lo a outro formulário para redigitar é o tipo
 * de passo que faz a fila nunca ser esvaziada.
 *
 * O ícone é obrigatório porque não há como inferi-lo: sem ele, o perfil de quem
 * declarar a profissão mostraria uma imagem quebrada (ver `lib/professionIcons`).
 *
 * Só sugestão `pending` pode ser revista — reaprovar criaria uma segunda
 * profissão com o mesmo nome.
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

  if (!isValidProfessionGroup(groupKey)) {
    throw new ValidationError({
      message: "Informe o grupo da nova profissão.",
      action: "Escolha um dos grupos disponíveis na tela.",
    });
  }

  const icon = typeof body.icon_img === "string" ? body.icon_img.trim() : "";

  if (!isValidProfessionIcon(icon)) {
    throw new ValidationError({
      message: "Escolha o ícone da nova profissão.",
      action: "O ícone é usado no perfil de quem declarar a especialidade.",
    });
  }

  // A profissão é criada ANTES de marcar a sugestão: se a criação falhar (nome
  // duplicado que apareceu nesse meio-tempo), a sugestão continua `pending` para
  // o admin resolver, em vez de ficar aprovada sem profissão nenhuma.
  await profession.create({
    name: body.name?.trim() || suggestion.name,
    icon_img: icon,
    description: body.description,
    group_key: groupKey,
    display_order: body.display_order,
  });

  return markReviewed(id, { status: "approved" }, reviewerId);
}

async function markReviewed(id, { status }, reviewerId) {
  const result = await database.query({
    text: `
      UPDATE profession_suggestions
      SET status = $2, reviewed_by = $3, reviewed_at = now()
      WHERE id = $1
      RETURNING id
    `,
    values: [id, status, reviewerId],
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

function normalizeJustification(raw) {
  if (raw === undefined || raw === null) return null;

  const value = String(raw).trim();
  if (!value) return null;

  return value.slice(0, MAX_PROFESSION_SUGGESTION_LENGTH);
}

const professionSuggestion = {
  findAll,
  findById,
  create,
  review,
};

export default professionSuggestion;
