/**
 * Constantes de classificação indicativa (ClassInd).
 *
 * Separadas do model para evitar que componentes client-side
 * puxem infra/database → pg → módulos Node.js (fs/net/dns/tls)
 * para dentro do bundle do browser.
 *
 * Atualizar sempre em sincronia com models/content-rating.js.
 */

export const RATING_LABELS = {
  L: "Livre",
  6: "6 anos",
  10: "10 anos",
  12: "12 anos",
  14: "14 anos",
  16: "16 anos",
  18: "18 anos",
};

export const RATING_COLORS = {
  L: "#2da44e", // verde
  6: "#54aeff", // azul claro
  10: "#f7c600", // amarelo
  12: "#f47c00", // laranja
  14: "#e85d1e", // laranja escuro
  16: "#cf222e", // vermelho
  18: "#1a1a2e", // preto
};

export const RATING_ORDER = ["L", "6", "10", "12", "14", "16", "18"];
