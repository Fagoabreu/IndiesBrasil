-- IndiesDB -- DDL compativel com drawdb.app
-- Data: 2026-05-16
--
-- Compatibilidade drawdb.app aplicada:
--   CREATE TYPE AS ENUM removidos (gerenciar enums na UI do drawdb)
--   Colunas enum substituidas por VARCHAR(n)
--   INTEGER[] / VARCHAR[] / org_role[] substituidos por TEXT
--   JSONB substituido por TEXT
--   TIMESTAMPTZ substituido por TIMESTAMP
--   CHECK constraints removidas
--   DEFAULT gen_random_uuid() removido (UUID NOT NULL sem default)
--   ON DELETE CASCADE / SET NULL removidos das FKs

-- =============================================================================
-- TABELAS SEM DEPENDENCIAS
-- =============================================================================

CREATE TABLE contact_type (
    id          SERIAL          NOT NULL,
    icon_key    VARCHAR(64)     NOT NULL,
    icon_img    VARCHAR(256)    NULL,
    CONSTRAINT contact_type_pkey PRIMARY KEY (id)
);

CREATE TABLE event_recurrence_rules (
    id              SERIAL      NOT NULL,
    frequency       VARCHAR(20) NOT NULL,
    interval        INTEGER     DEFAULT 1 NOT NULL,
    days_of_week    TEXT        NULL,
    week_of_month   INTEGER     NULL,
    day_of_month    INTEGER     NULL,
    months_of_year  TEXT        NULL,
    until_date      DATE        NULL,
    max_occurrences INTEGER     NULL,
    created_at      TIMESTAMP   DEFAULT NOW() NOT NULL,
    CONSTRAINT event_recurrence_rules_pkey PRIMARY KEY (id)
);

CREATE TABLE notification_messages (
    type        VARCHAR(30)     NOT NULL,
    title       VARCHAR(64)     NULL,
    message     VARCHAR(512)    NULL,
    updated_at  TIMESTAMP       DEFAULT NOW() NULL,
    CONSTRAINT notification_messages_pkey PRIMARY KEY (type)
);

CREATE TABLE pgmigrations (
    id      SERIAL          NOT NULL,
    name    VARCHAR(255)    NOT NULL,
    run_on  TIMESTAMP       NOT NULL,
    CONSTRAINT pgmigrations_pkey PRIMARY KEY (id)
);

CREATE TABLE portfolio_roles (
    name        VARCHAR(50)     NOT NULL,
    icon_img    VARCHAR(256)    NULL,
    CONSTRAINT portfolio_roles_pkey PRIMARY KEY (name)
);

CREATE TABLE portfolio_tools (
    id          SERIAL          NOT NULL,
    name        VARCHAR(255)    NULL,
    icon_img    VARCHAR(256)    NULL,
    CONSTRAINT portfolio_tools_pkey PRIMARY KEY (id)
);

CREATE TABLE roles (
    id      SERIAL          NOT NULL,
    name    VARCHAR(100)    NOT NULL,
    CONSTRAINT roles_name_key UNIQUE (name),
    CONSTRAINT roles_pkey PRIMARY KEY (id)
);

CREATE TABLE tags (
    id          UUID        NOT NULL,
    name        VARCHAR(50) NOT NULL,
    created_at  TIMESTAMP   DEFAULT NOW() NOT NULL,
    CONSTRAINT tags_name_key UNIQUE (name),
    CONSTRAINT tags_pkey PRIMARY KEY (id)
);

