/**
 * Migration: store_product_images
 *
 * Adiciona galeria de imagens por produto da loja. A primeira imagem continua
 * sendo a capa (`store_products.image_id`, retrocompatível com os JOINs já
 * existentes); as demais vivem nesta tabela. As imagens referenciam
 * `uploaded_images` (FK) para permitir limpeza no Cloudinary via
 * `uploadedImages.deleteImage`.
 */

/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable("store_product_images", {
    id: { type: "serial", primaryKey: true },
    product_id: {
      type: "uuid",
      notNull: true,
      references: "store_products(id)",
      onDelete: "CASCADE",
    },
    image_id: {
      type: "varchar(256)",
      notNull: true,
      references: "uploaded_images(id)",
      onDelete: "CASCADE",
    },
    display_order: { type: "integer", notNull: true, default: 0 },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("store_product_images", "product_id");
  pgm.createIndex("store_product_images", "image_id");

  // Backfill: produtos já existentes com capa ganham uma entrada na galeria.
  pgm.sql(`
    INSERT INTO store_product_images (product_id, image_id, display_order)
    SELECT id, image_id, 0
    FROM store_products
    WHERE image_id IS NOT NULL;
  `);
};

/** @param {import("node-pg-migrate").MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable("store_product_images", { cascade: true });
};
