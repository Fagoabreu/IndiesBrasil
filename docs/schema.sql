-- IndiesDB -- DDL do banco de dados (schema atual)
-- Data: 2026-09-06
--
-- Gerado a partir do banco de desenvolvimento (infra/compose.yaml) no estado
-- apos TODAS as migrations de infra/migrations. Espelha fielmente o schema
-- (tipos ENUM, SERIAL, defaults, constraints e indices) e e executavel de
-- ponta a ponta (ordenacao topologica por dependencias de FK).
-- Para atualizar: suba o postgres de dev, crie um banco limpo, rode
-- `npm run migrations:up` (DATABASE_URL apontando para ele) e regenere este
-- arquivo a partir do catalogo.

-- =====================================================================================
-- TIPOS (ENUM)
-- =====================================================================================

CREATE TYPE developer_role AS ENUM (
    'Designer de Jogos',
    'Designer de Nivel',
    'Desenvolvedor de Sistema',
    'Desenvolvedor de Narrativa',
    'Designer Tecnico',
    'Artista 2D',
    'Artista 3D',
    'Animador',
    'Artista Técnico',
    'Programador de Jogos',
    'Programador de Motor',
    'Prgramador Grafico',
    'Programador de Jogabilidade',
    'Desenvolvedor de Audio',
    'Compositor',
    'Produtor',
    'Socio',
    'Diretor Tecnico',
    'Analista QA',
    'Escritor',
    'Designer de UI UX',
    'Gestor de Comunidade',
    'Educador',
    'Produtor Digital',
    'Jornalista'
);

CREATE TYPE event_status AS ENUM (
    'draft',
    'published',
    'cancelled'
);

CREATE TYPE event_type AS ENUM (
    'general',
    'game_launch',
    'game_jam',
    'stream_marathon',
    'meeting',
    'studio'
);

CREATE TYPE experience_type AS ENUM (
    'Estudante',
    'Junior',
    'Pleno',
    'Senior',
    'Especialista'
);

CREATE TYPE frequency AS ENUM (
    'daily',
    'weekly',
    'monthly',
    'yearly'
);

CREATE TYPE game_development_stage AS ENUM (
    'planning',
    'pre-production',
    'production',
    'pre-release',
    'released',
    'post-production'
);

CREATE TYPE game_engine AS ENUM (
    'Unreal',
    'Unity',
    'Godot',
    'GameMaker',
    'Cave',
    'construct',
    'MonoGame',
    'AppGameKit',
    'RPG Maker',
    'Stencyl',
    'Roblox',
    'GDevelop',
    'Armory3D',
    'CopperCube',
    'CryEngine',
    'Evergine',
    'FalcoEngine',
    'FlaxEngine',
    'G3D',
    'GameGuru',
    'JMonkeyEngine',
    'O3DE',
    'PlayCanvas',
    'Stride',
    'UltraEngine',
    'UPBGE',
    'Wicked',
    'Cocos'
);

CREATE TYPE game_genre AS ENUM (
    'Shooter',
    'Platformer',
    'Hack and slash',
    'Fighting',
    'Stealth',
    'Survival',
    'Survival horror',
    'Battle royale',
    'Point-and-click',
    'Visual novel',
    'Interactive fiction',
    'Action RPG',
    'Japanese RPG (JRPG)',
    'Roguelike RPG',
    'MMORPG',
    'Life simulation',
    'Construction and management simulation',
    'Vehicle simulation',
    'Real-time strategy (RTS)',
    'Multiplayer online battle arena (MOBA)',
    'Turn-based strategy (TBS)',
    'Tower defense',
    '4X',
    'Racing',
    'Sports simulators',
    'Puzzle',
    'Sandbox',
    'beat em up'
);

CREATE TYPE game_platform AS ENUM (
    'Playstation',
    'Xbox',
    'Nintendo Switch',
    'Mega Drive',
    'Lupi',
    'Web',
    'Linux',
    'Windows',
    'iOS',
    'Android',
    'Board Game',
    'Card Game',
    'VR',
    'Cloud',
    'Arcade'
);

CREATE TYPE game_store_enum AS ENUM (
    'Microsoft Store',
    'Nintendo eShop',
    'PlayStation Store',
    'Amazon Appstore',
    'Apple App Store',
    'Google Play Store',
    'Huawei AppGallery',
    'Itch.io',
    'Samsung Galaxy Store',
    'TapTap',
    'Tencent AppStore',
    'Big Fish Games',
    'Direct2Drive',
    'DotEmu',
    'GameHouse',
    'Game Jolt',
    'GamersGate',
    'Green Man Gaming',
    'Metaboli',
    'Newgrounds',
    'Steam',
    'GOG.com',
    'Humble Store',
    'Zoom Platform',
    'Amazon Games',
    'Battle.net',
    'Beamdog',
    'Epic Games Store',
    'Gog Galaxy',
    'EA app',
    'Riot Client',
    'Rockstar Games Launcher',
    'Ubisoft Connect',
    'WeGame',
    'outros'
);

CREATE TYPE invitation_status AS ENUM (
    'pending',
    'accepted',
    'declined'
);

CREATE TYPE media_type AS ENUM (
    'image',
    'video',
    'link'
);

CREATE TYPE moderation_action AS ENUM (
    'ban',
    'block'
);

CREATE TYPE notification_type AS ENUM (
    'new_follower',
    'post_liked',
    'post_commented',
    'event_invite',
    'portfolio_liked',
    'moderation_action',
    'reminder',
    'studio_invitation',
    'store_order_received',
    'store_order_updated'
);

CREATE TYPE org_invitation_status AS ENUM (
    'pending',
    'accepted',
    'declined',
    'cancelled'
);

CREATE TYPE org_member_role AS ENUM (
    'admin',
    'member'
);

CREATE TYPE org_role AS ENUM (
    'Programer',
    'Artist'
);

CREATE TYPE org_transfer_status AS ENUM (
    'pending',
    'accepted',
    'declined',
    'cancelled'
);

CREATE TYPE rsvp_status AS ENUM (
    'going',
    'maybe',
    'not_going'
);

CREATE TYPE visibility_type AS ENUM (
    'private',
    'followers',
    'members',
    'public'
);

-- =====================================================================================
-- ENDERECOS
-- =====================================================================================

CREATE TABLE addresses (
    id            UUID DEFAULT gen_random_uuid() NOT NULL,
    street        VARCHAR(255),
    number        VARCHAR(20),
    complement    VARCHAR(100),
    neighborhood  VARCHAR(100),
    city          VARCHAR(100) NOT NULL,
    state         CHAR(2) NOT NULL,
    zip_code      VARCHAR(8),
    country       VARCHAR(50) DEFAULT '''Brasil''' NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    updated_at    TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT addresses_pkey  PRIMARY KEY (id)
);
CREATE INDEX addresses_city_state_index ON addresses (city, state);

-- =====================================================================================
-- USUARIOS, AUTENTICACAO E PERFIL
-- =====================================================================================

CREATE TABLE uploaded_images (
    id             VARCHAR(256) NOT NULL,
    public_id      VARCHAR(256),
    display_name   VARCHAR(256),
    filename       VARCHAR(256) NOT NULL,
    width          INTEGER,
    height         INTEGER,
    format         VARCHAR(32),
    tags           VARCHAR(128)[] DEFAULT '{}' NOT NULL,
    resource_type  VARCHAR(256),
    secure_url     VARCHAR(512),
    created_at     TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT uploaded_images_pkey  PRIMARY KEY (id)
);

-- =====================================================================================
-- QR CODES
-- =====================================================================================

CREATE TABLE qr_codes (
    id             UUID DEFAULT gen_random_uuid() NOT NULL,
    fg_color       VARCHAR(7) DEFAULT '#000000' NOT NULL,
    bg_color       VARCHAR(7) DEFAULT '#ffffff' NOT NULL,
    logo_size      INTEGER DEFAULT 24 NOT NULL,
    logo_image_id  VARCHAR(256),
    created_at     TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    updated_at     TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT qr_codes_pkey                PRIMARY KEY (id),
    CONSTRAINT qr_codes_logo_image_id_fkey  FOREIGN KEY (logo_image_id) REFERENCES uploaded_images(id) ON DELETE SET NULL
);

-- =====================================================================================
-- USUARIOS, AUTENTICACAO E PERFIL
-- =====================================================================================

