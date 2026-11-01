/**
 * Níveis de uso de IA — registro único.
 *
 * Jogo, jogo de mesa, livro/quadrinho e asset declaram **quanto** de IA entrou
 * na obra. A lista abaixo é a única fonte dos nomes, das descrições e da faixa
 * válida: model, API, selo, modal de classificação, filtros de listagem e testes
 * importam daqui. Uma segunda cópia dos textos divergiria sem ninguém notar,
 * porque cada tela é lida isoladamente.
 *
 * Módulo puro (sem banco, sem `infra/errors`) para poder ser importado por
 * componente client-side — o mesmo motivo de `lib/rating-constants.js`.
 *
 * A faixa é 0..5 e o valor `null` significa **não declarado**. São estados
 * diferentes: `0` afirma "sem uso de IA"; `null` não afirma nada.
 */

export const AI_USAGE_MAX_LEVEL = 5;

export const MAX_AI_NOTES_LENGTH = 500;

/** Valor de filtro para "não declarado" — o mesmo usado em `content_rating`. */
export const AI_USAGE_FILTER_NONE = "none";

/** Nível não declarado (o `ai_level` da linha é `NULL`). */
export const AI_USAGE_UNDECLARED_LABEL = "Não informado";

export const AI_USAGE_LEVELS = [
  {
    level: 0,
    name: "Sem Uso de IA",
    subtitle: null,
    symbol: null,
    tone: "none",
    description: "A obra foi criada sem uso de inteligência artificial em nenhuma etapa.",
  },
  {
    level: 1,
    name: "IA Assistiva",
    subtitle: "Apenas Utilitária",
    symbol: "🟢",
    tone: "assistive",
    description: "A IA é usada apenas como ferramenta de otimização técnica, sem interferir na autoria, conceito ou estética original da obra.",
  },
  {
    level: 2,
    name: "IA Ampliada",
    subtitle: "Iteração e Referência",
    symbol: "🟡",
    tone: "expanded",
    description:
      "A IA participa das etapas preliminares ou atua como um assistente de produtividade que limpa o fluxo de trabalho, mas o resultado final ainda é inteiramente refinado ou refeito por mãos humanas.",
  },
  {
    level: 3,
    name: "IA Co-Criativa",
    subtitle: "Híbrido/Cyborg",
    symbol: "🟠",
    tone: "cocreative",
    description:
      "Há uma colaboração direta e equilibrada. O humano direciona, edita e cura de forma pesada, mas partes significativas do produto final contêm trechos diretamente gerados por IA.",
  },
  {
    level: 4,
    name: "IA Dominante",
    subtitle: "Curadoria Humana",
    symbol: "🔴",
    tone: "dominant",
    description:
      'A IA gera a quase totalidade do asset, imagem, música ou código. O papel do humano muda de "criador" para o de "diretor/curador", selecionando os melhores resultados e fazendo ajustes mínimos de polimento.',
  },
  {
    level: 5,
    name: "IA Autônoma",
    subtitle: "100% Sintético",
    symbol: "❌",
    tone: "autonomous",
    description:
      "O produto é gerado inteiramente por IA de ponta a ponta, sem qualquer intervenção, edição ou refinamento humano após o comando inicial.",
  },
];

/** Indexado por nível — consulta direta sem varrer a lista. */
const BY_LEVEL = new Map(AI_USAGE_LEVELS.map((item) => [item.level, item]));

/**
 * O nível é válido?
 *
 * Aceita número e string numérica (`"3"` vem de query string e de `<select>`).
 * `null`/`undefined`/`""` não são níveis — são ausência.
 */
export function isAiLevel(value) {
  if (value === null || value === undefined || value === "") return false;

  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number)) return false;

  return number >= 0 && number <= AI_USAGE_MAX_LEVEL;
}

/** Objeto do nível, ou `null` quando não é um nível válido. */
export function getAiLevel(value) {
  if (!isAiLevel(value)) return null;
  return BY_LEVEL.get(Number(value)) ?? null;
}

/**
 * `<option>` dos filtros e do modal: `"3 — IA Co-Criativa (Híbrido/Cyborg)"`.
 * Nível inválido devolve "Não informado" em vez de lançar — é rótulo de tela.
 */
export function formatAiLevelLabel(value) {
  const item = getAiLevel(value);
  if (!item) return AI_USAGE_UNDECLARED_LABEL;

  return item.subtitle ? `${item.level} — ${item.name} (${item.subtitle})` : `${item.level} — ${item.name}`;
}

/** Selo compacto: `"IA 3"`. Não declarado vira `"IA N/C"`. */
export function formatAiLevelBadge(value) {
  const item = getAiLevel(value);
  return item ? `IA ${item.level}` : "IA N/C";
}

/** Nome curto do nível, ou "Não informado". */
export function formatAiLevelName(value) {
  return getAiLevel(value)?.name ?? AI_USAGE_UNDECLARED_LABEL;
}

/**
 * Notas opcionais — texto puro, sem HTML.
 *
 * Devolve `null` quando não há conteúdo; o comprimento é conferido na escrita
 * (`models/ai-usage.js`), que é quem pode responder 400.
 */
export function normalizeAiNotes(raw) {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  return trimmed.slice(0, MAX_AI_NOTES_LENGTH);
}
