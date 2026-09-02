import crypto from "crypto";
import database from "infra/database";
import { NotFoundError, ValidationError } from "@/infra/errors";

/* ================================================================
 * HELPERS
 * ================================================================ */

/** Alfabeto sem caracteres ambíguos (I/L/O/0/1) — fácil de ditar/digitar. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;
const GUEST_KEY_TTL_MS = 24 * 60 * 60 * 1000; // 24h (padrão)

function generateCode() {
  let code = "";
  const bytes = crypto.randomBytes(CODE_LENGTH);
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function isUniqueViolation(error) {
  return Boolean(error?.cause?.code === "23505");
}

/* ================================================================
 * CONSULTAS BASE
 * ================================================================ */

const MEETING_SELECT = `
  SELECT
    m.*,
    o.slug AS org_slug,
    o.name AS org_name,
    ui.secure_url AS org_logo_url,
    u.username AS created_by_username
  FROM meetings m
  LEFT JOIN organizations o ON o.id = m.org_id
  LEFT JOIN uploaded_images ui ON ui.id = o.img
  LEFT JOIN users u ON u.id = m.created_by
`;

async function selectMeetings(whereClause, values) {
  const results = await database.query({
    text: `
      ${MEETING_SELECT}
      WHERE ${whereClause}
      ORDER BY m.created_at DESC
    `,
    values,
  });
  return results.rows;
}

async function findByCode(code) {
  if (!code?.trim()) throw new NotFoundError({ message: "Reunião não encontrada." });
  const rows = await selectMeetings("m.code = $1", [code.trim()]);
  if (!rows[0]) throw new NotFoundError({ message: "Reunião não encontrada." });
  return rows[0];
}

async function findById(id) {
  const rows = await selectMeetings("m.id = $1", [id]);
  if (!rows[0]) throw new NotFoundError({ message: "Reunião não encontrada." });
  return rows[0];
}

/**
 * Lista reuniões de uma organização.
 * `status` opcional: 'scheduled' | 'active' | 'ended' | 'cancelled'.
 * Sem filtro, retorna todas (histórico completo para o time).
 */
async function listByOrg(orgId, { status } = {}) {
  const filters = ["m.org_id = $1"];
  const values = [orgId];
  if (status) {
    values.push(status);
    filters.push(`m.status = $${values.length}`);
  }
  return selectMeetings(filters.join(" AND "), values);
}

/* ================================================================
 * CICLO DE VIDA
 * ================================================================ */

async function create({ org_id, created_by, title, description, starts_at, ends_at }) {
  if (!org_id) throw new ValidationError({ message: "Organização é obrigatória." });
  if (!created_by) throw new ValidationError({ message: "Usuário criador é obrigatório." });

  const cleanTitle = title?.trim();
  if (!cleanTitle) throw new ValidationError({ message: "Título é obrigatório." });
  if (cleanTitle.length > 120) {
    throw new ValidationError({ message: "Título deve ter no máximo 120 caracteres." });
  }

  const startsAt = starts_at ? new Date(starts_at) : new Date();
  const endsAt = ends_at ? new Date(ends_at) : null;
  if (Number.isNaN(startsAt.getTime())) throw new ValidationError({ message: "Data de início inválida." });
  if (endsAt && Number.isNaN(endsAt.getTime())) throw new ValidationError({ message: "Data de término inválida." });
  if (endsAt && endsAt < startsAt) {
    throw new ValidationError({ message: "Data de término não pode ser anterior à de início." });
  }

  // Agendada (starts_at informado) começa 'scheduled'; imediata começa 'active'.
  const status = starts_at ? "scheduled" : "active";

  // Código curto com retry em colisão (23505) — chance ~0, mas garante UX.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode();
    try {
      const results = await database.query({
        text: `
          INSERT INTO meetings (
            org_id, code, title, description, status,
            created_by, starts_at, ends_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          RETURNING *
        `,
        values: [org_id, code, cleanTitle, description?.trim() || null, status, created_by, startsAt, endsAt],
      });
      return results.rows[0];
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === 4) throw error;
    }
  }
  return null; // inalcançável; satisfaz fluxo do linter
}

async function updateDetails(code, data) {
  const meeting = await findByCode(code);

  if (meeting.status !== "scheduled" && meeting.status !== "active") {
    throw new ValidationError({ message: "Reuniões encerradas ou canceladas não podem ser editadas." });
  }

  const cleanTitle = data.title?.trim();
  if (data.title !== undefined && !cleanTitle) {
    throw new ValidationError({ message: "Título é obrigatório." });
  }

  const results = await database.query({
    text: `
      UPDATE meetings
      SET
        title = COALESCE($2, title),
        description = CASE WHEN $3::boolean THEN $4::text ELSE description END,
        updated_at = timezone('utc', NOW())
      WHERE code = $1 AND org_id = $5
      RETURNING *
    `,
    values: [meeting.code, cleanTitle || null, data.description !== undefined, data.description ?? null, meeting.org_id],
  });
  return results.rows[0];
}

/** Transição scheduled/active → active (inicia a reunião). */
async function start(code) {
  const results = await database.query({
    text: `
      UPDATE meetings
      SET
        status = 'active',
        starts_at = COALESCE(starts_at, timezone('utc', NOW())),
        updated_at = timezone('utc', NOW())
      WHERE code = $1 AND status IN ('scheduled', 'active')
      RETURNING *
    `,
    values: [code],
  });

  if (!results.rows[0]) throw new NotFoundError({ message: "Reunião não encontrada ou já encerrada." });
  return results.rows[0];
}