CREATE TABLE uploaded_images (
    id              VARCHAR(256)    NOT NULL,
    public_id       VARCHAR(256)    NULL,
    display_name    VARCHAR(256)    NULL,
    filename        VARCHAR(256)    NOT NULL,
    width           INTEGER         NULL,
    height          INTEGER         NULL,
    format          VARCHAR(32)     NULL,
    tags            TEXT            DEFAULT '{}' NOT NULL,
    resource_type   VARCHAR(256)    NULL,
    secure_url      VARCHAR(512)    NULL,
    created_at      TIMESTAMP       DEFAULT NOW() NOT NULL,
    CONSTRAINT uploaded_images_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- TABELAS COM FK -> uploaded_images
-- =============================================================================

CREATE TABLE game_store (
    id      SERIAL          NOT NULL,
    name    VARCHAR(50)     NULL,
    ico     VARCHAR(256)    NULL,
    CONSTRAINT game_store_pkey PRIMARY KEY (id),
    CONSTRAINT game_store_images_id_fkey FOREIGN KEY (ico) REFERENCES uploaded_images(id)
);

CREATE TABLE users (
    id                  UUID            NOT NULL,
    username            VARCHAR(39)     NOT NULL,
    email               VARCHAR(254)    NOT NULL,
    password            VARCHAR(60)     NOT NULL,
    cpf                 NUMERIC(11)     NOT NULL,
    created_at          TIMESTAMP       DEFAULT NOW() NOT NULL,
    updated_at          TIMESTAMP       DEFAULT NOW() NOT NULL,
    features            TEXT            DEFAULT '{}' NOT NULL,
    avatar_image        VARCHAR(256)    NULL,
    resumo              VARCHAR(128)    NULL,
    bio                 TEXT            NULL,
    visibility          VARCHAR(20)     DEFAULT 'public' NOT NULL,
    background_image    VARCHAR(256)    NULL,
    birth_date          DATE            NULL,
    CONSTRAINT users_cpf_key UNIQUE (cpf),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_username_key UNIQUE (username),
    CONSTRAINT user_images_id_fkey FOREIGN KEY (avatar_image) REFERENCES uploaded_images(id),
    CONSTRAINT users_background_image_fkey FOREIGN KEY (background_image) REFERENCES uploaded_images(id)
);

-- =============================================================================
-- TABELAS COM FK -> users
-- =============================================================================

CREATE TABLE sessions (
    id          UUID        NOT NULL,
    token       VARCHAR(96) NOT NULL,
    user_id     UUID        NOT NULL,
    expires_at  TIMESTAMP   NOT NULL,
    created_at  TIMESTAMP   DEFAULT NOW() NOT NULL,
    updated_at  TIMESTAMP   DEFAULT NOW() NOT NULL,
    CONSTRAINT sessions_pkey PRIMARY KEY (id),
    CONSTRAINT sessions_token_key UNIQUE (token),
    CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE user_activation_tokens (
    id          UUID        NOT NULL,
    used_at     TIMESTAMP   NULL,
    user_id     UUID        NOT NULL,
    expires_at  TIMESTAMP   NOT NULL,
    created_at  TIMESTAMP   DEFAULT NOW() NOT NULL,
    updated_at  TIMESTAMP   DEFAULT NOW() NOT NULL,
    CONSTRAINT user_activation_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT user_activation_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE moderation_actions (
    id           SERIAL      NOT NULL,
    target_user  UUID        NOT NULL,
    performed_by UUID        NOT NULL,
    action_type  VARCHAR(20) NOT NULL,
    reason       TEXT        NULL,
    created_at   TIMESTAMP   DEFAULT NOW() NOT NULL,
    expires_at   TIMESTAMP   NOT NULL,
    is_active    BOOLEAN     DEFAULT true NOT NULL,
    CONSTRAINT moderation_actions_pkey PRIMARY KEY (id),
    CONSTRAINT moderation_actions_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES users(id),
    CONSTRAINT moderation_actions_target_user_fkey FOREIGN KEY (target_user) REFERENCES users(id)
);

CREATE TABLE organizations (
    id          UUID            NOT NULL,
    owner_id    UUID            NOT NULL,
    name        VARCHAR(255)    NOT NULL,
    description TEXT            NULL,
    created_at  TIMESTAMP       DEFAULT NOW() NOT NULL,
    history     TEXT            NULL,
    img         VARCHAR(256)    NULL,
    CONSTRAINT organizations_pkey PRIMARY KEY (id),
    CONSTRAINT organizations_images_id_fkey FOREIGN KEY (img) REFERENCES uploaded_images(id),
    CONSTRAINT organizations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE users_contacts (
    id              SERIAL          NOT NULL,
    contact_type_id INTEGER         NULL,
    user_id         UUID            NULL,
    contact_value   VARCHAR(255)    NULL,
    CONSTRAINT users_contacts_pkey PRIMARY KEY (id),
    CONSTRAINT users_contacts_contact_type_id_fkey FOREIGN KEY (contact_type_id) REFERENCES contact_type(id),
    CONSTRAINT users_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE user_followers (
    follower_id     UUID NOT NULL,
    lead_user_id    UUID NOT NULL,
    CONSTRAINT user_followers_pkey PRIMARY KEY (follower_id, lead_user_id),
    CONSTRAINT user_followers_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES users(id),
    CONSTRAINT user_followers_lead_user_id_fkey FOREIGN KEY (lead_user_id) REFERENCES users(id)
);

CREATE TABLE user_notifications (
    user_id         UUID        NOT NULL,
    type            VARCHAR(30) NOT NULL,
    source_user_id  UUID        NOT NULL,
    is_read         BOOLEAN     DEFAULT false NULL,
    created_at      TIMESTAMP   DEFAULT NOW() NULL,
    CONSTRAINT user_notifications_pkey PRIMARY KEY (user_id, type, source_user_id),
    CONSTRAINT user_notifications_source_user_id_fkey FOREIGN KEY (source_user_id) REFERENCES users(id),
    CONSTRAINT user_notifications_type_fkey FOREIGN KEY (type) REFERENCES notification_messages(type),
    CONSTRAINT user_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE user_roles (
    user_id UUID    NOT NULL,
    role_id INTEGER NOT NULL,
    CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id),
    CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id),
    CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE portfolio_formacao (
    id          SERIAL          NOT NULL,
    ordem       INTEGER         NOT NULL,
    nome        VARCHAR(256)    NULL,
    init_date   DATE            NOT NULL,
    end_date    DATE            NULL,
    instituicao VARCHAR(256)    NOT NULL,
    created_at  TIMESTAMP       DEFAULT NOW() NOT NULL,
    user_id     UUID            NOT NULL,
    CONSTRAINT portfolio_formacao_pkey PRIMARY KEY (id),
    CONSTRAINT portfolio_formacao_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE portfolio_historico (
    id          SERIAL          NOT NULL,
    ordem       INTEGER         NOT NULL,
    cargo       VARCHAR(128)    NULL,
    init_date   DATE            NOT NULL,
    end_date    DATE            NULL,
    company     VARCHAR(256)    NOT NULL,
    cidade      VARCHAR(256)    NOT NULL,
    estado      VARCHAR(128)    NULL,
    atribuicoes TEXT            NULL,
    created_at  TIMESTAMP       DEFAULT NOW() NOT NULL,
    user_id     UUID            NOT NULL,
    CONSTRAINT portfolio_historico_pkey PRIMARY KEY (id),
    CONSTRAINT portfolio_historico_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE portfolio_medias (
    id          SERIAL          NOT NULL,
    media       VARCHAR(20)     NOT NULL,
    url         TEXT            NULL,
    caption     VARCHAR(255)    NULL,
    created_at  TIMESTAMP       DEFAULT NOW() NOT NULL,
    user_id     UUID            NOT NULL,
    CONSTRAINT portfolio_medias_pkey PRIMARY KEY (id),
    CONSTRAINT portfolio_medias_url_key UNIQUE (url),
    CONSTRAINT portfolio_medias_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE portfolio_role_ref (
    experience          VARCHAR(20) NULL,
    user_id             UUID        NOT NULL,
    ordem               INTEGER     DEFAULT 0 NOT NULL,
    portfolio_role_name VARCHAR(50) NOT NULL,
    CONSTRAINT portfolio_role_ref_pkey PRIMARY KEY (user_id, portfolio_role_name),
    CONSTRAINT portfolio_role_ref_portfolio_role_name_fkey FOREIGN KEY (portfolio_role_name) REFERENCES portfolio_roles(name),
    CONSTRAINT portfolio_role_ref_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE portfolio_tool_ref (
    portfolio_tool_id   INTEGER     NOT NULL,
    experience          VARCHAR(20) NULL,
    user_id             UUID        NOT NULL,
    CONSTRAINT portfolio_tool_ref_portfolio_tool_id_fkey FOREIGN KEY (portfolio_tool_id) REFERENCES portfolio_tools(id),
    CONSTRAINT portfolio_tool_ref_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

-- =============================================================================
-- ORGANIZACOES
-- =============================================================================

CREATE TABLE org_followers (
    org_id      UUID NOT NULL,
    follower_id UUID NOT NULL,
    CONSTRAINT org_followers_pkey PRIMARY KEY (org_id, follower_id),
    CONSTRAINT org_followers_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES users(id),
    CONSTRAINT org_followers_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id)
);

CREATE TABLE org_members (
    org_id      UUID    NOT NULL,
    member_id   UUID    NOT NULL,
    roles       TEXT    NOT NULL,
    CONSTRAINT org_members_pkey PRIMARY KEY (org_id, member_id),
    CONSTRAINT org_members_member_id_fkey FOREIGN KEY (member_id) REFERENCES users(id),
    CONSTRAINT org_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id)
);

CREATE TABLE organization_contacts (
    id              SERIAL          NOT NULL,
    contact_type_id INTEGER         NULL,
    org_id          UUID            NULL,
    contact_value   VARCHAR(255)    NULL,
    CONSTRAINT organization_contacts_pkey PRIMARY KEY (id),
    CONSTRAINT organization_contacts_contact_type_id_fkey FOREIGN KEY (contact_type_id) REFERENCES contact_type(id),
    CONSTRAINT organization_contacts_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id)
);

-- =============================================================================
-- GAMES
-- =============================================================================

CREATE TABLE games (
    id                  UUID            NOT NULL,
    name                VARCHAR(255)    NOT NULL,
    short_description   VARCHAR(255)    NULL,
    description         TEXT            NULL,
    release_date        DATE            NULL,
    owner_org_id        UUID            NULL,
    owner_id            UUID            NULL,
    genre               VARCHAR(50)     NOT NULL,
    engine              VARCHAR(30)     NULL,
    stage               VARCHAR(30)     NOT NULL,
    idiomas             TEXT            NULL,
    CONSTRAINT games_pkey PRIMARY KEY (id),
    CONSTRAINT games_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id),
    CONSTRAINT games_owner_org_id_fkey FOREIGN KEY (owner_org_id) REFERENCES organizations(id)
);

CREATE TABLE games_teams (
    id              SERIAL          NOT NULL,
    game_id         UUID            NOT NULL,
    team_member_id  UUID            NOT NULL,
    roles           VARCHAR(50)     NULL,
    CONSTRAINT games_teams_pkey PRIMARY KEY (id),
    CONSTRAINT games_teams_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id),
    CONSTRAINT games_teams_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES users(id)
);

CREATE TABLE game_platforms (
    game_id     UUID        NOT NULL,
    platform    VARCHAR(30) NOT NULL,
    CONSTRAINT game_platforms_pkey PRIMARY KEY (game_id, platform),
    CONSTRAINT game_platforms_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id)
);

CREATE TABLE review (
    id          SERIAL          NOT NULL,
    game_id     UUID            NULL,
    reviewer_id UUID            NULL,
    note        INTEGER         NULL,
    description TEXT            NULL,
    created_at  TIMESTAMP       DEFAULT NOW() NOT NULL,
    CONSTRAINT review_pkey PRIMARY KEY (id),
    CONSTRAINT review_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id),
    CONSTRAINT review_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES users(id)
);

CREATE TABLE store_page (
    id              SERIAL          NOT NULL,
    game_id         UUID            NULL,
    page_url        VARCHAR(255)    NULL,
    store_type_id   INTEGER         NULL,
    price           NUMERIC(10,2)   NULL,
    CONSTRAINT store_page_pkey PRIMARY KEY (id),
    CONSTRAINT store_page_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id),
    CONSTRAINT store_page_store_type_id_fkey FOREIGN KEY (store_type_id) REFERENCES game_store(id)
);

-- =============================================================================
-- EVENTOS / AGENDA
-- =============================================================================

CREATE TABLE events (
    id                  UUID        NOT NULL,
    title               VARCHAR(255) NOT NULL,
    slug                VARCHAR(255) NULL,
    description         TEXT        NULL,
    event_type          VARCHAR(30)  DEFAULT 'general' NOT NULL,
    visibility          VARCHAR(20)  DEFAULT 'public' NOT NULL,
    status              VARCHAR(20)  DEFAULT 'draft' NOT NULL,
    created_by          UUID        NOT NULL,
    studio_id           INTEGER     NULL,
    location_name       VARCHAR(255) NULL,
    location_url        VARCHAR(512) NULL,
    is_online           BOOLEAN     DEFAULT false NOT NULL,
    online_url          VARCHAR(512) NULL,
    starts_at           TIMESTAMP   NOT NULL,
    ends_at             TIMESTAMP   NOT NULL,
    is_all_day          BOOLEAN     DEFAULT false NOT NULL,
    is_recurring        BOOLEAN     DEFAULT false NOT NULL,
    recurrence_rule_id  INTEGER     NULL,
    banner_image_id     VARCHAR(256) NULL,
    game_id             INTEGER     NULL,
    created_at          TIMESTAMP   DEFAULT NOW() NOT NULL,
    updated_at          TIMESTAMP   DEFAULT NOW() NOT NULL,
    CONSTRAINT events_pkey PRIMARY KEY (id),
    CONSTRAINT events_banner_image_id_fkey FOREIGN KEY (banner_image_id) REFERENCES uploaded_images(id),
    CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT events_recurrence_rule_id_fkey FOREIGN KEY (recurrence_rule_id) REFERENCES event_recurrence_rules(id)
);

CREATE TABLE event_instances (
    id                   UUID         NOT NULL,
    event_id             UUID         NOT NULL,
    starts_at            TIMESTAMP    NOT NULL,
    ends_at              TIMESTAMP    NOT NULL,
    is_cancelled         BOOLEAN      DEFAULT false NOT NULL,
    override_title       VARCHAR(255) NULL,
    override_description TEXT         NULL,
    created_at           TIMESTAMP    DEFAULT NOW() NOT NULL,
    CONSTRAINT event_instances_pkey PRIMARY KEY (id),
    CONSTRAINT event_instances_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE event_invitations (
    id              UUID        NOT NULL,
    event_id        UUID        NOT NULL,
    invited_user_id UUID        NOT NULL,
    invited_by      UUID        NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending' NOT NULL,
    created_at      TIMESTAMP   DEFAULT NOW() NOT NULL,
    updated_at      TIMESTAMP   DEFAULT NOW() NOT NULL,
    CONSTRAINT event_invitations_pkey PRIMARY KEY (id),
    CONSTRAINT event_invitations_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id),
    CONSTRAINT event_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES users(id),
    CONSTRAINT event_invitations_invited_user_id_fkey FOREIGN KEY (invited_user_id) REFERENCES users(id)
);

CREATE TABLE event_rsvps (
    id          UUID        NOT NULL,
    event_id    UUID        NOT NULL,
    instance_id UUID        NULL,
    user_id     UUID        NOT NULL,
    status      VARCHAR(20) DEFAULT 'going' NOT NULL,
    created_at  TIMESTAMP   DEFAULT NOW() NOT NULL,
    updated_at  TIMESTAMP   DEFAULT NOW() NOT NULL,
    CONSTRAINT event_rsvps_pkey PRIMARY KEY (id),
    CONSTRAINT event_rsvps_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id),
    CONSTRAINT event_rsvps_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES event_instances(id),
    CONSTRAINT event_rsvps_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE event_org_rsvps (
    id              UUID        NOT NULL DEFAULT gen_random_uuid(),
    event_id        UUID        NOT NULL,
    organization_id UUID        NOT NULL,
    confirmed_by    UUID        NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT event_org_rsvps_pkey PRIMARY KEY (id),
    CONSTRAINT uq_event_org_rsvp UNIQUE (event_id, organization_id),
    CONSTRAINT event_org_rsvps_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT event_org_rsvps_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT event_org_rsvps_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================================================
-- POSTS
-- =============================================================================

CREATE TABLE posts (
    id              SERIAL      NOT NULL,
    author_id       UUID        NOT NULL,
    organization_id UUID        NULL,
    event_id        UUID        NULL,
    content         TEXT        NULL,
    img             VARCHAR(256) NULL,
    created_at      TIMESTAMP   DEFAULT NOW() NOT NULL,
    visibility      VARCHAR(20) DEFAULT 'public' NOT NULL,
    parent_post_id  INTEGER     NULL,
    embed           TEXT        NULL,
    CONSTRAINT posts_pkey PRIMARY KEY (id),
    CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id),
    CONSTRAINT posts_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id),
    CONSTRAINT posts_images_id_fkey FOREIGN KEY (img) REFERENCES uploaded_images(id),
    CONSTRAINT posts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT posts_parent_post_id_fkey FOREIGN KEY (parent_post_id) REFERENCES posts(id)
);

CREATE TABLE comments (
    id          SERIAL      NOT NULL,
    post_id     INTEGER     NOT NULL,
    author_id   UUID        NOT NULL,
    content     TEXT        NULL,
    created_at  TIMESTAMP   DEFAULT NOW() NOT NULL,
    CONSTRAINT comments_pkey PRIMARY KEY (id),
    CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id),
    CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id)
);

