import crypto from "node:crypto";
import database from "infra/database";
import { NotFoundError, ValidationError, ForbiddenError } from "@/infra/errors";

/* ================================================================
 * CONSTANTES & HELPERS
 * ================================================================ */

const VALID_STATUSES = new Set(["scheduled", "live", "ended", "cancelled"]);

/**
 * Gera um identificador de sala para o Galene.
 * Usado como nome do grupo (`groups/<room_id>.json`) e como audiência
 * do JWT (`aud: "/group/<room_id>/"`).
 */
function generateRoomId() {
  return crypto.randomBytes(16).toString("hex");
}

/** Converte data em Date válido ou lança ValidationError. */
function parseDate(value, fieldLabel) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError({ message: `Data inválida para "${fieldLabel}".` });
  }
  return date;
}

/* ================================================================
 * QUERIES
 * ================================================================ */

const BASE_MEETING_QUERY = `
  SELECT
    m.*,
    o.slug              AS org_slug,
    o.name              AS org_name,
    u.username          AS created_by_username
  FROM meetings m
  INNER JOIN organizations o ON o.id = m.org_id
  INNER JOIN users u ON u.id = m.created_by
`;

/**
 * Cria uma reunião agendada para um estúdio (organization).
 * @param {{ org_id: string, title: string, description?: string, starts_at: string|Date, ends_at: string|Date, max_participants?: number }} data
 * @param {string} userId
 */
async function create(data, userId) {
  if (!data.org_id) {
    throw new ValidationError({ message: "O estúdio (org_id) é obrigatório." });
  }
  if (!data.title?.trim()) {
    throw new ValidationError({ message: "O título da reunião é obrigatório." });
  }

  const startsAt = parseDate(data.starts_at, "início");
  const endsAt = parseDate(data.ends_at, "término");

  if (!startsAt || !endsAt) {
    throw new ValidationError({
      message: "Informe as datas de início e término da reunião.",
    });
  }
  if (endsAt <= startsAt) {
    throw new ValidationError({
      message: "O término da reunião não pode ser anterior ou igual ao início.",
    });
  }

  const roomId = generateRoomId();

  const result = await database.query({
    text: `
      INSERT INTO meetings (
        org_id, created_by, title, description, room_id,
        starts_at, ends_at, max_participants
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `,
    values: [data.org_id, userId, data.title.trim(), data.description || null, roomId, startsAt, endsAt, data.max_participants ?? null],
  });

  return findById(result.rows[0].id);
}

/**
 * Busca uma reunião por id.
 * @param {string} id
 */
async function findById(id) {
  const result = await database.query({
    text: `${BASE_MEETING_QUERY} WHERE m.id = $1`,
    values: [id],
  });

  if (!result.rowCount) {
    throw new NotFoundError({ message: "Reunião não encontrada." });
  }

  return result.rows[0];
}

/**
 * Busca uma reunião pelo room_id do Galene.
 * @param {string} roomId
 */
async function findByRoomId(roomId) {
  const result = await database.query({
    text: `${BASE_MEETING_QUERY} WHERE m.room_id = $1`,
    values: [roomId],
  });

  if (!result.rowCount) {
    throw new NotFoundError({ message: "Reunião não encontrada." });
  }

  return result.rows[0];
}

/**
 * Lista reuniões de um estúdio, ordenadas por data de início.
 * @param {string} orgId
 * @param {{ status?: string, includePast?: boolean }} [opts]
 */
async function listByOrgId(orgId, opts = {}) {
  const { status, includePast = false } = opts;

  const values = [orgId];
  const clauses = ["m.org_id = $1"];

  if (status) {
    if (!VALID_STATUSES.has(status)) {
      throw new ValidationError({ message: "Status de reunião inválido." });
    }
    values.push(status);
    clauses.push(`m.status = $${values.length}`);
  }

  if (!includePast) {
    clauses.push("m.ends_at >= NOW()");
  }

  const result = await database.query({
    text: `
      ${BASE_MEETING_QUERY}
      WHERE ${clauses.join(" AND ")}
      ORDER BY m.starts_at ASC
    `,
    values,
  });

  return result.rows;
}

/**
 * Atualiza uma reunião. Apenas o criador, admin ou owner do estúdio podem editar.
 * @param {string} id
 * @param {object} data
 * @param {string} userId
 */
async function update(id, data, userId) {
  const meeting = await findById(id);

  await assertCanManage(meeting, userId);

  if (meeting.status === "cancelled") {
    throw new ValidationError({
      message: "Não é possível editar uma reunião cancelada.",
    });
  }

  const allowed = ["title", "description", "starts_at", "ends_at", "max_participants"];
  const sets = [];
  const values = [];

  for (const key of allowed) {
    if (key in data) {
      if (key === "starts_at" || key === "ends_at") {
        const parsed = parseDate(data[key], key);
        if (!parsed) {
          throw new ValidationError({ message: `Informe a data de ${key}.` });
        }
        values.push(parsed);
      } else {
        values.push(data[key]);
      }
      sets.push(`${key} = $${values.length}`);
    }
  }

  if (!sets.length) return meeting;

  // Revalida a relação entre as datas após as mudanças.
  const startsAt = parseDate(data.starts_at ?? meeting.starts_at, "início");
  const endsAt = parseDate(data.ends_at ?? meeting.ends_at, "término");
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new ValidationError({
      message: "O término da reunião não pode ser anterior ou igual ao início.",
    });
  }

  values.push(id);
  await database.query({
    text: `UPDATE meetings SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${values.length}`,
    values,
  });

  return findById(id);
}

/**
 * Cancela uma reunião (soft delete — mantém histórico).
 * @param {string} id
 * @param {string} userId
 */
async function cancel(id, userId) {
  const meeting = await findById(id);

  await assertCanManage(meeting, userId);

  await database.query({
    text: `UPDATE meetings SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
    values: [id],
  });
}

/**
 * Verifica se o usuário pode gerenciar a reunião:
 * criador da reunião ou admin/owner do estúdio.
 */
async function assertCanManage(meeting, userId) {
  if (meeting.created_by === userId) return;

  const orgResult = await database.query({
    text: `SELECT owner_id FROM organizations WHERE id = $1`,
    values: [meeting.org_id],
  });
  if (!orgResult.rowCount) {
    throw new NotFoundError({ message: "Estúdio não encontrado." });
  }
  const org = orgResult.rows[0];

  if (org.owner_id === userId) return;

  const roleResult = await database.query({
    text: `SELECT 1 FROM org_roles WHERE org_id = $1 AND member_id = $2 AND role = 'admin'`,
    values: [meeting.org_id, userId],
  });
  if (roleResult.rowCount) return;

  throw new ForbiddenError({
    message: "Apenas o criador, admin ou dono do estúdio pode gerenciar esta reunião.",
  });
}

const meeting = {
  create,
  findById,
  findByRoomId,
  listByOrgId,
  update,
  cancel,
};

export default meeting;
