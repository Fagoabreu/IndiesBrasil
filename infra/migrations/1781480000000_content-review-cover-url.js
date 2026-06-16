/**
 * Adiciona coluna cover_url para suportar URLs externas de capa.
 * cover_image_id (UUID) continua para imagens do Cloudinary/uploaded_images.
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE content_reviews
    ADD COLUMN cover_url varchar(2048);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE content_reviews
    DROP COLUMN IF EXISTS cover_url;
  `);
};
