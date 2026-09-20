/**
 * Níveis de experiência profissional — catálogo único.
 *
 * Estavam repetidos em cinco arquivos (ferramenta, especialização, currículo,
 * seletor de estrelas e configurações), com dois problemas já visíveis: o mapa
 * de estrelas existia em dose dupla e idêntica, e a grafia divergia ("Senior"
 * num lugar, "Sênior" no outro).
 *
 * `EXPERIENCE_LEVELS` guarda os VALORES como o banco espera — o enum
 * `experience_type` usa "Senior", sem acento. A acentuação correta fica em
 * `experienceLabel`, que é só exibição.
 */

/** Valores canônicos, em ordem crescente de experiência. */
export const EXPERIENCE_LEVELS = ["Estudante", "Junior", "Pleno", "Senior", "Especialista"];

const DISPLAY_LABELS = {
  estudante: "Estudante",
  junior: "Junior",
  pleno: "Pleno",
  senior: "Sênior",
  especialista: "Especialista",
};

export const EXPERIENCE_UNKNOWN = "Nível não informado";

/** Índice do nível (0..4), ou -1 quando vazio/desconhecido. */
export function experienceIndex(value) {
  if (!value) return -1;
  const normalized = String(value).toLowerCase();
  return EXPERIENCE_LEVELS.findIndex((level) => level.toLowerCase() === normalized);
}

/** Rótulo legível do nível, ou null quando desconhecido. */
export function experienceLabel(value) {
  if (!value) return null;
  return DISPLAY_LABELS[String(value).toLowerCase()] ?? null;
}

/** "senior" → "⭐⭐⭐⭐ Sênior". Nível desconhecido cai em `fallback`. */
export function experienceLabelWithStars(value, fallback = EXPERIENCE_UNKNOWN) {
  const index = experienceIndex(value);
  if (index < 0) return fallback;
  return `${"⭐".repeat(index + 1)} ${DISPLAY_LABELS[EXPERIENCE_LEVELS[index].toLowerCase()]}`;
}
