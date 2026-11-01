/**
 * Parsers dos filtros de classificação das listagens de produto.
 *
 * Vivem aqui — e não dentro de cada rota — porque as quatro listagens
 * (jogos, jogos de mesa, quadrinhos, assets) recebem os mesmos dois parâmetros
 * opcionais: `content_rating` e `ai_level`. Quatro cópias da mesma validação
 * divergiriam, e a diferença apareceria só na rota que ninguém testou.
 *
 * O valor devolvido é o que o model consome direto:
 *
 *   `""`      — sem filtro (parâmetro ausente ou vazio)
 *   `"none"`  — somente itens **não classificados** (`IS NULL`)
 *   `"12"`    — somente aquele valor
 *
 * Valor desconhecido é **400**, não "cai no padrão": devolver a lista inteira
 * para `?ai_level=sete` faria o filtro parecer aplicado — mesmo raciocínio de
 * `?sort=` em `/api/v1/users`.
 */

import { ValidationError } from "infra/errors";
import { RATING_ORDER } from "lib/rating-constants";
import { AI_USAGE_MAX_LEVEL } from "lib/ai-usage";

/** Valor usado para "não classificado" nos dois filtros. */
export const FILTER_NONE = "none";

function isAbsent(raw) {
  return raw === undefined || raw === null || raw === "";
}

function toSingleString(raw) {
  // `?ai_level=1&ai_level=2` chega como array; tratar como inválido é melhor do
  // que escolher um dos dois em silêncio.
  if (Array.isArray(raw)) {
    throw new ValidationError({
      message: "Parâmetro enviado mais de uma vez.",
      action: "Envie apenas um valor por filtro.",
    });
  }

  return typeof raw === "string" ? raw.trim() : String(raw).trim();
}

/**
 * Normaliza `?content_rating=`.
 *
 * Faixas válidas são as do ClassInd (`L, 6, 10, 12, 14, 16, 18`), mais `none`.
 */
export function parseContentRatingFilter(raw) {
  if (isAbsent(raw)) return "";

  const value = toSingleString(raw);
  if (value === "") return "";
  if (value === FILTER_NONE) return FILTER_NONE;

  if (RATING_ORDER.some((rating) => String(rating) === value)) return value;

  throw new ValidationError({
    message: "Classificação indicativa inválida.",
    action: `Use "none" ou um dos valores: ${RATING_ORDER.join(", ")}.`,
  });
}

/**
 * Normaliza `?ai_level=`.
 *
 * Níveis vão de 0 a 5 (`AI_USAGE_MAX_LEVEL`), mais `none` para "não declarado".
 * `"0"` é um valor legítimo — recusá-lo confundiria "sem uso de IA" com
 * "ninguém respondeu", que é justamente a distinção que a coluna mantém.
 */
export function parseAiLevelFilter(raw) {
  if (isAbsent(raw)) return "";

  const value = toSingleString(raw);
  if (value === "") return "";
  if (value === FILTER_NONE) return FILTER_NONE;

  if (/^\d+$/.test(value)) {
    const level = Number(value);
    if (level >= 0 && level <= AI_USAGE_MAX_LEVEL) return String(level);
  }

  throw new ValidationError({
    message: "Nível de uso de IA inválido.",
    action: `Use "none" ou um número de 0 a ${AI_USAGE_MAX_LEVEL}.`,
  });
}
