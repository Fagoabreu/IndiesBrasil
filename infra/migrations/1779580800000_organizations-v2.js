/**
 * Migration: Organizations V2 — Estúdios de jogos
 *
 * Alterações em tabelas existentes:
 *   organizations     — slug, cnpj, pitch, founded_at, banner_image_id,
 *                       banner_video_url, address_id
 *   org_members       — remove coluna `roles` (TEXT), adiciona joined_at,
 *                       coluna status (active | removed)
 *
 * Tabelas criadas:
 *   org_roles              — associação (org_id, member_id, role)
 *   org_invitations        — convites pendentes / histórico
 *   org_ownership_transfers — transferências de responsabilidade
 *
 * Enums criados:
 *   org_member_role        — admin | member
 *   org_invitation_status  — pending | accepted | declined | cancelled
 *   org_transfer_status    — pending | accepted | declined | cancelled
 *
 * Constraints notáveis:
 *   organizations.owner_id    — UNIQUE (1 estúdio por dono ao mesmo tempo)
 *   org_roles (PK)            — (org_id, member_id, role)
 *   org_invitations           — UNIQUE (org_id, invited_user_id) para pending
 */

exports.up = (pgm) => {
  /* ---------------------------------------------------------------
   * 1. ENUMS
   * --------------------------------------------------------------- */
  pgm.sql(`
    CREATE TYPE org_member_role AS ENUM ('admin', 'member');
    CREATE TYPE org_invitation_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled');
    CREATE TYPE org_transfer_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled');
  `);

  /* ---------------------------------------------------------------
   * 2. EXPANDIR organizations
   * --------------------------------------------------------------- */
  pgm.addColumns("organizations", {
    slug: {
      type: "varchar(255)",
      notNull: true,
      default: "placeholder", // será preenchido pelo UPDATE abaixo
    },
    cnpj: { type: "varchar(18)" },
    pitch: { type: "text" },
    founded_at: { type: "date" },
    banner_image_id: {
      type: "varchar(256)",
      references: "uploaded_images(id)",
      onDelete: "SET NULL",
    },
    banner_video_url: { type: "varchar(512)" },
    address_id: {
      type: "uuid",
      references: "addresses(id)",
      onDelete: "SET NULL",
    },
  });

  // Índice único por slug
  pgm.createIndex("organizations", ["slug"], { unique: true });

  // Garante que cada usuário seja dono de no máximo 1 estúdio por vez
  pgm.createIndex("organizations", ["owner_id"], {
    unique: true,
    name: "organizations_owner_id_unique_idx",
  });

  /* ---------------------------------------------------------------
   * 3. MODIFICAR org_members
   * --------------------------------------------------------------- */
  pgm.dropColumn("org_members", "roles", { ifExists: true });
  pgm.addColumns("org_members", {
    joined_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
    status: {
      type: "varchar(20)",
      notNull: true,
      default: "active",
    },
  });

  /* ---------------------------------------------------------------
   * 4. org_roles
   * --------------------------------------------------------------- */
  pgm.createTable("org_roles", {
    org_id: {
      type: "uuid",
      notNull: true,
      references: "organizations(id)",
      onDelete: "CASCADE",
    },
    member_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    role: {
      type: "org_member_role",
      notNull: true,
    },
    granted_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
    granted_by: {
      type: "uuid",
      references: "users(id)",
      onDelete: "SET NULL",
    },
  });
  pgm.createConstraint("org_roles", "org_roles_pkey", {
    primaryKey: ["org_id", "member_id", "role"],
  });

  /* ---------------------------------------------------------------
   * 5. org_invitations
   * --------------------------------------------------------------- */
  pgm.createTable("org_invitations", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    org_id: {
      type: "uuid",
      notNull: true,
      references: "organizations(id)",
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
    role: {
      type: "org_member_role",
      notNull: true,
      default: pgm.func("'member'"),
    },
    status: {
      type: "org_invitation_status",
      notNull: true,
      default: pgm.func("'pending'"),
    },
    message: { type: "varchar(500)" },
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

  // Apenas 1 convite pendente por usuário por estúdio
  pgm.createIndex("org_invitations", ["org_id", "invited_user_id"], {
    unique: true,
    where: "status = 'pending'",
    name: "org_invitations_pending_unique_idx",
  });

  /* ---------------------------------------------------------------
   * 6. org_ownership_transfers
   * --------------------------------------------------------------- */
  pgm.createTable("org_ownership_transfers", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    org_id: {
      type: "uuid",
      notNull: true,
      references: "organizations(id)",
      onDelete: "CASCADE",
    },
    from_user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    to_user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    status: {
      type: "org_transfer_status",
      notNull: true,
      default: pgm.func("'pending'"),
    },
    requested_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
    responded_at: { type: "timestamptz" },
  });

  // Apenas 1 transferência pendente por estúdio por vez
  pgm.createIndex("org_ownership_transfers", ["org_id"], {
    unique: true,
    where: "status = 'pending'",
    name: "org_ownership_transfers_pending_unique_idx",
  });

  /* ---------------------------------------------------------------
   * 7. Gerar slugs para registros existentes (se houver)
   * --------------------------------------------------------------- */
  pgm.sql(`
    UPDATE organizations
    SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
             || '-' || substr(id::text, 1, 8)
    WHERE slug = 'placeholder' OR slug = '';
  `);

  // Agora que todos têm slug real, remove o default
  pgm.alterColumn("organizations", "slug", { default: null });
};

exports.down = (pgm) => {
  pgm.dropTable("org_ownership_transfers");
  pgm.dropTable("org_invitations");
  pgm.dropTable("org_roles");

  pgm.dropColumn("org_members", "joined_at");
  pgm.dropColumn("org_members", "status");
  pgm.addColumn("org_members", {
    roles: { type: "text", notNull: true, default: "[]" },
  });

  pgm.dropIndex("organizations", ["owner_id"], {
    name: "organizations_owner_id_unique_idx",
  });
  pgm.dropIndex("organizations", ["slug"]);
  pgm.dropColumn("organizations", "slug");
  pgm.dropColumn("organizations", "cnpj");
  pgm.dropColumn("organizations", "pitch");
  pgm.dropColumn("organizations", "founded_at");
  pgm.dropColumn("organizations", "banner_image_id");
  pgm.dropColumn("organizations", "banner_video_url");
  pgm.dropColumn("organizations", "address_id");

  pgm.sql(`
    DROP TYPE IF EXISTS org_transfer_status;
    DROP TYPE IF EXISTS org_invitation_status;
    DROP TYPE IF EXISTS org_member_role;
  `);
};
