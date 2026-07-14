/**
 * Migration: Classificação Indicativa — content_rating columns
 *
 * Adiciona colunas de classificação indicativa às tabelas de games,
 * boardgames e books, em conformidade com:
 *   - Lei nº 15.211/2025 (ECA Digital)
 *   - Guia Prático de Classificação Indicativa — ClassInd/MJSP (5ª Ed, 2025)
 *   - Regras de segurança do Inmetro (jogos de tabuleiro)
 *   - PL 412/2022 (Lei Felca) — transparência sobre lootboxes e microtransações
 */

exports.up = (pgm) => {
  // Games (jogos digitais)
  pgm.addColumns("games", {
    content_rating: { type: "varchar(4)" },
    content_rating_reasons: { type: "text" }, // JSON array of strings
    content_rated_at: { type: "timestamptz" },
    // Lei Felca (PL 412/2022) — monetização e transparência
    has_lootboxes: { type: "boolean", default: false },
    has_in_game_purchases: { type: "boolean", default: false },
    has_excessive_ads: { type: "boolean", default: false },
  });

  // Boardgames (jogos de tabuleiro)
  pgm.addColumns("boardgames", {
    content_rating: { type: "varchar(4)" },
    content_rating_reasons: { type: "text" }, // JSON array of strings
    content_rated_at: { type: "timestamptz" },
  });

  // Books (livros e quadrinhos)
  pgm.addColumns("books", {
    content_rating: { type: "varchar(4)" },
    content_rating_reasons: { type: "text" }, // JSON array of strings
    content_rated_at: { type: "timestamptz" },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns("games", [
    "content_rating",
    "content_rating_reasons",
    "content_rated_at",
    "has_lootboxes",
    "has_in_game_purchases",
    "has_excessive_ads",
  ]);
  pgm.dropColumns("boardgames", [
    "content_rating",
    "content_rating_reasons",
    "content_rated_at",
  ]);
  pgm.dropColumns("books", [
    "content_rating",
    "content_rating_reasons",
    "content_rated_at",
  ]);
};
