/**
 * Registro único das portas de entrada da home.
 *
 * O visitante que chega em `/` precisa descobrir o escopo do produto sem
 * rolar: antes, os 12 cards de métrica diziam QUANTOS jogos, estúdios e cursos
 * existem, mas não levavam a lugar nenhum além de um número — e escondiam o
 * fato de que jogos de mesa, quadrinhos, assets e serviços também estão aqui.
 * Cada item desta lista é uma porta: rótulo em português, o que tem dentro
 * (`hint`) e a listagem correspondente.
 *
 * `metric` é o campo de `GET /api/v1/status/summary` que conta a categoria.
 * Fica como chave (e não como valor) porque o componente desenha o número
 * quando ele chega: a porta funciona sem ele — o número é aprimoramento.
 *
 * `icon` é resolvido em `components/Landing/CategoryTiles` (não guardamos JSX
 * aqui para o módulo continuar puro e testável sem transpilar componentes).
 */
export const LANDING_CATEGORIES = [
  {
    href: "/jogos",
    label: "Jogos",
    hint: "Digitais, de PC, console e web",
    icon: "game",
    metric: "games",
  },
  {
    href: "/jogos-de-mesa",
    label: "Jogos de mesa",
    hint: "Analógicos, híbridos e protótipos",
    icon: "table",
    metric: "boardgames",
  },
  {
    href: "/quadrinhos",
    label: "Livros e quadrinhos",
    hint: "Narrativas e arte sequencial",
    icon: "book",
    metric: "books",
  },
  {
    href: "/assets",
    label: "Artes e assets",
    hint: "Sprites, áudio, modelos 3D e UI",
    icon: "asset",
    metric: "assets",
  },
  {
    href: "/estudios",
    label: "Estúdios",
    hint: "Quem está fazendo os jogos",
    icon: "studio",
    metric: "organizations",
  },
  {
    href: "/servicos",
    label: "Serviços",
    hint: "Quem contrata arte, código e áudio",
    icon: "service",
    metric: null,
  },
  {
    href: "/noticias",
    label: "Notícias",
    hint: "O que aconteceu na cena",
    icon: "news",
    metric: "news",
  },
  {
    href: "/analises",
    label: "Análises",
    hint: "Reviews escritos pela comunidade",
    icon: "review",
    metric: "content_reviews",
  },
  {
    href: "/estudos",
    label: "Cursos",
    hint: "Aprender com quem já publica",
    icon: "course",
    metric: "courses",
  },
  {
    href: "/agenda",
    label: "Agenda",
    hint: "Eventos, game jams e encontros",
    icon: "event",
    metric: "events",
  },
];

/** Quantas portas a home mostra — o grid fecha as linhas com este número. */
export const LANDING_CATEGORY_COUNT = LANDING_CATEGORIES.length;

/**
 * Prova social em uma linha, logo abaixo das portas.
 *
 * Os valores das métricas importam (é o argumento de quem chega, da imprensa e
 * do investidor), mas o formato antigo — 12 cards em grade, cada um com "novos
 * nos últimos 30 dias" e "período anterior" — respondia "quantos?" antes de
 * responder "o que é isto?", ocupava três telas e, se a API falhasse, virava 12
 * travessões lendo como "site vazio".
 *
 * Aqui ficam quatro contagens que dizem "isto está vivo", cada uma levando à
 * listagem que a explica. O delta de 30 dias e a comparação com o período
 * anterior continuam disponíveis em `GET /api/v1/status/summary` (e em
 * `/status`) — não são informação de primeira visita.
 *
 * `suffix` existe para o único número que precisa de unidade de tempo: "eventos"
 * em `summary` conta os próximos 30 dias.
 */
export const LANDING_COMMUNITY_STATS = [
  { metric: "games", singular: "jogo", plural: "jogos", href: "/jogos" },
  { metric: "organizations", singular: "estúdio", plural: "estúdios", href: "/estudios" },
  { metric: "user_accounts", singular: "membro", plural: "membros", href: "/membros" },
  { metric: "events", singular: "evento", plural: "eventos", suffix: "nos próximos 30 dias", href: "/agenda" },
];

/**
 * Converte uma contagem do resumo (`/api/v1/status/summary`) em número.
 *
 * O endpoint devolve **string**: as colunas são `bigint` no Postgres e o driver
 * serializa assim (`user_accounts: "3"`). Comparar direto com
 * `Number.isFinite` dava sempre falso, e o contador simplesmente não aparecia —
 * falha silenciosa, sem erro nenhum no servidor.
 *
 * Devolve `null` para "não mostrar": zero, ausente e valor não numérico são a
 * mesma coisa na vitrine (categoria vazia não exibe "0").
 */
export function parseSummaryCount(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;

  if (typeof value !== "string") return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

const landing = {
  LANDING_CATEGORIES,
  LANDING_CATEGORY_COUNT,
  LANDING_COMMUNITY_STATS,
  parseSummaryCount,
};

export default landing;
