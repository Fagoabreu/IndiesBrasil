/**
 * Migration: Tabela dedicada event_org_rsvps
 *
 * A abordagem anterior de adicionar organization_id em event_rsvps conflita
 * com o constraint uq_event_rsvp_global em (event_id, user_id).
 * Esta migration:
 *   1. Remove o índice e a coluna adicionados pela migration anterior
 *   2. Cria a tabela dedicada event_org_rsvps
 */

exports.up = (pgm) => {
  // Desfaz a migration anterior (que pode já ter rodado)
  pgm.dropIndex("event_rsvps", ["event_id", "organization_id"], {
    name: "uq_event_rsvp_org",
    ifExists: true,
  });
  pgm.dropColumn("event_rsvps", "organization_id", { ifExists: true });

  // Tabela dedicada para RSVPs de organizações
  pgm.createTable("event_org_rsvps", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    event_id: {
      type: "uuid",
      notNull: true,
      references: '"events"(id)',
      onDelete: "CASCADE",
    },
    organization_id: {
      type: "uuid",
      notNull: true,
      references: '"organizations"(id)',
      onDelete: "CASCADE",
    },
    confirmed_by: {
      type: "uuid",
      notNull: true,
      references: '"users"(id)',
      onDelete: "SET NULL",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.addConstraint("event_org_rsvps", "uq_event_org_rsvp", "UNIQUE (event_id, organization_id)");
};

exports.down = (pgm) => {
  pgm.dropTable("event_org_rsvps");

  pgm.addColumn("event_rsvps", {
    organization_id: {
      type: "uuid",
      notNull: false,
      references: '"organizations"(id)',
      onDelete: "CASCADE",
    },
  });

  pgm.addIndex("event_rsvps", ["event_id", "organization_id"], {
    unique: true,
    where: "organization_id IS NOT NULL AND instance_id IS NULL",
    name: "uq_event_rsvp_org",
  });
};
