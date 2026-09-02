/**
 * Tabelas do recurso "Reuniões" de estúdio/organização.
 *
 *   meetings              — reunião criada por membro do estúdio (org)
 *   meeting_guest_keys    — chaves de acesso temporárias p/ convidados
 *                           (link compartilhável, sem conta)
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE meeting_status AS ENUM (
      'scheduled',  -- agendada (ainda não iniciada)
      'active',     -- em andamento (sala aceita participantes)
      'ended',      -- encerrada
      'cancelled'   -- cancelada
    );

    CREATE TABLE meetings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      code varchar(16) NOT NULL UNIQUE,
      title varchar(120) NOT NULL,
      description text,
      status meeting_status NOT NULL DEFAULT 'scheduled',
      created_by uuid REFERENCES users(id) ON DELETE SET NULL,
      starts_at timestamptz,
      ends_at timestamptz,
      ended_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT timezone('utc', NOW()),
      updated_at timestamptz NOT NULL DEFAULT timezone('utc', NOW())
    );

    CREATE INDEX meetings_org_id_idx ON meetings(org_id, created_at DESC);
    CREATE INDEX meetings_status_idx ON meetings(status);

    CREATE TABLE meeting_guest_keys (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      token_hash char(64) NOT NULL UNIQUE,
      created_by uuid REFERENCES users(id) ON DELETE SET NULL,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      last_used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT timezone('utc', NOW())
    );

    CREATE INDEX meeting_guest_keys_meeting_id_idx ON meeting_guest_keys(meeting_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS meeting_guest_keys CASCADE;
    DROP TABLE IF EXISTS meetings CASCADE;
    DROP TYPE IF EXISTS meeting_status;
  `);
};
