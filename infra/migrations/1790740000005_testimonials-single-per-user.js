/**
 * Um depoimento por membro.
 *
 * A seção da home exibia um formulário de envio sem limite: o mesmo usuário
 * podia publicar quantos depoimentos quisesse, e cada envio virava um card
 * novo na lista. O depoimento é a opinião de uma pessoa sobre a comunidade —
 * uma por pessoa, editável e removível por ela mesma.
 *
 * O que a migration faz:
 *  1. acrescenta `updated_at` (a edição precisa de data, como em qualquer
 *     conteúdo editável do projeto);
 *  2. resolve os duplicados que já existem, mantendo o **mais recente** de cada
 *     autor — é o texto que a pessoa escreveu por último, portanto o que
 *     representa a opinião atual dela;
 *  3. cria o índice único que garante a regra a partir de agora.
 *
 * A remoção dos duplicados é irreversível de propósito: sem ela o índice único
 * nem poderia ser criado. O `down` desfaz a coluna e o índice, mas não os
 * depoimentos apagados.
 */

exports.up = (pgm) => {
  pgm.addColumn("testimonials", {
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  // Mantém o depoimento mais recente de cada autor e apaga o resto.
  pgm.sql(`
    DELETE FROM testimonials t
    USING (
      SELECT
        id,
        row_number() OVER (
          PARTITION BY author_id
          ORDER BY created_at DESC, id DESC
        ) AS position
      FROM testimonials
    ) ranked
    WHERE t.id = ranked.id
      AND ranked.position > 1;
  `);

  pgm.createIndex("testimonials", ["author_id"], {
    name: "testimonials_one_per_author",
    unique: true,
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("testimonials", ["author_id"], { name: "testimonials_one_per_author" });
  pgm.dropColumn("testimonials", "updated_at");
};