CREATE TABLE users (
    id                UUID DEFAULT gen_random_uuid() NOT NULL,
    username          VARCHAR(39) NOT NULL,
    email             VARCHAR(254) NOT NULL,
    password          VARCHAR(60) NOT NULL,
    cpf               NUMERIC(11, 0) NOT NULL,
    created_at        TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    updated_at        TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    features          VARCHAR(64)[] DEFAULT '{}' NOT NULL,
    avatar_image      VARCHAR(256) DEFAULT NULL,
    resumo            VARCHAR(128),
    bio               TEXT,
    visibility        visibility_type DEFAULT 'public' NOT NULL,
    background_image  VARCHAR(256),
    birth_date        DATE,
    qr_code_id        UUID,
    reputation        INTEGER DEFAULT 0 NOT NULL,
    CONSTRAINT users_pkey                   PRIMARY KEY (id),
    CONSTRAINT users_cpf_key                UNIQUE (cpf),
    CONSTRAINT users_email_key              UNIQUE (email),
    CONSTRAINT users_username_key           UNIQUE (username),
    CONSTRAINT user_images_id_fkey          FOREIGN KEY (avatar_image) REFERENCES uploaded_images(id),
    CONSTRAINT users_background_image_fkey  FOREIGN KEY (background_image) REFERENCES uploaded_images(id),
    CONSTRAINT users_qr_code_id_fkey        FOREIGN KEY (qr_code_id) REFERENCES qr_codes(id) ON DELETE SET NULL
);

-- =====================================================================================
-- ORGANIZACOES / ESTUDIOS
-- =====================================================================================