CREATE TABLE post_likes (
    post_id     INTEGER     NOT NULL,
    user_id     UUID        NOT NULL,
    created_at  TIMESTAMP   DEFAULT NOW() NOT NULL,
    CONSTRAINT post_likes_pkey PRIMARY KEY (post_id, user_id),
    CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id),
    CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE post_notifications (
    user_id         UUID        NOT NULL,
    type            VARCHAR(30) NOT NULL,
    source_user_id  UUID        NOT NULL,
    post_id         INTEGER     NOT NULL,
    is_read         BOOLEAN     NULL,
    created_at      TIMESTAMP   DEFAULT NOW() NOT NULL,
    CONSTRAINT post_notifications_pkey PRIMARY KEY (user_id, source_user_id, post_id, type),
    CONSTRAINT notifications_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id),
    CONSTRAINT notifications_source_user_id_fkey FOREIGN KEY (source_user_id) REFERENCES users(id),
    CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT post_notifications_type_fkey FOREIGN KEY (type) REFERENCES notification_messages(type)
);

CREATE TABLE post_tags (
    post_id     INTEGER     NOT NULL,
    tag_id      UUID        NOT NULL,
    created_at  TIMESTAMP   DEFAULT NOW() NOT NULL,
    CONSTRAINT post_tags_pk PRIMARY KEY (post_id, tag_id),
    CONSTRAINT post_tags_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id),
    CONSTRAINT post_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES tags(id)
);

