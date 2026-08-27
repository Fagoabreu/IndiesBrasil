/**
 * Migration: user_addresses
 *
 * Caderno de endereços do comprador. A tabela `addresses` continua genérica
 * (sem owner); o vínculo com o usuário é feito aqui, permitindo rótulo
 * ("Casa", "Trabalho"...) e um endereço padrão por usuário.
 */

/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable("user_addresses", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    address_id: {
      type: "uuid",
      notNull: true,
      references: "addresses(id)",
      onDelete: "CASCADE",
    },
    label: { type: "varchar(50)" },
    is_default: { type: "boolean", notNull: true, default: false },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.addConstraint("user_addresses", "user_addresses_user_address_unique", {
    unique: ["user_id", "address_id"],
  });

  pgm.createIndex("user_addresses", "user_id");
};

/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable("user_addresses", { cascade: true });
};