CREATE TABLE organizations (
    id                  UUID NOT NULL,
    owner_id            UUID NOT NULL,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    history             TEXT,
    img                 VARCHAR(256),
    slug                VARCHAR(255) NOT NULL,
    cnpj                VARCHAR(18),
    pitch               TEXT,
    founded_at          DATE,
    banner_image_id     VARCHAR(256),
    banner_video_url    VARCHAR(512),
    address_id          UUID,
    twitch_channel      VARCHAR(100),
    youtube_channel_id  VARCHAR(100),
    qr_code_id          UUID,
    website             VARCHAR(512),
    features            TEXT,
    CONSTRAINT organizations_pkey                  PRIMARY KEY (id),
    CONSTRAINT organizations_address_id_fkey       FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL,
    CONSTRAINT organizations_banner_image_id_fkey  FOREIGN KEY (banner_image_id) REFERENCES uploaded_images(id) ON DELETE SET NULL,
    CONSTRAINT organizations_images_id_fkey        FOREIGN KEY (img) REFERENCES uploaded_images(id),
    CONSTRAINT organizations_owner_id_fkey         FOREIGN KEY (owner_id) REFERENCES users(id),
    CONSTRAINT organizations_qr_code_id_fkey       FOREIGN KEY (qr_code_id) REFERENCES qr_codes(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX organizations_owner_id_unique_idx ON organizations (owner_id);
CREATE UNIQUE INDEX organizations_slug_unique_index ON organizations (slug);

-- =====================================================================================
-- BOARDGAMES
-- =====================================================================================

CREATE TABLE boardgames (
    id                      UUID DEFAULT gen_random_uuid() NOT NULL,
    slug                    VARCHAR(120) NOT NULL,
    name                    VARCHAR(255) NOT NULL,
    short_description       VARCHAR(255),
    description             TEXT,
    category                VARCHAR(30) DEFAULT '''board_game''' NOT NULL,
    stage                   VARCHAR(30) DEFAULT '''concept''' NOT NULL,
    player_count_min        SMALLINT,
    player_count_max        SMALLINT,
    play_time_min           SMALLINT,
    play_time_max           SMALLINT,
    age_rating              SMALLINT,
    weight                  NUMERIC(3, 1),
    release_date            DATE,
    owner_org_id            UUID,
    owner_id                UUID,
    website_url             VARCHAR(512),
    cover_image_id          VARCHAR(256),
    banner_image_id         VARCHAR(256),
    created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
    content_rating          VARCHAR(4),
    content_rating_reasons  TEXT,
    content_rated_at        TIMESTAMPTZ,
    CONSTRAINT boardgames_pkey                  PRIMARY KEY (id),
    CONSTRAINT boardgames_slug_key              UNIQUE (slug),
    CONSTRAINT boardgames_banner_image_id_fkey  FOREIGN KEY (banner_image_id) REFERENCES uploaded_images(id) ON DELETE SET NULL,
    CONSTRAINT boardgames_cover_image_id_fkey   FOREIGN KEY (cover_image_id) REFERENCES uploaded_images(id) ON DELETE SET NULL,
    CONSTRAINT boardgames_owner_id_fkey         FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT boardgames_owner_org_id_fkey     FOREIGN KEY (owner_org_id) REFERENCES organizations(id) ON DELETE SET NULL
);
CREATE INDEX boardgames_category_index ON boardgames (category);
CREATE INDEX boardgames_owner_org_id_index ON boardgames (owner_org_id);
CREATE INDEX boardgames_stage_index ON boardgames (stage);

CREATE TABLE boardgame_followers (
    boardgame_id  UUID NOT NULL,
    follower_id   UUID NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT boardgame_followers_pkey               PRIMARY KEY (boardgame_id, follower_id),
    CONSTRAINT boardgame_followers_boardgame_id_fkey  FOREIGN KEY (boardgame_id) REFERENCES boardgames(id) ON DELETE CASCADE,
    CONSTRAINT boardgame_followers_follower_id_fkey   FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE boardgame_mechanics (
    boardgame_id  UUID NOT NULL,
    mechanic      VARCHAR(60) NOT NULL,
    CONSTRAINT boardgame_mechanics_pkey               PRIMARY KEY (boardgame_id, mechanic),
    CONSTRAINT boardgame_mechanics_boardgame_id_fkey  FOREIGN KEY (boardgame_id) REFERENCES boardgames(id) ON DELETE CASCADE
);

CREATE TABLE boardgame_media (
    id             SERIAL NOT NULL,
    boardgame_id   UUID NOT NULL,
    media_type     VARCHAR(10) NOT NULL,
    url            VARCHAR(512) NOT NULL,
    caption        VARCHAR(255),
    display_order  INTEGER DEFAULT 0 NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT boardgame_media_pkey               PRIMARY KEY (id),
    CONSTRAINT boardgame_media_boardgame_id_fkey  FOREIGN KEY (boardgame_id) REFERENCES boardgames(id) ON DELETE CASCADE
);
CREATE INDEX boardgame_media_boardgame_id_index ON boardgame_media (boardgame_id);

CREATE TABLE boardgame_reviews (
    id            SERIAL NOT NULL,
    boardgame_id  UUID NOT NULL,
    reviewer_id   UUID NOT NULL,
    rating        INTEGER NOT NULL,
    content       TEXT,
    created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT boardgame_reviews_pkey                          PRIMARY KEY (id),
    CONSTRAINT boardgame_reviews_boardgame_id_reviewer_id_key  UNIQUE (boardgame_id, reviewer_id),
    CONSTRAINT boardgame_reviews_rating_check                  CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT boardgame_reviews_boardgame_id_fkey             FOREIGN KEY (boardgame_id) REFERENCES boardgames(id) ON DELETE CASCADE,
    CONSTRAINT boardgame_reviews_reviewer_id_fkey              FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX boardgame_reviews_boardgame_id_idx ON boardgame_reviews (boardgame_id);
CREATE INDEX boardgame_reviews_reviewer_id_idx ON boardgame_reviews (reviewer_id);

-- =====================================================================================
-- LIVROS
-- =====================================================================================

CREATE TABLE books (
    id                      UUID DEFAULT gen_random_uuid() NOT NULL,
    slug                    VARCHAR(120) NOT NULL,
    title                   VARCHAR(255) NOT NULL,
    subtitle                VARCHAR(255),
    short_description       VARCHAR(255),
    description             TEXT,
    book_type               VARCHAR(30) DEFAULT '''book''' NOT NULL,
    isbn                    VARCHAR(20),
    publisher               VARCHAR(200),
    edition                 VARCHAR(80),
    pages                   SMALLINT,
    language                VARCHAR(60) DEFAULT '''Português''',
    release_date            DATE,
    stage                   VARCHAR(30) DEFAULT '''concept''' NOT NULL,
    website_url             VARCHAR(512),
    buy_url                 VARCHAR(512),
    cover_url_external      VARCHAR(512),
    cover_image_id          VARCHAR(256),
    owner_org_id            UUID,
    owner_id                UUID,
    created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
    pdf_url                 VARCHAR(512),
    content_rating          VARCHAR(4),
    content_rating_reasons  TEXT,
    content_rated_at        TIMESTAMPTZ,
    pdf_image_id            VARCHAR(256),
    CONSTRAINT books_pkey                 PRIMARY KEY (id),
    CONSTRAINT books_slug_key             UNIQUE (slug),
    CONSTRAINT books_cover_image_id_fkey  FOREIGN KEY (cover_image_id) REFERENCES uploaded_images(id) ON DELETE SET NULL,
    CONSTRAINT books_owner_id_fkey        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT books_owner_org_id_fkey    FOREIGN KEY (owner_org_id) REFERENCES organizations(id) ON DELETE SET NULL
);
CREATE INDEX books_book_type_index ON books (book_type);
CREATE INDEX books_owner_org_id_index ON books (owner_org_id);
CREATE INDEX books_stage_index ON books (stage);

CREATE TABLE book_followers (
    book_id      UUID NOT NULL,
    follower_id  UUID NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT book_followers_pkey              PRIMARY KEY (book_id, follower_id),
    CONSTRAINT book_followers_book_id_fkey      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    CONSTRAINT book_followers_follower_id_fkey  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX book_followers_follower_id_index ON book_followers (follower_id);

CREATE TABLE book_reviews (
    id           SERIAL NOT NULL,
    book_id      UUID NOT NULL,
    reviewer_id  UUID NOT NULL,
    rating       INTEGER NOT NULL,
    content      TEXT,
    created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT book_reviews_pkey                     PRIMARY KEY (id),
    CONSTRAINT book_reviews_book_id_reviewer_id_key  UNIQUE (book_id, reviewer_id),
    CONSTRAINT book_reviews_rating_check             CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT book_reviews_book_id_fkey             FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    CONSTRAINT book_reviews_reviewer_id_fkey         FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX book_reviews_book_id_idx ON book_reviews (book_id);
CREATE INDEX book_reviews_reviewer_id_idx ON book_reviews (reviewer_id);

CREATE TABLE book_store (
    id        SERIAL NOT NULL,
    name      VARCHAR(80) NOT NULL,
    CONSTRAINT book_store_pkey  PRIMARY KEY (id)
);

CREATE TABLE book_store_page (
    id             SERIAL NOT NULL,
    book_id        UUID NOT NULL,
    store_type_id  INTEGER NOT NULL,
    page_url       VARCHAR(512),
    price          NUMERIC(10, 2),
    CONSTRAINT book_store_page_pkey                PRIMARY KEY (id),
    CONSTRAINT book_store_page_book_id_fkey        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    CONSTRAINT book_store_page_store_type_id_fkey  FOREIGN KEY (store_type_id) REFERENCES book_store(id) ON DELETE RESTRICT
);
CREATE INDEX book_store_page_book_id_index ON book_store_page (book_id);

-- =====================================================================================
-- EVENTOS / AGENDA
-- =====================================================================================

CREATE TABLE event_recurrence_rules (
    id               SERIAL NOT NULL,
    frequency        frequency NOT NULL,
    interval         INTEGER DEFAULT 1 NOT NULL,
    days_of_week     INTEGER[],
    week_of_month    INTEGER,
    day_of_month     INTEGER,
    months_of_year   INTEGER[],
    until_date       DATE,
    max_occurrences  INTEGER,
    created_at       TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT event_recurrence_rules_pkey   PRIMARY KEY (id),
    CONSTRAINT recurrence_interval_positive  CHECK (("interval" > 0))
);

CREATE TABLE events (
    id                   UUID DEFAULT gen_random_uuid() NOT NULL,
    title                VARCHAR(255) NOT NULL,
    slug                 VARCHAR(255),
    description          TEXT,
    event_type           event_type DEFAULT 'general' NOT NULL,
    visibility           visibility_type DEFAULT 'public' NOT NULL,
    status               event_status DEFAULT 'draft' NOT NULL,
    created_by           UUID NOT NULL,
    studio_id            INTEGER,
    location_name        VARCHAR(255),
    location_url         VARCHAR(512),
    is_online            BOOLEAN DEFAULT false NOT NULL,
    online_url           VARCHAR(512),
    starts_at            TIMESTAMPTZ NOT NULL,
    ends_at              TIMESTAMPTZ NOT NULL,
    is_all_day           BOOLEAN DEFAULT false NOT NULL,
    is_recurring         BOOLEAN DEFAULT false NOT NULL,
    recurrence_rule_id   INTEGER,
    banner_image_id      VARCHAR(256),
    game_id              INTEGER,
    created_at           TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    updated_at           TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    banner_external_url  VARCHAR(512),
    address_id           UUID,
    ticket_url           TEXT,
    CONSTRAINT events_pkey                     PRIMARY KEY (id),
    CONSTRAINT events_ends_after_starts        CHECK ((ends_at >= starts_at)),
    CONSTRAINT events_recurring_requires_rule  CHECK (((is_recurring = false) OR (recurrence_rule_id IS NOT NULL))),
    CONSTRAINT events_address_id_fkey          FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL,
    CONSTRAINT events_banner_image_id_fkey     FOREIGN KEY (banner_image_id) REFERENCES uploaded_images(id) ON DELETE SET NULL,
    CONSTRAINT events_created_by_fkey          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT events_recurrence_rule_id_fkey  FOREIGN KEY (recurrence_rule_id) REFERENCES event_recurrence_rules(id) ON DELETE SET NULL
);
CREATE INDEX idx_events_created_by ON events (created_by);
CREATE UNIQUE INDEX idx_events_slug ON events (slug) WHERE (slug IS NOT NULL);
CREATE INDEX idx_events_starts_at ON events (starts_at);
CREATE INDEX idx_events_status_visibility ON events (status, visibility);
CREATE INDEX idx_events_type ON events (event_type);

-- =====================================================================================
-- ENQUETES
-- =====================================================================================

CREATE TABLE polls (
    id          SERIAL NOT NULL,
    question    TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    ended_at    TIMESTAMPTZ,
    CONSTRAINT polls_pkey  PRIMARY KEY (id)
);

-- =====================================================================================
-- POSTS / FEED
-- =====================================================================================

CREATE TABLE posts (
    id               INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    author_id        UUID NOT NULL,
    organization_id  UUID,
    content          TEXT,
    img              VARCHAR(256),
    created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    visibility       visibility_type DEFAULT 'public' NOT NULL,
    parent_post_id   INTEGER,
    embed            JSONB[],
    event_id         UUID,
    poll_id          INTEGER,
    CONSTRAINT posts_pkey                  PRIMARY KEY (id),
    CONSTRAINT posts_poll_id_unique        UNIQUE (poll_id),
    CONSTRAINT posts_author_id_fkey        FOREIGN KEY (author_id) REFERENCES users(id),
    CONSTRAINT posts_event_id_fkey         FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL,
    CONSTRAINT posts_images_id_fkey        FOREIGN KEY (img) REFERENCES uploaded_images(id),
    CONSTRAINT posts_organization_id_fkey  FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT posts_parent_post_id_fkey   FOREIGN KEY (parent_post_id) REFERENCES posts(id),
    CONSTRAINT posts_poll_id_fkey          FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE SET NULL
);
CREATE INDEX idx_posts_created_at ON posts (created_at);
CREATE INDEX idx_posts_event_id ON posts (event_id);
CREATE INDEX posts_poll_id_index ON posts (poll_id);

CREATE TABLE comments (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    post_id     INTEGER NOT NULL,
    author_id   UUID NOT NULL,
    content     TEXT,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT comments_pkey            PRIMARY KEY (id),
    CONSTRAINT comments_author_id_fkey  FOREIGN KEY (author_id) REFERENCES users(id),
    CONSTRAINT comments_post_id_fkey    FOREIGN KEY (post_id) REFERENCES posts(id)
);
CREATE INDEX idx_comments_post_id ON comments (post_id);

-- =====================================================================================
-- USUARIOS, AUTENTICACAO E PERFIL
-- =====================================================================================

CREATE TABLE contact_type (
    id        INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    icon_key  VARCHAR(64) NOT NULL,
    icon_img  VARCHAR(256),
    CONSTRAINT contact_type_pkey  PRIMARY KEY (id)
);

-- =====================================================================================
-- REVIEWS DE CONTEUDO
-- =====================================================================================

CREATE TABLE content_reviews (
    id               UUID NOT NULL,
    slug             VARCHAR(300) NOT NULL,
    title            VARCHAR(255) NOT NULL,
    author_id        UUID NOT NULL,
    content_type     VARCHAR(20) NOT NULL,
    content_id       UUID NOT NULL,
    cover_image_id   VARCHAR(256),
    rating           INTEGER,
    sections         TEXT DEFAULT '[]' NOT NULL,
    positive_points  TEXT DEFAULT '[]' NOT NULL,
    negative_points  TEXT DEFAULT '[]' NOT NULL,
    published_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
    cover_url        VARCHAR(2048),
    CONSTRAINT content_reviews_pkey                 PRIMARY KEY (id),
    CONSTRAINT content_reviews_slug_key             UNIQUE (slug),
    CONSTRAINT content_reviews_author_id_fkey       FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT content_reviews_cover_image_id_fkey  FOREIGN KEY (cover_image_id) REFERENCES uploaded_images(id)
);
CREATE INDEX content_reviews_author_id_idx ON content_reviews (author_id);
CREATE INDEX content_reviews_content_type_content_id_idx ON content_reviews (content_type, content_id);
CREATE INDEX content_reviews_published_at_idx ON content_reviews (published_at DESC);
CREATE INDEX content_reviews_slug_idx ON content_reviews (slug);

-- =====================================================================================
-- CURSOS
-- =====================================================================================

CREATE TABLE courses (
    id              UUID DEFAULT gen_random_uuid() NOT NULL,
    owner_id        UUID NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    slug            VARCHAR(255) NOT NULL,
    cover_image_id  VARCHAR(256),
    created_at      TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT courses_pkey                 PRIMARY KEY (id),
    CONSTRAINT courses_cover_image_id_fkey  FOREIGN KEY (cover_image_id) REFERENCES uploaded_images(id) ON DELETE SET NULL,
    CONSTRAINT courses_owner_id_fkey        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX courses_slug_unique_index ON courses (slug);

CREATE TABLE course_enrollments (
    id          UUID DEFAULT gen_random_uuid() NOT NULL,
    course_id   UUID NOT NULL,
    user_id     UUID NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT course_enrollments_pkey            PRIMARY KEY (id),
    CONSTRAINT course_enrollments_course_id_fkey  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT course_enrollments_user_id_fkey    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX course_enrollments_course_id_user_id_unique_index ON course_enrollments (course_id, user_id);
CREATE INDEX course_enrollments_user_id_index ON course_enrollments (user_id);

CREATE TABLE course_modules (
    id           UUID DEFAULT gen_random_uuid() NOT NULL,
    course_id    UUID NOT NULL,
    title        VARCHAR(255) NOT NULL,
    order_index  INTEGER DEFAULT 0 NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    updated_at   TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT course_modules_pkey            PRIMARY KEY (id),
    CONSTRAINT course_modules_course_id_fkey  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX course_modules_course_id_order_index_unique_index ON course_modules (course_id, order_index);

CREATE TABLE course_lessons (
    id                UUID DEFAULT gen_random_uuid() NOT NULL,
    course_id         UUID NOT NULL,
    title             VARCHAR(255) NOT NULL,
    description       TEXT,
    order_index       INTEGER DEFAULT 0 NOT NULL,
    video_url         VARCHAR(512),
    reading_material  TEXT,
    created_at        TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    updated_at        TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    module_id         UUID,
    CONSTRAINT course_lessons_pkey            PRIMARY KEY (id),
    CONSTRAINT course_lessons_course_id_fkey  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT course_lessons_module_id_fkey  FOREIGN KEY (module_id) REFERENCES course_modules(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX course_lessons_course_id_order_index_unique_index ON course_lessons (course_id, order_index);

CREATE TABLE course_progress (
    user_id       UUID NOT NULL,
    lesson_id     UUID NOT NULL,
    completed     BOOLEAN DEFAULT false NOT NULL,
    completed_at  TIMESTAMPTZ,
    CONSTRAINT course_progress_pkey            PRIMARY KEY (user_id, lesson_id),
    CONSTRAINT course_progress_lesson_id_fkey  FOREIGN KEY (lesson_id) REFERENCES course_lessons(id) ON DELETE CASCADE,
    CONSTRAINT course_progress_user_id_fkey    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE course_ratings (
    course_id   UUID NOT NULL,
    user_id     UUID NOT NULL,
    rating      INTEGER NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    review      TEXT,
    CONSTRAINT course_ratings_pkey            PRIMARY KEY (course_id, user_id),
    CONSTRAINT course_ratings_course_id_fkey  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT course_ratings_user_id_fkey    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================================================
-- POSTS / FEED
-- =====================================================================================

CREATE TABLE tags (
    id          UUID DEFAULT gen_random_uuid() NOT NULL,
    name        VARCHAR(50) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT tags_pkey      PRIMARY KEY (id),
    CONSTRAINT tags_name_key  UNIQUE (name)
);
CREATE INDEX idx_tags_name ON tags (name);

-- =====================================================================================
-- CURSOS
-- =====================================================================================

CREATE TABLE course_tags (
    course_id  UUID NOT NULL,
    tag_id     UUID NOT NULL,
    CONSTRAINT course_tags_pkey            PRIMARY KEY (course_id, tag_id),
    CONSTRAINT course_tags_course_id_fkey  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT course_tags_tag_id_fkey     FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- =====================================================================================
-- EVENTOS / AGENDA
-- =====================================================================================

CREATE TABLE event_instances (
    id                    UUID DEFAULT gen_random_uuid() NOT NULL,
    event_id              UUID NOT NULL,
    starts_at             TIMESTAMPTZ NOT NULL,
    ends_at               TIMESTAMPTZ NOT NULL,
    is_cancelled          BOOLEAN DEFAULT false NOT NULL,
    override_title        VARCHAR(255),
    override_description  TEXT,
    created_at            TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT event_instances_pkey               PRIMARY KEY (id),
    CONSTRAINT event_instances_ends_after_starts  CHECK ((ends_at >= starts_at)),
    CONSTRAINT event_instances_event_id_fkey      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE INDEX idx_event_instances_calendar ON event_instances (starts_at, ends_at) WHERE (is_cancelled = false);
CREATE INDEX idx_event_instances_event_id ON event_instances (event_id);

CREATE TABLE event_invitations (
    id               UUID DEFAULT gen_random_uuid() NOT NULL,
    event_id         UUID NOT NULL,
    invited_user_id  UUID NOT NULL,
    invited_by       UUID NOT NULL,
    status           invitation_status DEFAULT 'pending' NOT NULL,
    created_at       TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    updated_at       TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT event_invitations_pkey                  PRIMARY KEY (id),
    CONSTRAINT event_invitations_event_id_fkey         FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT event_invitations_invited_by_fkey       FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT event_invitations_invited_user_id_fkey  FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_event_invitations_invited_user ON event_invitations (invited_user_id);
CREATE UNIQUE INDEX uq_event_invitation ON event_invitations (event_id, invited_user_id);

CREATE TABLE event_org_rsvps (
    id               UUID DEFAULT gen_random_uuid() NOT NULL,
    event_id         UUID NOT NULL,
    organization_id  UUID NOT NULL,
    confirmed_by     UUID NOT NULL,
    created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT event_org_rsvps_pkey                  PRIMARY KEY (id),
    CONSTRAINT uq_event_org_rsvp                     UNIQUE (event_id, organization_id),
    CONSTRAINT event_org_rsvps_confirmed_by_fkey     FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT event_org_rsvps_event_id_fkey         FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT event_org_rsvps_organization_id_fkey  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE event_rsvps (
    id           UUID DEFAULT gen_random_uuid() NOT NULL,
    event_id     UUID NOT NULL,
    instance_id  UUID,
    user_id      UUID NOT NULL,
    status       rsvp_status DEFAULT 'going' NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    updated_at   TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT event_rsvps_pkey              PRIMARY KEY (id),
    CONSTRAINT event_rsvps_event_id_fkey     FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT event_rsvps_instance_id_fkey  FOREIGN KEY (instance_id) REFERENCES event_instances(id) ON DELETE CASCADE,
    CONSTRAINT event_rsvps_user_id_fkey      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_event_rsvps_user_id ON event_rsvps (user_id);
CREATE UNIQUE INDEX uq_event_rsvp_global ON event_rsvps (event_id, user_id) WHERE (instance_id IS NULL);
CREATE UNIQUE INDEX uq_event_rsvp_instance ON event_rsvps (event_id, instance_id, user_id) WHERE (instance_id IS NOT NULL);

-- =====================================================================================
-- GAMES
-- =====================================================================================

CREATE TABLE games (
    id                      UUID DEFAULT gen_random_uuid() NOT NULL,
    slug                    VARCHAR(120) NOT NULL,
    name                    VARCHAR(255) NOT NULL,
    short_description       VARCHAR(255),
    description             TEXT,
    release_date            DATE,
    owner_org_id            UUID,
    owner_id                UUID,
    genre                   VARCHAR(50) DEFAULT '''Indefinido''' NOT NULL,
    engine                  VARCHAR(50),
    stage                   VARCHAR(30) DEFAULT '''concept''' NOT NULL,
    website_url             VARCHAR(512),
    trailer_url             VARCHAR(512),
    cover_image_id          VARCHAR(256),
    banner_image_id         VARCHAR(256),
    created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
    content_rating          VARCHAR(4),
    content_rating_reasons  TEXT,
    content_rated_at        TIMESTAMPTZ,
    has_lootboxes           BOOLEAN DEFAULT false,
    has_in_game_purchases   BOOLEAN DEFAULT false,
    has_excessive_ads       BOOLEAN DEFAULT false,
    CONSTRAINT games_pkey                  PRIMARY KEY (id),
    CONSTRAINT games_slug_key              UNIQUE (slug),
    CONSTRAINT games_banner_image_id_fkey  FOREIGN KEY (banner_image_id) REFERENCES uploaded_images(id) ON DELETE SET NULL,
    CONSTRAINT games_cover_image_id_fkey   FOREIGN KEY (cover_image_id) REFERENCES uploaded_images(id) ON DELETE SET NULL,
    CONSTRAINT games_owner_id_fkey         FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT games_owner_org_id_fkey     FOREIGN KEY (owner_org_id) REFERENCES organizations(id) ON DELETE SET NULL
);
CREATE INDEX games_owner_org_id_index ON games (owner_org_id);
CREATE INDEX games_stage_index ON games (stage);

CREATE TABLE game_followers (
    game_id      UUID NOT NULL,
    follower_id  UUID NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT game_followers_pkey              PRIMARY KEY (game_id, follower_id),
    CONSTRAINT game_followers_follower_id_fkey  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT game_followers_game_id_fkey      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE TABLE game_media (
    id             SERIAL NOT NULL,
    game_id        UUID NOT NULL,
    media_type     VARCHAR(10) NOT NULL,
    url            VARCHAR(512) NOT NULL,
    caption        VARCHAR(255),
    display_order  INTEGER DEFAULT 0 NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT game_media_pkey          PRIMARY KEY (id),
    CONSTRAINT game_media_game_id_fkey  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
CREATE INDEX game_media_game_id_index ON game_media (game_id);

CREATE TABLE game_platforms (
    game_id   UUID NOT NULL,
    platform  VARCHAR(30) NOT NULL,
    CONSTRAINT game_platforms_pkey          PRIMARY KEY (game_id, platform),
    CONSTRAINT game_platforms_game_id_fkey  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE TABLE game_reviews (
    id           SERIAL NOT NULL,
    game_id      UUID NOT NULL,
    reviewer_id  UUID NOT NULL,
    rating       SMALLINT NOT NULL,
    content      TEXT,
    created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT game_reviews_pkey                PRIMARY KEY (id),
    CONSTRAINT game_reviews_game_reviewer_uniq  UNIQUE (game_id, reviewer_id),
    CONSTRAINT game_reviews_rating_check        CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT game_reviews_game_id_fkey        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    CONSTRAINT game_reviews_reviewer_id_fkey    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX game_reviews_game_id_index ON game_reviews (game_id);

CREATE TABLE game_store (
    id        SERIAL NOT NULL,
    name      VARCHAR(50) NOT NULL,
    ico       VARCHAR(256),
    CONSTRAINT game_store_pkey      PRIMARY KEY (id),
    CONSTRAINT game_store_ico_fkey  FOREIGN KEY (ico) REFERENCES uploaded_images(id) ON DELETE SET NULL
);

CREATE TABLE game_tags (
    game_id   UUID NOT NULL,
    tag_id    UUID NOT NULL,
    CONSTRAINT game_tags_pkey          PRIMARY KEY (game_id, tag_id),
    CONSTRAINT game_tags_game_id_fkey  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    CONSTRAINT game_tags_tag_id_fkey   FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE games_teams (
    id              SERIAL NOT NULL,
    game_id         UUID NOT NULL,
    team_member_id  UUID NOT NULL,
    roles           VARCHAR(100),
    CONSTRAINT games_teams_pkey                 PRIMARY KEY (id),
    CONSTRAINT games_teams_game_member_uniq     UNIQUE (game_id, team_member_id),
    CONSTRAINT games_teams_game_id_fkey         FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    CONSTRAINT games_teams_team_member_id_fkey  FOREIGN KEY (team_member_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX games_teams_game_id_index ON games_teams (game_id);

-- =====================================================================================
-- CURSOS
-- =====================================================================================

CREATE TABLE lesson_comments (
    id          UUID DEFAULT gen_random_uuid() NOT NULL,
    lesson_id   UUID NOT NULL,
    author_id   UUID NOT NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT lesson_comments_pkey            PRIMARY KEY (id),
    CONSTRAINT lesson_comments_author_id_fkey  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT lesson_comments_lesson_id_fkey  FOREIGN KEY (lesson_id) REFERENCES course_lessons(id) ON DELETE CASCADE
);
CREATE INDEX lesson_comments_lesson_id_created_at_index ON lesson_comments (lesson_id, created_at);

-- =====================================================================================
-- REUNIOES / WEBCONFERENCIA (GALENE)
-- =====================================================================================

CREATE TABLE meetings (
    id                     UUID DEFAULT gen_random_uuid() NOT NULL,
    org_id                 UUID NOT NULL,
    created_by             UUID NOT NULL,
    title                  VARCHAR(255) NOT NULL,
    description            TEXT,
    room_id                VARCHAR(64) NOT NULL,
    starts_at              TIMESTAMPTZ NOT NULL,
    ends_at                TIMESTAMPTZ NOT NULL,
    status                 VARCHAR(20) DEFAULT 'scheduled' NOT NULL,
    guest_code_hash        VARCHAR(64),
    guest_code_expires_at  TIMESTAMPTZ,
    max_participants       INTEGER,
    created_at             TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at             TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT meetings_pkey              PRIMARY KEY (id),
    CONSTRAINT meetings_room_id_unique    UNIQUE (room_id),
    CONSTRAINT meetings_status_check      CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'live'::character varying, 'ended'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT meetings_time_range_check  CHECK ((ends_at > starts_at)),
    CONSTRAINT meetings_created_by_fkey   FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT meetings_org_id_fkey       FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE INDEX meetings_created_by_index ON meetings (created_by);
CREATE INDEX meetings_org_id_starts_at_index ON meetings (org_id, starts_at);

-- =====================================================================================
-- MODERACAO, DENUNCIAS E REPUTACAO
-- =====================================================================================

CREATE TABLE moderation_actions (
    id             UUID DEFAULT gen_random_uuid() NOT NULL,
    target_type    VARCHAR(20) NOT NULL,
    target_id      VARCHAR(64) NOT NULL,
    action         VARCHAR(20) DEFAULT 'block' NOT NULL,
    reason         VARCHAR(50) NOT NULL,
    justification  TEXT,
    moderator_id   UUID NOT NULL,
    expires_at     TIMESTAMPTZ,
    revoked_at     TIMESTAMPTZ,
    revoked_by     UUID,
    created_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT moderation_actions_pkey               PRIMARY KEY (id),
    CONSTRAINT moderation_actions_moderator_id_fkey  FOREIGN KEY (moderator_id) REFERENCES users(id),
    CONSTRAINT moderation_actions_revoked_by_fkey    FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX moderation_actions_expires_at_idx ON moderation_actions (expires_at);
CREATE INDEX moderation_actions_revoked_at_idx ON moderation_actions (revoked_at);
CREATE INDEX moderation_actions_target_type_target_id_idx ON moderation_actions (target_type, target_id);

-- =====================================================================================
-- NOTICIAS (NEWS)
-- =====================================================================================

CREATE TABLE news (
    id            SERIAL NOT NULL,
    author_id     UUID NOT NULL,
    title         TEXT NOT NULL,
    summary       TEXT NOT NULL,
    body          TEXT NOT NULL,
    img           VARCHAR(256),
    source_url    TEXT,
    source_label  TEXT,
    created_at    TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    updated_at    TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT news_pkey            PRIMARY KEY (id),
    CONSTRAINT news_author_id_fkey  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT news_img_fkey        FOREIGN KEY (img) REFERENCES uploaded_images(id) ON DELETE SET NULL
);
CREATE INDEX news_author_id_index ON news (author_id);
CREATE INDEX news_created_at_index ON news (created_at);

CREATE TABLE news_comments (
    id          SERIAL NOT NULL,
    news_id     INTEGER NOT NULL,
    author_id   UUID NOT NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT news_comments_pkey            PRIMARY KEY (id),
    CONSTRAINT news_comments_author_id_fkey  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT news_comments_news_id_fkey    FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE
);
CREATE INDEX news_comments_author_id_index ON news_comments (author_id);
CREATE INDEX news_comments_news_id_index ON news_comments (news_id);

CREATE TABLE news_factchecks (
    id          SERIAL NOT NULL,
    news_id     INTEGER NOT NULL,
    user_id     UUID NOT NULL,
    vote        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT news_factchecks_pkey              PRIMARY KEY (id),
    CONSTRAINT news_factchecks_news_user_unique  UNIQUE (news_id, user_id),
    CONSTRAINT news_factchecks_vote_check        CHECK ((vote = ANY (ARRAY['factcheck'::text, 'fake'::text]))),
    CONSTRAINT news_factchecks_news_id_fkey      FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
    CONSTRAINT news_factchecks_user_id_fkey      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE news_ratings (
    id          SERIAL NOT NULL,
    news_id     INTEGER NOT NULL,
    user_id     UUID NOT NULL,
    rating      SMALLINT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT news_ratings_pkey              PRIMARY KEY (id),
    CONSTRAINT news_ratings_news_user_unique  UNIQUE (news_id, user_id),
    CONSTRAINT news_ratings_rating_check      CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT news_ratings_news_id_fkey      FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
    CONSTRAINT news_ratings_user_id_fkey      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE news_sources (
    id          SERIAL NOT NULL,
    news_id     INTEGER NOT NULL,
    url         TEXT NOT NULL,
    label       TEXT,
    created_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT news_sources_pkey          PRIMARY KEY (id),
    CONSTRAINT news_sources_news_id_fkey  FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE
);
CREATE INDEX news_sources_news_id_index ON news_sources (news_id);

-- =====================================================================================
-- USUARIOS, AUTENTICACAO E PERFIL
-- =====================================================================================

CREATE TABLE notification_messages (
    type        notification_type NOT NULL,
    title       VARCHAR(64),
    message     VARCHAR(512),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT notification_messages_pkey  PRIMARY KEY (type)
);

-- =====================================================================================
-- ORGANIZACOES / ESTUDIOS
-- =====================================================================================

CREATE TABLE org_followers (
    org_id       UUID NOT NULL,
    follower_id  UUID NOT NULL,
    CONSTRAINT org_followers_pkey              PRIMARY KEY (org_id, follower_id),
    CONSTRAINT org_followers_follower_id_fkey  FOREIGN KEY (follower_id) REFERENCES users(id),
    CONSTRAINT org_followers_org_id_fkey       FOREIGN KEY (org_id) REFERENCES organizations(id)
);

CREATE TABLE org_invitations (
    id               UUID DEFAULT gen_random_uuid() NOT NULL,
    org_id           UUID NOT NULL,
    invited_user_id  UUID NOT NULL,
    invited_by       UUID NOT NULL,
    role             org_member_role DEFAULT 'member' NOT NULL,
    status           org_invitation_status DEFAULT 'pending' NOT NULL,
    message          VARCHAR(500),
    created_at       TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    updated_at       TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT org_invitations_pkey                  PRIMARY KEY (id),
    CONSTRAINT org_invitations_invited_by_fkey       FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT org_invitations_invited_user_id_fkey  FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT org_invitations_org_id_fkey           FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX org_invitations_pending_unique_idx ON org_invitations (org_id, invited_user_id) WHERE (status = 'pending'::org_invitation_status);

CREATE TABLE org_members (
    org_id     UUID NOT NULL,
    member_id  UUID NOT NULL,
    joined_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    status     VARCHAR(20) DEFAULT 'active' NOT NULL,
    CONSTRAINT org_members_pkey            PRIMARY KEY (org_id, member_id),
    CONSTRAINT org_members_member_id_fkey  FOREIGN KEY (member_id) REFERENCES users(id),
    CONSTRAINT org_members_org_id_fkey     FOREIGN KEY (org_id) REFERENCES organizations(id)
);

CREATE TABLE org_ownership_transfers (
    id            UUID DEFAULT gen_random_uuid() NOT NULL,
    org_id        UUID NOT NULL,
    from_user_id  UUID NOT NULL,
    to_user_id    UUID NOT NULL,
    status        org_transfer_status DEFAULT 'pending' NOT NULL,
    requested_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    responded_at  TIMESTAMPTZ,
    CONSTRAINT org_ownership_transfers_pkey               PRIMARY KEY (id),
    CONSTRAINT org_ownership_transfers_from_user_id_fkey  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT org_ownership_transfers_org_id_fkey        FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT org_ownership_transfers_to_user_id_fkey    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX org_ownership_transfers_pending_unique_idx ON org_ownership_transfers (org_id) WHERE (status = 'pending'::org_transfer_status);

CREATE TABLE org_relationships (
    id                    UUID DEFAULT gen_random_uuid() NOT NULL,
    org_a_id              UUID NOT NULL,
    org_b_id              UUID NOT NULL,
    relationship_type     VARCHAR(50) DEFAULT 'partner' NOT NULL,
    status                VARCHAR(20) DEFAULT 'pending' NOT NULL,
    requested_by_org_id   UUID NOT NULL,
    requested_by_user_id  UUID NOT NULL,
    responded_by_user_id  UUID,
    created_at            TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at            TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT org_relationships_pkey                    PRIMARY KEY (id),
    CONSTRAINT uq_org_relationship_pair                  UNIQUE (org_a_id, org_b_id),
    CONSTRAINT chk_org_relationship_normalized           CHECK ((org_a_id < org_b_id)),
    CONSTRAINT chk_org_relationship_status               CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT chk_org_relationship_type                 CHECK (((relationship_type)::text = ANY ((ARRAY['partner'::character varying, 'distributor'::character varying, 'cooperative'::character varying, 'workers_association'::character varying, 'collective'::character varying, 'publisher'::character varying, 'incubator'::character varying, 'investor'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT chk_requested_by_org                      CHECK (((requested_by_org_id = org_a_id) OR (requested_by_org_id = org_b_id))),
    CONSTRAINT org_relationships_org_a_fkey              FOREIGN KEY (org_a_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT org_relationships_org_b_fkey              FOREIGN KEY (org_b_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT org_relationships_requested_by_user_fkey  FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT org_relationships_responded_by_user_fkey  FOREIGN KEY (responded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE org_roles (
    org_id      UUID NOT NULL,
    member_id   UUID NOT NULL,
    role        org_member_role NOT NULL,
    granted_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    granted_by  UUID,
    CONSTRAINT org_roles_pkey             PRIMARY KEY (org_id, member_id, role),
    CONSTRAINT org_roles_granted_by_fkey  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT org_roles_member_id_fkey   FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT org_roles_org_id_fkey      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE org_stream_status (
    org_id                UUID NOT NULL,
    platform              VARCHAR(10) NOT NULL,
    is_live               BOOLEAN DEFAULT false NOT NULL,
    viewer_count          INTEGER,
    stream_title          TEXT,
    stream_thumbnail_url  VARCHAR(512),
    category_name         VARCHAR(255),
    checked_at            TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT org_stream_status_pkey         PRIMARY KEY (org_id, platform),
    CONSTRAINT org_stream_status_org_id_fkey  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE organization_contacts (
    id               INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    contact_type_id  INTEGER,
    org_id           UUID,
    contact_value    VARCHAR(255),
    CONSTRAINT organization_contacts_pkey                  PRIMARY KEY (id),
    CONSTRAINT organization_contacts_contact_type_id_fkey  FOREIGN KEY (contact_type_id) REFERENCES contact_type(id),
    CONSTRAINT organization_contacts_org_id_fkey           FOREIGN KEY (org_id) REFERENCES organizations(id)
);

-- =====================================================================================
-- CONTROLE DE MIGRACOES
-- =====================================================================================

CREATE TABLE pgmigrations (
    id        SERIAL NOT NULL,
    name      VARCHAR(255) NOT NULL,
    run_on    TIMESTAMP NOT NULL,
    CONSTRAINT pgmigrations_pkey  PRIMARY KEY (id)
);

-- =====================================================================================
-- ENQUETES
-- =====================================================================================

CREATE TABLE poll_options (
    id          SERIAL NOT NULL,
    poll_id     INTEGER NOT NULL,
    label       TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT poll_options_pkey          PRIMARY KEY (id),
    CONSTRAINT poll_options_poll_id_fkey  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
);
CREATE INDEX poll_options_poll_id_index ON poll_options (poll_id);

CREATE TABLE poll_votes (
    id              SERIAL NOT NULL,
    poll_option_id  INTEGER NOT NULL,
    user_id         UUID NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT poll_votes_pkey                 PRIMARY KEY (id),
    CONSTRAINT poll_votes_option_user_unique   UNIQUE (poll_option_id, user_id),
    CONSTRAINT poll_votes_poll_option_id_fkey  FOREIGN KEY (poll_option_id) REFERENCES poll_options(id) ON DELETE CASCADE,
    CONSTRAINT poll_votes_user_id_fkey         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX poll_votes_poll_option_id_index ON poll_votes (poll_option_id);
CREATE INDEX poll_votes_user_id_index ON poll_votes (user_id);

-- =====================================================================================
-- USUARIOS, AUTENTICACAO E PERFIL
-- =====================================================================================

CREATE TABLE portfolio_formacao (
    id           SERIAL NOT NULL,
    ordem        INTEGER NOT NULL,
    nome         VARCHAR(256),
    init_date    DATE NOT NULL,
    end_date     DATE,
    instituicao  VARCHAR(256) NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    user_id      UUID NOT NULL,
    CONSTRAINT portfolio_formacao_pkey          PRIMARY KEY (id),
    CONSTRAINT portfolio_formacao_user_id_fkey  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_portfolio_formacao_user_ordem ON portfolio_formacao (user_id, ordem);

CREATE TABLE portfolio_historico (
    id           SERIAL NOT NULL,
    ordem        INTEGER NOT NULL,
    cargo        VARCHAR(128),
    init_date    DATE NOT NULL,
    end_date     DATE,
    company      VARCHAR(256) NOT NULL,
    cidade       VARCHAR(256) NOT NULL,
    estado       VARCHAR(128),
    atribuicoes  VARCHAR[],
    created_at   TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    user_id      UUID NOT NULL,
    CONSTRAINT portfolio_historico_pkey          PRIMARY KEY (id),
    CONSTRAINT portfolio_historico_user_id_fkey  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_portfolio_historico_user_ordem ON portfolio_historico (user_id, ordem);

CREATE TABLE portfolio_medias (
    id          INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    media       media_type NOT NULL,
    url         TEXT,
    caption     VARCHAR(255),
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id     UUID NOT NULL,
    CONSTRAINT portfolio_medias_pkey          PRIMARY KEY (id),
    CONSTRAINT portfolio_medias_url_key       UNIQUE (url),
    CONSTRAINT portfolio_medias_user_id_fkey  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE portfolio_roles (
    name      developer_role NOT NULL,
    icon_img  VARCHAR(256),
    CONSTRAINT portfolio_roles_pkey  PRIMARY KEY (name)
);

CREATE TABLE portfolio_role_ref (
    experience           experience_type,
    user_id              UUID NOT NULL,
    ordem                INTEGER DEFAULT 0 NOT NULL,
    portfolio_role_name  developer_role NOT NULL,
    CONSTRAINT portfolio_role_ref_pkey                      PRIMARY KEY (user_id, portfolio_role_name),
    CONSTRAINT portfolio_role_ref_portfolio_role_name_fkey  FOREIGN KEY (portfolio_role_name) REFERENCES portfolio_roles(name),
    CONSTRAINT portfolio_role_ref_user_id_fkey              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE portfolio_tools (
    id        INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    name      VARCHAR(255),
    icon_img  VARCHAR(256),
    CONSTRAINT portfolio_tools_pkey  PRIMARY KEY (id)
);

CREATE TABLE portfolio_tool_ref (
    portfolio_tool_id  INTEGER NOT NULL,
    experience         experience_type,
    user_id            UUID NOT NULL,
    CONSTRAINT portfolio_tool_ref_portfolio_tool_id_fkey  FOREIGN KEY (portfolio_tool_id) REFERENCES portfolio_tools(id),
    CONSTRAINT portfolio_tool_ref_user_id_fkey            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================================================
-- POSTS / FEED
-- =====================================================================================

CREATE TABLE post_likes (
    post_id     INTEGER NOT NULL,
    user_id     UUID NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT post_likes_pkey          PRIMARY KEY (post_id, user_id),
    CONSTRAINT post_likes_post_id_fkey  FOREIGN KEY (post_id) REFERENCES posts(id),
    CONSTRAINT post_likes_user_id_fkey  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_post_likes_post_id ON post_likes (post_id);
CREATE INDEX idx_post_likes_user_post ON post_likes (user_id, post_id);

CREATE TABLE post_notifications (
    user_id         UUID NOT NULL,
    type            notification_type NOT NULL,
    source_user_id  UUID NOT NULL,
    post_id         INTEGER NOT NULL,
    is_read         BOOLEAN,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT post_notifications_pkey            PRIMARY KEY (user_id, source_user_id, post_id, type),
    CONSTRAINT notifications_post_id_fkey         FOREIGN KEY (post_id) REFERENCES posts(id),
    CONSTRAINT notifications_source_user_id_fkey  FOREIGN KEY (source_user_id) REFERENCES users(id),
    CONSTRAINT notifications_user_id_fkey         FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT post_notifications_type_fkey       FOREIGN KEY (type) REFERENCES notification_messages(type)
);

CREATE TABLE post_tags (
    post_id     INTEGER NOT NULL,
    tag_id      UUID NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT post_tags_pk            PRIMARY KEY (post_id, tag_id),
    CONSTRAINT post_tags_post_id_fkey  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT post_tags_tag_id_fkey   FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
CREATE INDEX idx_post_tags_created_at ON post_tags (created_at);

-- =====================================================================================
-- MODERACAO, DENUNCIAS E REPUTACAO
-- =====================================================================================

CREATE TABLE reports (
    id               UUID DEFAULT gen_random_uuid() NOT NULL,
    reporter_id      UUID NOT NULL,
    target_type      VARCHAR(20) NOT NULL,
    target_id        VARCHAR(64) NOT NULL,
    reason           VARCHAR(50) NOT NULL,
    justification    TEXT,
    status           VARCHAR(20) DEFAULT 'pending' NOT NULL,
    created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
    resolved_at      TIMESTAMPTZ,
    resolved_by      UUID,
    resolution_note  TEXT,
    CONSTRAINT reports_pkey              PRIMARY KEY (id),
    CONSTRAINT reports_reporter_id_fkey  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT reports_resolved_by_fkey  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX reports_one_pending_per_target ON reports (reporter_id, target_type, target_id) WHERE ((status)::text = 'pending'::text);
CREATE INDEX reports_reporter_id_idx ON reports (reporter_id);
CREATE INDEX reports_status_created_at_idx ON reports (status, created_at DESC);
CREATE INDEX reports_target_type_target_id_idx ON reports (target_type, target_id);

CREATE TABLE reputation_events (
    id            UUID DEFAULT gen_random_uuid() NOT NULL,
    user_id       UUID NOT NULL,
    action        VARCHAR(40) NOT NULL,
    points        INTEGER NOT NULL,
    reference_id  VARCHAR(64) NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT reputation_events_pkey          PRIMARY KEY (id),
    CONSTRAINT reputation_events_user_id_fkey  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX reputation_events_one_per_target ON reputation_events (user_id, action, reference_id);
CREATE INDEX reputation_events_user_created ON reputation_events (user_id, created_at DESC);

-- =====================================================================================
-- USUARIOS, AUTENTICACAO E PERFIL
-- =====================================================================================

CREATE TABLE roles (
    id        INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    name      VARCHAR(100) NOT NULL,
    CONSTRAINT roles_pkey      PRIMARY KEY (id),
    CONSTRAINT roles_name_key  UNIQUE (name)
);

CREATE TABLE sessions (
    id          UUID DEFAULT gen_random_uuid() NOT NULL,
    token       VARCHAR(96) NOT NULL,
    user_id     UUID NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT sessions_pkey       PRIMARY KEY (id),
    CONSTRAINT sessions_token_key  UNIQUE (token)
);

-- =====================================================================================
-- LOJA (STORE)
-- =====================================================================================

CREATE TABLE store_products (
    id               UUID DEFAULT gen_random_uuid() NOT NULL,
    organization_id  UUID NOT NULL,
    slug             VARCHAR(255) NOT NULL,
    name             VARCHAR(255) NOT NULL,
    description      TEXT,
    type             VARCHAR(20) DEFAULT 'physical' NOT NULL,
    price            NUMERIC(10, 2) NOT NULL,
    image_id         VARCHAR(256),
    status           VARCHAR(20) DEFAULT 'active' NOT NULL,
    delivery_notes   TEXT,
    created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT store_products_pkey                  PRIMARY KEY (id),
    CONSTRAINT store_products_price_nonnegative     CHECK ((price >= (0)::numeric)),
    CONSTRAINT store_products_status_check          CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[]))),
    CONSTRAINT store_products_type_check            CHECK (((type)::text = ANY ((ARRAY['physical'::character varying, 'digital'::character varying])::text[]))),
    CONSTRAINT store_products_image_id_fkey         FOREIGN KEY (image_id) REFERENCES uploaded_images(id) ON DELETE SET NULL,
    CONSTRAINT store_products_organization_id_fkey  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE INDEX store_products_org_idx ON store_products (organization_id);
CREATE UNIQUE INDEX store_products_slug_unique ON store_products (slug);

CREATE TABLE store_orders (
    id                      UUID DEFAULT gen_random_uuid() NOT NULL,
    product_id              UUID,
    organization_id         UUID NOT NULL,
    buyer_id                UUID,
    status                  VARCHAR(20) DEFAULT 'pending' NOT NULL,
    quantity                INTEGER DEFAULT 1 NOT NULL,
    address_id              UUID,
    price_snapshot          NUMERIC(10, 2) NOT NULL,
    delivery_cost           NUMERIC(10, 2),
    delivery_deadline_days  INTEGER,
    total                   NUMERIC(10, 2) NOT NULL,
    buyer_note              TEXT,
    created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT store_orders_pkey                  PRIMARY KEY (id),
    CONSTRAINT store_orders_quantity_check        CHECK ((quantity > 0)),
    CONSTRAINT store_orders_status_check          CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'quoted'::character varying, 'accepted'::character varying, 'paid'::character varying, 'shipped'::character varying, 'delivered'::character varying, 'cancelled'::character varying, 'declined'::character varying])::text[]))),
    CONSTRAINT store_orders_total_nonnegative     CHECK ((total >= (0)::numeric)),
    CONSTRAINT store_orders_address_id_fkey       FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL,
    CONSTRAINT store_orders_buyer_id_fkey         FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT store_orders_organization_id_fkey  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT store_orders_product_id_fkey       FOREIGN KEY (product_id) REFERENCES store_products(id) ON DELETE SET NULL
);
CREATE INDEX store_orders_buyer_idx ON store_orders (buyer_id);
CREATE INDEX store_orders_org_idx ON store_orders (organization_id);

CREATE TABLE store_order_events (
    id          UUID DEFAULT gen_random_uuid() NOT NULL,
    order_id    UUID NOT NULL,
    status      VARCHAR(20) NOT NULL,
    note        TEXT,
    created_by  UUID,
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT store_order_events_pkey             PRIMARY KEY (id),
    CONSTRAINT store_order_events_created_by_fkey  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT store_order_events_order_id_fkey    FOREIGN KEY (order_id) REFERENCES store_orders(id) ON DELETE CASCADE
);
CREATE INDEX store_order_events_order_idx ON store_order_events (order_id, created_at);

-- =====================================================================================
-- GAMES
-- =====================================================================================

CREATE TABLE store_page (
    id             SERIAL NOT NULL,
    game_id        UUID,
    page_url       VARCHAR(255),
    store_type_id  INTEGER,
    price          NUMERIC(10, 2),
    CONSTRAINT store_page_pkey                PRIMARY KEY (id),
    CONSTRAINT store_page_game_id_fkey        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    CONSTRAINT store_page_store_type_id_fkey  FOREIGN KEY (store_type_id) REFERENCES game_store(id) ON DELETE SET NULL
);
CREATE INDEX store_page_game_id_index ON store_page (game_id);

-- =====================================================================================
-- LOJA (STORE)
-- =====================================================================================

CREATE TABLE store_product_images (
    id             SERIAL NOT NULL,
    product_id     UUID NOT NULL,
    image_id       VARCHAR(256) NOT NULL,
    display_order  INTEGER DEFAULT 0 NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT store_product_images_pkey             PRIMARY KEY (id),
    CONSTRAINT store_product_images_image_id_fkey    FOREIGN KEY (image_id) REFERENCES uploaded_images(id) ON DELETE CASCADE,
    CONSTRAINT store_product_images_product_id_fkey  FOREIGN KEY (product_id) REFERENCES store_products(id) ON DELETE CASCADE
);
CREATE INDEX store_product_images_image_id_index ON store_product_images (image_id);
CREATE INDEX store_product_images_product_id_index ON store_product_images (product_id);

-- =====================================================================================
-- USUARIOS, AUTENTICACAO E PERFIL
-- =====================================================================================

CREATE TABLE user_activation_tokens (
    id          UUID DEFAULT gen_random_uuid() NOT NULL,
    used_at     TIMESTAMPTZ,
    user_id     UUID NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT (timezone('utc', now())) NOT NULL,
    CONSTRAINT user_activation_tokens_pkey  PRIMARY KEY (id)
);

-- =====================================================================================
-- ENDERECOS
-- =====================================================================================

CREATE TABLE user_addresses (
    id          UUID DEFAULT gen_random_uuid() NOT NULL,
    user_id     UUID NOT NULL,
    address_id  UUID NOT NULL,
    label       VARCHAR(50),
    is_default  BOOLEAN DEFAULT false NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT user_addresses_pkey                 PRIMARY KEY (id),
    CONSTRAINT user_addresses_user_address_unique  UNIQUE (user_id, address_id),
    CONSTRAINT user_addresses_address_id_fkey      FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE CASCADE,
    CONSTRAINT user_addresses_user_id_fkey         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX user_addresses_user_id_index ON user_addresses (user_id);

-- =====================================================================================
-- USUARIOS, AUTENTICACAO E PERFIL
-- =====================================================================================

CREATE TABLE user_followers (
    follower_id   UUID NOT NULL,
    lead_user_id  UUID NOT NULL,
    CONSTRAINT user_followers_pkey               PRIMARY KEY (follower_id, lead_user_id),
    CONSTRAINT user_followers_follower_id_fkey   FOREIGN KEY (follower_id) REFERENCES users(id),
    CONSTRAINT user_followers_lead_user_id_fkey  FOREIGN KEY (lead_user_id) REFERENCES users(id)
);

CREATE TABLE user_notifications (
    user_id         UUID NOT NULL,
    type            notification_type NOT NULL,
    source_user_id  UUID NOT NULL,
    is_read         BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    org_slug        VARCHAR(128) DEFAULT '' NOT NULL,
    CONSTRAINT user_notifications_pkey                 PRIMARY KEY (user_id, type, source_user_id, org_slug),
    CONSTRAINT user_notifications_source_user_id_fkey  FOREIGN KEY (source_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT user_notifications_user_id_fkey         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE user_roles (
    user_id   UUID NOT NULL,
    role_id   INTEGER NOT NULL,
    CONSTRAINT user_roles_pkey          PRIMARY KEY (user_id, role_id),
    CONSTRAINT user_roles_role_id_fkey  FOREIGN KEY (role_id) REFERENCES roles(id),
    CONSTRAINT user_roles_user_id_fkey  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE users_contacts (
    id               INTEGER GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    contact_type_id  INTEGER,
    user_id          UUID,
    contact_value    VARCHAR(255),
    CONSTRAINT users_contacts_pkey                  PRIMARY KEY (id),
    CONSTRAINT users_contacts_contact_type_id_fkey  FOREIGN KEY (contact_type_id) REFERENCES contact_type(id),
    CONSTRAINT users_contacts_user_id_fkey          FOREIGN KEY (user_id) REFERENCES users(id)
);