-- ======================================================
-- Estúdios (organizations v2) — migration 1779580800000
-- ======================================================

CREATE TYPE org_member_role AS ENUM ('admin', 'member');
CREATE TYPE org_invitation_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled');
CREATE TYPE org_transfer_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled');

-- A tabela organizations já existe; colunas adicionadas pela migration:
ALTER TABLE organizations
    ADD COLUMN slug              VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN cnpj              VARCHAR(18),
    ADD COLUMN pitch             TEXT,
    ADD COLUMN founded_at        DATE,
    ADD COLUMN banner_image_id   VARCHAR(256) REFERENCES uploaded_images(id) ON DELETE SET NULL,
    ADD COLUMN banner_video_url  VARCHAR(512),
    ADD COLUMN address_id        UUID REFERENCES addresses(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX organizations_slug_unique_idx    ON organizations (slug);
CREATE UNIQUE INDEX organizations_owner_id_unique_idx ON organizations (owner_id);

-- org_members: remove roles TEXT, adiciona joined_at e status
ALTER TABLE org_members
    DROP COLUMN IF EXISTS roles,
    ADD COLUMN joined_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
    ADD COLUMN status    VARCHAR(20)  NOT NULL DEFAULT 'active';

CREATE TABLE org_roles (
    org_id      UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    member_id   UUID            NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    role        org_member_role NOT NULL,
    granted_at  TIMESTAMPTZ     NOT NULL DEFAULT (timezone('utc', now())),
    granted_by  UUID            REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT org_roles_pkey PRIMARY KEY (org_id, member_id, role)
);

CREATE TABLE org_invitations (
    id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID                    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invited_user_id UUID                    NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    invited_by      UUID                    NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    role            org_member_role         NOT NULL DEFAULT 'member',
    status          org_invitation_status   NOT NULL DEFAULT 'pending',
    message         VARCHAR(500),
    created_at      TIMESTAMPTZ             NOT NULL DEFAULT (timezone('utc', now())),
    updated_at      TIMESTAMPTZ             NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE UNIQUE INDEX org_invitations_pending_unique_idx
    ON org_invitations (org_id, invited_user_id)
    WHERE status = 'pending';

CREATE TABLE org_ownership_transfers (
    id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID                    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    from_user_id    UUID                    NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    to_user_id      UUID                    NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    status          org_transfer_status     NOT NULL DEFAULT 'pending',
    requested_at    TIMESTAMPTZ             NOT NULL DEFAULT (timezone('utc', now())),
    responded_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX org_transfers_pending_unique_idx
    ON org_ownership_transfers (org_id)
    WHERE status = 'pending';
