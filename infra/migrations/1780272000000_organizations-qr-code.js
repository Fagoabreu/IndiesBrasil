/**
 * Migration: QR Code para organizações (estúdios)
 *
 * Adiciona `qr_code_id` em `organizations`, seguindo o mesmo padrão
 * já estabelecido para `users.qr_code_id`.
 */

exports.up = (pgm) => {
  pgm.addColumn("organizations", {
    qr_code_id: {
      type: "uuid",
      references: '"qr_codes"(id)',
      onDelete: "SET NULL",
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("organizations", "qr_code_id");
};
