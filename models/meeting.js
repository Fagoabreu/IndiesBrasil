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
  } else {
    // Agenda padrão não exibe reuniões canceladas.
    clauses.push("m.status <> 'cancelled'");
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

/**
 * Busca uma reunião garantindo que pertença ao estúdio informado.
 * Usada pelas rotas escopadas por /studios/[slug]/meetings.
 * @param {string} id
 * @param {string} orgId
 */
async function findByIdAndOrg(id, orgId) {
  const found = await findById(id);
  if (found.org_id !== orgId) {
    throw new NotFoundError({
      message: "Reunião não encontrada neste estúdio.",
    });
  }
  return found;
}

/**
 * Valida se a reunião está aberta para entrada de participantes agora.
 * Regras: não pode estar cancelada/encerrada e o horário atual precisa
 * estar dentro da janela [starts_at, ends_at).
 * @param {{ status: string, starts_at: string|Date, ends_at: string|Date }} meeting
 */
function assertCanJoin(meeting) {
  if (!meeting) {
    throw new NotFoundError({ message: "Reunião não encontrada." });
  }
  if (meeting.status === "cancelled") {
    throw new ValidationError({ message: "Esta reunião foi cancelada." });
  }
  if (meeting.status === "ended") {
    throw new ValidationError({ message: "Esta reunião já foi encerrada." });
  }

  const now = Date.now();
  const startsAt = new Date(meeting.starts_at).getTime();
  const endsAt = new Date(meeting.ends_at).getTime();

  if (now < startsAt) {
    throw new ValidationError({ message: "A reunião ainda não começou." });
  }
  if (now >= endsAt) {
    throw new ValidationError({ message: "A reunião já foi encerrada." });
  }
}

/** Remove colunas internas (hash do código) antes de expor na API. */
function serializeMeeting(row) {
  if (!row) return row;
  const publicMeeting = { ...row };
  delete publicMeeting.guest_code_hash;
  return publicMeeting;
}

/* ================================================================
 * CÓDIGO DE CONVIDADO (acesso externo temporário)
 *
 * Código curto gerado pelo organizador para convidados externos.
 * O texto puro é exibido UMA única vez; o banco guarda apenas o hash
 * SHA-256 (guest_code_hash) + expiração (guest_code_expires_at).
 * Expira no término da reunião (ou antes, via expires_at).
 * ================================================================ */

const GUEST_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I
const GUEST_CODE_LENGTH = 8;

function generateGuestCode() {
  let code = "";
  for (let index = 0; index < GUEST_CODE_LENGTH; index += 1) {
    code += GUEST_CODE_ALPHABET[crypto.randomInt(GUEST_CODE_ALPHABET.length)];
  }
  return code;
}

function hashGuestCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function hashesMatch(expectedHash, providedHash) {
  const expected = Buffer.from(expectedHash, "utf8");
  const provided = Buffer.from(providedHash, "utf8");
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
}

/**
 * Gera (ou regera) o código de convidado de uma reunião.
 * Apenas o criador, admin ou dono do estúdio (assertCanManage).
 * @param {string} meetingId
 * @param {string} userId
 * @param {{ expires_at?: string }} [options]
 */
async function createGuestCode(meetingId, userId, options = {}) {
  const found = await findById(meetingId);
  await assertCanManage(found, userId);

  if (found.status === "cancelled") {
    throw new ValidationError({
      message: "Não é possível gerar código para uma reunião cancelada.",
    });
  }

  const endsAt = new Date(found.ends_at);
  if (endsAt.getTime() <= Date.now()) {
    throw new ValidationError({
      message: "A reunião já terminou; não é possível gerar um código de convidado.",
    });
  }

  let expiresAt = parseDate(options.expires_at, "expiração do código");
  if (!expiresAt || expiresAt.getTime() > endsAt.getTime()) {
    expiresAt = endsAt;
  }
  if (expiresAt.getTime() <= Date.now()) {
    throw new ValidationError({
      message: "A expiração do código deve ser uma data futura.",
    });
  }

  const guestCode = generateGuestCode();

  await database.query({
    text: `
      UPDATE meetings
      SET guest_code_hash = $2, guest_code_expires_at = $3, updated_at = NOW()
      WHERE id = $1
    `,
    values: [meetingId, hashGuestCode(guestCode), expiresAt],
  });

  return {
    id: found.id,
    guest_code: guestCode,
    guest_code_expires_at: expiresAt.toISOString(),
  };
}

/**
 * Revoga o código ativo de convidado (invalida convites pendentes).
 * Apenas o criador, admin ou dono do estúdio.
 * @param {string} meetingId
 * @param {string} userId
 */
async function revokeGuestCode(meetingId, userId) {
  const found = await findById(meetingId);
  await assertCanManage(found, userId);

  await database.query({
    text: `
      UPDATE meetings
      SET guest_code_hash = NULL, guest_code_expires_at = NULL, updated_at = NOW()
      WHERE id = $1
    `,
    values: [meetingId],
  });
}

/**
 * Valida o código de convidado de uma reunião (acesso externo).
 * Lança erros com statusCode adequado para código inválido/expirado.
 * @param {string} meetingId
 * @param {string} code
 */
async function validateGuestCode(meetingId, code) {
  const found = await findById(meetingId);

  if (found.status === "cancelled") {
    throw new ValidationError({ message: "Esta reunião foi cancelada." });
  }
  if (found.status === "ended") {
    throw new ValidationError({ message: "Esta reunião já foi encerrada." });
  }

  if (!found.guest_code_hash) {
    throw new ForbiddenError({
      message: "Esta reunião não possui um código de convidado ativo.",
    });
  }

  const normalizedCode = String(code ?? "")
    .trim()
    .toUpperCase();
  if (!hashesMatch(found.guest_code_hash, hashGuestCode(normalizedCode))) {
    throw new ForbiddenError({ message: "Código de convidado inválido." });
  }

  const expiresAt = found.guest_code_expires_at ? new Date(found.guest_code_expires_at) : null;
  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    throw new ForbiddenError({ message: "O código de convidado expirou." });
  }

  return serializeMeeting(found);
}

const meeting = {
  create,
  findById,
  findByIdAndOrg,
  findByRoomId,
  listByOrgId,
  update,
  cancel,
  assertCanJoin,
  createGuestCode,
  revokeGuestCode,
  validateGuestCode,
  serializeMeeting,
};

export default meeting;
