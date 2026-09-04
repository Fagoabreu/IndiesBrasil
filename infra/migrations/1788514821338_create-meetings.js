/**
 * Migration: create_meetings
 *
 * Reuniões/webconferência agendadas por um estúdio (organization).
 * Cada reunião possui um `room_id` usado como grupo no Galene
 * (`groups/<roomId>.json`) e na audiência do JWT (`/group/<roomId>/`).
 *
 * O convidado externo usa um código temporário gerado pelo anfitrião:
 * apenas o hash SHA-256 é armazenado (guest_code_hash) junto da
 * expiração (guest_code_expires_at) — nunca o código em texto puro.
 */

/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable("meetings", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    org_id: {
      type: "uuid",
      notNull: true,
      references: "organizations(id)",
      onDelete: "CASCADE",
    },
    created_by: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
    },
    title: { type: "varchar(255)", notNull: true },
    description: { type: "text" },
    room_id: { type: "varchar(64)", notNull: true },
    starts_at: { type: "timestamptz", notNull: true },
    ends_at: { type: "timestamptz", notNull: true },
    status: {
      type: "varchar(20)",
      notNull: true,
      default: "scheduled",
    },
    guest_code_hash: { type: "varchar(64)" },
    guest_code_expires_at: { type: "timestamptz" },
    max_participants: { type: "integer" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.addConstraint("meetings", "meetings_room_id_unique", {
    unique: ["room_id"],
  });

  pgm.addConstraint("meetings", "meetings_status_check", {
    check: "status IN ('scheduled', 'live', 'ended', 'cancelled')",
  });

  pgm.addConstraint("meetings", "meetings_time_range_check", {
    check: "ends_at > starts_at",
  });

  pgm.createIndex("meetings", ["org_id", "starts_at"]);
  pgm.createIndex("meetings", "created_by");
};

/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable("meetings", { cascade: true });
};
