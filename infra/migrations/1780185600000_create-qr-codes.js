/**
 * Migration: QR Codes
 *
 * Cria a tabela `qr_codes` para armazenar configurações visuais de QR codes
 * (cor principal, cor de fundo, tamanho do logo, referência à imagem do logo).
 *
 * Adiciona `qr_code_id` em `users` para vincular o QR code ao membro.
 * O mesmo padrão será reutilizado para estúdios, jogos, etc.
 */

exports.up = (pgm) => {
  pgm.createTable("qr_codes", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
      notNull: true,
    },
    fg_color: {
      type: "varchar(7)",
      notNull: true,
      default: "#000000",
    },
    bg_color: {
      type: "varchar(7)",
      notNull: true,
      default: "#ffffff",
    },
    logo_size: {
      type: "integer",
      notNull: true,
      default: 24,
    },
    logo_image_id: {
      type: "varchar(256)",
      references: '"uploaded_images"(id)',
      onDelete: "SET NULL",
    },
    created_at: {
      type: "timestamptz",
      default: pgm.func("timezone('utc',now())"),
      notNull: true,
    },
    updated_at: {
      type: "timestamptz",
      default: pgm.func("timezone('utc',now())"),
      notNull: true,
    },
  });

  pgm.addColumn("users", {
    qr_code_id: {
      type: "uuid",
      references: '"qr_codes"(id)',
      onDelete: "SET NULL",
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("users", "qr_code_id");
  pgm.dropTable("qr_codes");
};