/** Transição scheduled/active → ended. */
async function end(code) {
  const results = await database.query({
    text: `
      UPDATE meetings
      SET
        status = 'ended',
        ended_at = timezone('utc', NOW()),
        ends_at = COALESCE(ends_at, timezone('utc', NOW())),
        updated_at = timezone('utc', NOW())
      WHERE code = $1 AND status IN ('scheduled', 'active')
      RETURNING *
    `,
    values: [code],
  });

  if (!results.rows[0]) throw new NotFoundError({ message: "Reunião não encontrada ou já encerrada." });
  return results.rows[0];
}

/** Cancela reunião agendada (sem ter acontecido). */
async function cancel(code) {
  const results = await database.query({
    text: `
      UPDATE meetings
      SET
        status = 'cancelled',
        updated_at = timezone('utc', NOW())
      WHERE code = $1 AND status IN ('scheduled', 'active')
      RETURNING *
    `,
    values: [code],
  });

  if (!results.rows[0]) throw new NotFoundError({ message: "Reunião não encontrada ou já encerrada." });
  return results.rows[0];
}

/** Encerra por ação de moderação (bloqueio de reunião). */
async function endByModeration(code) {
  const results = await database.query({
    text: `
      UPDATE meetings
      SET
        status = 'ended',
        ended_at = timezone('utc', NOW()),
        updated_at = timezone('utc', NOW())
      WHERE code = $1 AND status <> 'ended'
      RETURNING *
    `,
    values: [code],
  });
  return results.rows[0] ?? null;
}

/* ================================================================
 * CHAVES DE CONVIDADO (links temporários)
 * ================================================================ */

/**
 * Cria uma chave de convidado para a reunião.
 * Retorna { rawToken, guestKey } — o token cru é exibido UMA vez no link.
 */
async function createGuestKey({ meeting_id, created_by, ttl_ms = GUEST_KEY_TTL_MS }) {
  const meeting = await findById(meeting_id);
  if (meeting.status !== "scheduled" && meeting.status !== "active") {
    throw new ValidationError({ message: "A reunião está encerrada ou cancelada." });
  }
  if (!Number.isFinite(ttl_ms) || ttl_ms <= 0) throw new ValidationError({ message: "Validade da chave inválida." });

  const rawToken = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + ttl_ms);

  const results = await database.query({
    text: `
      INSERT INTO meeting_guest_keys (
        meeting_id, token_hash, created_by, expires_at
      )
      VALUES ($1,$2,$3,$4)
      RETURNING *
    `,
    values: [meeting.id, hashToken(rawToken), created_by, expiresAt],
  });
  return { rawToken, guestKey: results.rows[0] };
}

/** Busca chave válida (não revogada, não expirada) por hash do token. */
async function findValidGuestKeyByToken(rawToken) {
  if (!rawToken?.trim()) {
    throw new NotFoundError({
      message: "Link de convite inválido, expirado ou revogado.",
      action: "Peça um novo link de convite ao organizador da reunião.",
    });
  }
  const results = await database.query({
    text: `
      SELECT
        k.*,
        m.code AS meeting_code,
        m.org_id,
        m.status AS meeting_status
      FROM meeting_guest_keys k
      JOIN meetings m ON m.id = k.meeting_id
      WHERE
        k.token_hash = $1
        AND k.revoked_at IS NULL
        AND k.expires_at > timezone('utc', NOW())
      LIMIT 1
    `,
    values: [hashToken(rawToken.trim())],
  });

  if (!results.rows[0]) {
    throw new NotFoundError({
      message: "Link de convite inválido, expirado ou revogado.",
      action: "Peça um novo link de convite ao organizador da reunião.",
    });
  }
  return results.rows[0];
}

async function markGuestKeyUsed(keyId) {
  await database.query({
    text: `UPDATE meeting_guest_keys SET last_used_at = timezone('utc', NOW()) WHERE id = $1`,
    values: [keyId],
  });
}

/** Lista chaves de uma reunião (sem o hash do token). */
async function listGuestKeys(meetingId) {
  const results = await database.query({
    text: `
      SELECT
        id, created_by, expires_at, revoked_at, last_used_at, created_at,
        (revoked_at IS NULL AND expires_at > timezone('utc', NOW())) AS is_valid
      FROM meeting_guest_keys
      WHERE meeting_id = $1
      ORDER BY created_at DESC
    `,
    values: [meetingId],
  });
  return results.rows;
}

async function revokeGuestKey(keyId, meetingId) {
  const results = await database.query({
    text: `
      UPDATE meeting_guest_keys
      SET revoked_at = timezone('utc', NOW())
      WHERE
        id = $1
        AND revoked_at IS NULL
        AND ($2::uuid IS NULL OR meeting_id = $2)
      RETURNING *
    `,
    values: [keyId, meetingId ?? null],
  });

  if (!results.rows[0]) {
    throw new NotFoundError({ message: "Chave de convite não encontrada ou já revogada." });
  }
  return results.rows[0];
}

/* ================================================================
 * EXPORTAÇÃO
 * ================================================================ */

const meeting = {
  findByCode,
  findById,
  listByOrg,
  create,
  updateDetails,
  start,
  end,
  cancel,
  endByModeration,
  createGuestKey,
  findValidGuestKeyByToken,
  markGuestKeyUsed,
  listGuestKeys,
  revokeGuestKey,
  // helpers p/ testes
  _internal: { generateCode, hashToken },
};

export default meeting;
