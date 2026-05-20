/**
 * Migration: Sistema de Agenda e Calendário
 *
 * Tabelas criadas:
 *   event_recurrence_rules  — regras de recorrência (iCal-inspired)
 *   events                  — eventos (únicos, multi-dia, recorrentes)
 *   event_instances         — ocorrências materializadas de eventos recorrentes
 *   event_rsvps             — confirmações de presença por usuário
 *   event_invitations       — convites para eventos privados
 *
 * Alterações em tabelas existentes:
 *   posts.event_id          — vincula um post a um evento
 *
 * Tabelas removidas (antigas, sem uso):
 *   calendar_event_participants, event_instances (antiga), calendar_events,
 *   recurrence_rules, calendars
 *
 * Enums removidos:
 *   calendar_event_role     — substituído pela lógica de events.created_by +
 *                             event_invitations
 *
 * Enums reutilizados (já existem):
 *   visibility_type         — private | followers | members | public
 *   frequency               — daily | weekly | monthly | yearly
 */

exports.up = (pgm) => {
  /* ================================================================
   * 1. LIMPAR TABELAS E ENUMS ANTIGOS
   * ================================================================ */
  pgm.sql(`
    DROP TABLE IF EXISTS calendar_event_participants CASCADE;
    DROP TABLE IF EXISTS event_instances              CASCADE;
    DROP TABLE IF EXISTS calendar_events              CASCADE;
    DROP TABLE IF EXISTS recurrence_rules             CASCADE;
    DROP TABLE IF EXISTS calendars                    CASCADE;

    DROP TYPE IF EXISTS calendar_event_role;
  `);

  /* ================================================================
   * 2. NOVOS ENUMS
   * ================================================================ */
  pgm.sql(`
    -- Categoria do evento
    CREATE TYPE event_type AS ENUM (
      'general',          -- eventos comunitários (RetroConfer, etc.)
      'game_launch',      -- lançamento de jogo
      'game_jam',         -- game jam
      'stream_marathon',  -- maratona de stream
      'meeting',          -- reunião / encontro recorrente
      'studio'            -- evento de estúdio (uso futuro)
    );

    -- Ciclo de vida do evento
    CREATE TYPE event_status AS ENUM (
      'draft',            -- rascunho (visível apenas para o criador)
      'published',        -- publicado
      'cancelled'         -- cancelado (mantido no histórico)
    );

    -- Status de confirmação de presença
    CREATE TYPE rsvp_status AS ENUM (
      'going',
      'maybe',
      'not_going'
    );

    -- Status de convite para evento privado
    CREATE TYPE invitation_status AS ENUM (
      'pending',
      'accepted',
      'declined'
    );
  `);

  /* ================================================================
   * 3. EVENT_RECURRENCE_RULES
   *
   * Inspirado em iCal RRULE, mas simplificado para os casos de uso
   * do sistema:
   *
   * Exemplos de regras:
   *   Todo domingo          → frequency=weekly,  interval=1, days_of_week=[0]
   *   Toda segunda e quarta → frequency=weekly,  interval=1, days_of_week=[1,3]
   *   Toda outra semana     → frequency=weekly,  interval=2, days_of_week=[0]
   *   Primeira segunda      → frequency=monthly, interval=1, week_of_month=1, days_of_week=[1]
   *   Última sexta          → frequency=monthly, interval=1, week_of_month=-1, days_of_week=[5]
   *   Todo dia 15           → frequency=monthly, interval=1, day_of_month=15
   *   Todo ano em jan/jul   → frequency=yearly,  interval=1, months_of_year=[1,7]
   *   Todo dia              → frequency=daily,   interval=1
   * ================================================================ */
  pgm.createTable("event_recurrence_rules", {
    id: {
      type: "serial",
      primaryKey: true,
    },

    /* Frequência base (reutiliza enum existente) */
    frequency: {
      type: "frequency",
      notNull: true,
    },

    /* A cada N períodos (padrão 1 = cada período) */
    interval: {
      type: "int",
      notNull: true,
      default: 1,
    },

    /* Weekly: dias da semana (0=Dom, 1=Seg, ..., 6=Sáb).
       Pode ter múltiplos valores para "Seg e Qua". */
    days_of_week: {
      type: "int[]",
    },

    /* Monthly por posição: semana do mês.
       1=primeira, 2=segunda, 3=terceira, 4=quarta, -1=última.
       Usa junto com days_of_week para "primeira segunda". */
    week_of_month: {
      type: "int",
    },

    /* Monthly por data fixa: dia do mês (1–31). */
    day_of_month: {
      type: "int",
    },

    /* Yearly: meses específicos do ano (1–12). */
    months_of_year: {
      type: "int[]",
    },

    /* Término da recorrência: por data ou por contagem (apenas um deve ser usado) */
    until_date: {
      type: "date",
    },
    max_occurrences: {
      type: "int",
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });

  /* ================================================================
   * 4. EVENTS
   * ================================================================ */
  pgm.createTable("events", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    title: {
      type: "varchar(255)",
      notNull: true,
    },

    /* Slug legível para URL (ex: "retroconfer-2026"). Gerado pela API. */
    slug: {
      type: "varchar(255)",
    },

    description: {
      type: "text",
    },

    event_type: {
      type: "event_type",
      notNull: true,
      default: pgm.func("'general'"),
    },

    /* Quem pode ver o evento */
    visibility: {
      type: "visibility_type",
      notNull: true,
      default: pgm.func("'public'"),
    },

    /* Ciclo de vida */
    status: {
      type: "event_status",
      notNull: true,
      default: pgm.func("'draft'"),
    },

    /* Organizador principal */
    created_by: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },

    /* Futuro: estúdio organizador */
    studio_id: {
      type: "int",
    },

    /* Localização presencial */
    location_name: {
      type: "varchar(255)",
    },
    location_url: {
      type: "varchar(512)",
    },

    /* Evento online */
    is_online: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    online_url: {
      type: "varchar(512)",
    },

    /* Timing da primeira (ou única) ocorrência */
    starts_at: {
      type: "timestamptz",
      notNull: true,
    },
    ends_at: {
      type: "timestamptz",
      notNull: true,
    },

    /* Evento de dia inteiro (ignora hora) */
    is_all_day: {
      type: "boolean",
      notNull: true,
      default: false,
    },

    /* Recorrência */
    is_recurring: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    recurrence_rule_id: {
      type: "int",
      references: "event_recurrence_rules(id)",
      onDelete: "SET NULL",
    },

    /* Mídia */
    banner_image_id: {
      type: "varchar(256)",
      references: "uploaded_images(id)",
      onDelete: "SET NULL",
    },

    /* Futuro: jogo associado (lançamento) */
    game_id: {
      type: "int",
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });

  /* ================================================================
   * 5. EVENT_INSTANCES
   *
   * Cada ocorrência de um evento é uma linha aqui.
   * Eventos não-recorrentes têm exatamente 1 instância.
   * Eventos recorrentes têm N instâncias pré-geradas (rolling window).
   *
   * Permite exceções por ocorrência:
   *   - Cancelar só aquela semana (is_cancelled = true)
   *   - Alterar título/descrição de uma ocorrência específica
   * ================================================================ */
  pgm.createTable("event_instances", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    event_id: {
      type: "uuid",
      notNull: true,
      references: "events(id)",
      onDelete: "CASCADE",
    },

    starts_at: {
      type: "timestamptz",
      notNull: true,
    },
    ends_at: {
      type: "timestamptz",
      notNull: true,
    },

    /* Cancelar esta ocorrência específica sem cancelar o evento inteiro */
    is_cancelled: {
      type: "boolean",
      notNull: true,
      default: false,
    },

    /* Overrides por ocorrência (ex: "Reunião de Dezembro — Especial") */
    override_title: {
      type: "varchar(255)",
    },
    override_description: {
      type: "text",
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });

  /* ================================================================
   * 6. EVENT_RSVPS — Confirmação de presença
   *
   * instance_id = NULL  → confirmação vale para TODAS as ocorrências
   * instance_id = <id>  → confirmação apenas para AQUELA ocorrência
   *
   * O par (event_id, user_id) com instance_id IS NULL é único via
   * índice parcial (UNIQUE não trata NULLs como iguais no PostgreSQL).
   * ================================================================ */
  pgm.createTable("event_rsvps", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    event_id: {
      type: "uuid",
      notNull: true,
      references: "events(id)",
      onDelete: "CASCADE",
    },

    /* NULL = vale para o evento inteiro / todas as ocorrências */
    instance_id: {
      type: "uuid",
      references: "event_instances(id)",
      onDelete: "CASCADE",
    },

    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },

    status: {
      type: "rsvp_status",
      notNull: true,
      default: pgm.func("'going'"),
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });

  /* ================================================================
   * 7. EVENT_INVITATIONS — Convites para eventos privados
   *
   * Apenas eventos com visibility='private' precisam de convite.
   * O organizador pode convidar usuários diretamente.
   * ================================================================ */
  pgm.createTable("event_invitations", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    event_id: {
      type: "uuid",
      notNull: true,
      references: "events(id)",
      onDelete: "CASCADE",
    },

    invited_user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },

    invited_by: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },

    status: {
      type: "invitation_status",
      notNull: true,
      default: pgm.func("'pending'"),
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });

  /* ================================================================
   * 8. POSTS: adicionar event_id
   *
   * Posts associados a eventos aparecem na página do evento.
   * ================================================================ */
  pgm.sql(`
    ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id) ON DELETE SET NULL;
  `);

  /* ================================================================
   * 9. ÍNDICES E CONSTRAINTS
   * ================================================================ */
  pgm.sql(`
    /* ── events ────────────────────────────────────────────────── */
    CREATE INDEX idx_events_created_by
      ON events (created_by);

    CREATE INDEX idx_events_status_visibility
      ON events (status, visibility);

    CREATE INDEX idx_events_starts_at
      ON events (starts_at);

    CREATE INDEX idx_events_type
      ON events (event_type);

    /* Slug único quando informado */
    CREATE UNIQUE INDEX idx_events_slug
      ON events (slug)
      WHERE slug IS NOT NULL;

    /* Constraint: ends_at >= starts_at */
    ALTER TABLE events
      ADD CONSTRAINT events_ends_after_starts
      CHECK (ends_at >= starts_at);

    /* Constraint: evento recorrente deve ter regra */
    ALTER TABLE events
      ADD CONSTRAINT events_recurring_requires_rule
      CHECK (is_recurring = false OR recurrence_rule_id IS NOT NULL);

    /* Constraint: intervalo positivo */
    ALTER TABLE event_recurrence_rules
      ADD CONSTRAINT recurrence_interval_positive
      CHECK (interval > 0);

    /* ── event_instances ────────────────────────────────────────── */
    CREATE INDEX idx_event_instances_event_id
      ON event_instances (event_id);

    /* Índice principal para queries de calendário (range de datas) */
    CREATE INDEX idx_event_instances_calendar
      ON event_instances (starts_at, ends_at)
      WHERE is_cancelled = false;

    ALTER TABLE event_instances
      ADD CONSTRAINT event_instances_ends_after_starts
      CHECK (ends_at >= starts_at);

    /* ── event_rsvps ────────────────────────────────────────────── */
    /* RSVP global (sem instância específica): único por evento+usuário */
    CREATE UNIQUE INDEX uq_event_rsvp_global
      ON event_rsvps (event_id, user_id)
      WHERE instance_id IS NULL;

    /* RSVP por instância: único por instância+usuário */
    CREATE UNIQUE INDEX uq_event_rsvp_instance
      ON event_rsvps (event_id, instance_id, user_id)
      WHERE instance_id IS NOT NULL;

    CREATE INDEX idx_event_rsvps_user_id
      ON event_rsvps (user_id);

    /* ── event_invitations ──────────────────────────────────────── */
    CREATE UNIQUE INDEX uq_event_invitation
      ON event_invitations (event_id, invited_user_id);

    CREATE INDEX idx_event_invitations_invited_user
      ON event_invitations (invited_user_id);

    /* ── posts ──────────────────────────────────────────────────── */
    CREATE INDEX IF NOT EXISTS idx_posts_event_id
      ON posts (event_id)
      WHERE event_id IS NOT NULL;
  `);
};

exports.down = false;
