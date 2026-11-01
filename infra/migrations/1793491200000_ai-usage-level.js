/**
 * Declaração de uso de IA nos produtos.
 *
 * Jogo, jogo de mesa, livro/quadrinho e asset podem ter sido criados com apoio
 * de IA, e quem consome precisa saber disso. A classificação é **declarativa**:
 * quem publica informa o nível (0 a 5) e, opcionalmente, explica em que o uso
 * aconteceu. Nada aqui é inferido nem auditado pelo site.
 *
 * ## Por que `NULL` não é o mesmo que `0`
 *
 * `0` é uma declaração explícita ("sem uso de IA"). `NULL` é ausência de
 * declaração — ninguém informou. Guardar os dois no mesmo valor faria a tela
 * anunciar "Sem Uso de IA" para produto que nunca foi classificado, que é o
 * tipo de afirmação que a coluna existe justamente para não fazer sem base.
 *
 * A faixa é conferida no banco (`CHECK`), não só na API: o nível alimenta selo,
 * filtro e página de detalhe, e um valor fora de 0..5 atravessaria os três.
 */

const TABLES = ["games", "boardgames", "books", "assets"];

exports.up = (pgm) => {
  for (const table of TABLES) {
    pgm.addColumns(table, {
      ai_level: { type: "smallint" },
      ai_level_notes: { type: "text" },
      ai_level_rated_at: { type: "timestamptz" },
    });

    pgm.addConstraint(table, `${table}_ai_level_check`, {
      check: "ai_level IS NULL OR (ai_level >= 0 AND ai_level <= 5)",
    });
  }

  // Filtro de listagem por nível — a coluna é lida em toda varredura de card.
  for (const table of TABLES) {
    pgm.createIndex(table, "ai_level");
  }
};

exports.down = (pgm) => {
  for (const table of TABLES) {
    pgm.dropIndex(table, "ai_level");
    pgm.dropConstraint(table, `${table}_ai_level_check`);
    pgm.dropColumns(table, ["ai_level", "ai_level_notes", "ai_level_rated_at"]);
  }
};
