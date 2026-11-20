/**
 * Marca de edição do post.
 *
 * Sem a coluna não há como um leitor saber que o texto mudou depois de
 * publicado — e o post pode já ter recebido curtidas, comentários e respostas.
 * `created_at` continua sendo a data de publicação; `edited_at` só é preenchido
 * pelo `PATCH /api/v1/posts/[post_id]`.
 *
 * Nula por padrão: post nunca editado não exibe nada.
 */
exports.up = (pgm) => {
  pgm.addColumn("posts", {
    edited_at: {
      type: "timestamptz",
      notNull: false,
      default: null,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("posts", "edited_at");
};
