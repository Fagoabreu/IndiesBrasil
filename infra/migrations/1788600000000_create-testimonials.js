/**
 * Migration: create_testimonials
 *
 * Depoimentos de membros exibidos na landing page e no press kit.
 * Cada depoimento pertence a um usuário (author_id) e passa por um status
 * simples: "pending" (aguardando moderação), "approved" (visível) e
 * "rejected". Novos depoimentos já nascem "approved" neste primeiro
 * momento, com o campo pronto para uma futura moderação.
 */

/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable("testimonials", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    author_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    content: { type: "text", notNull: true },
    role: { type: "varchar(80)" },
    status: {
      type: "varchar(20)",
      notNull: true,
      default: "approved",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.addConstraint("testimonials", "testimonials_status_check", {
    check: "status IN ('pending', 'approved', 'rejected')",
  });

  pgm.createIndex("testimonials", ["status", "created_at"], {
    name: "testimonials_status_created_at_idx",
  });
};

exports.down = (pgm) => {
  pgm.dropTable("testimonials");
};
