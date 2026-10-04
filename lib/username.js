/**
 * Regra única de normalização e validação do `username`.
 *
 * ## Por que isto existe
 *
 * O `username` não tinha **nenhuma** validação de formato: nem no formulário
 * (que só checava tamanho mínimo), nem no model (que só checava unicidade). A
 * coluna aceitava qualquer coisa até 39 caracteres — inclusive **espaço nas
 * pontas** e **caracteres invisíveis**.
 *
 * Como a busca do perfil compara os bytes (`LOWER(username) = LOWER($1)`), um
 * nome gravado como `"Yuri d Ávila "` (com espaço no fim) nunca casa com a URL
 * que se digita ou compartilha, `/perfil/Yuri%20d%20%C3%81vila` — o perfil
 * responde 404. Em produção isso atingia 5 dos 36 usuários, incluindo um cujo
 * nome real era `B` + seis **hífens suaves** (U+00AD) + `...`, que ninguém
 * consegue reproduzir digitando.
 *
 * ## O que a normalização faz
 *
 * 1. Remove caracteres invisíveis (hífen suave, largura zero).
 * 2. Normaliza o acento para **NFC** — a forma que a URL carrega (`%C3%81`) e
 *    que os links internos geram. Sem isto, um nome gravado em NFD fica
 *    inalcançável, porque as duas formas não são iguais byte a byte.
 * 3. Troca espaços "exóticos" (NBSP, espaço estreito, tab) por espaço comum —
 *    o `%20` da URL é U+0020, e qualquer outro espaço não casa.
 * 4. Colapsa espaços repetidos.
 * 5. Apara as pontas.
 *
 * ## O que NÃO faz
 *
 * Não restringe a um alfabeto (sem `a-z0-9_-`). Espaços e acentos são nomes
 * legítimos e já existem na base (`"Thiago dos Santos"`, `"KakáCarioca"`);
 * proibir quebraria perfis que hoje funcionam. A regra aqui é de **higiene**,
 * não de formato.
 */

/**
 * Caracteres que não produzem glifo e não deveriam existir num nome.
 *
 * `\p{Cf}` (Unicode *format*, exige a flag `u`) cobre tudo o que se quer tirar:
 * hífen suave (U+00AD), largura zero (U+200B), não-juntor/juntor (U+200C/
 * U+200D), word joiner (U+2060), BOM (U+FEFF) e separador vocálico mongol
 * (U+180E). Vem de propriedade Unicode em vez de lista literal porque a lista
 * explícita com `\u200D` dispara a regra `no-misleading-character-class` — o
 * juntor combina com o caractere anterior (emoji) e a regra avisa, com razão.
 *
 * O juntor (U+200D) é removido de propósito, mesmo sabendo que ele une
 * sequências de emoji (e o emoji composto perde a composição): caractere
 * invisível em nome de usuário é vetor de falsificação — dois perfis podem
 * parecer idênticos na tela e ter usernames diferentes. A propriedade também
 * cobre os controles bidirecionais (U+202A–U+202E), que permitem escrever um
 * nome que a tela exibe na ordem inversa da armazenada.
 */
const INVISIBLE_CHARACTERS = /\p{Cf}/gu;

/**
 * Espaços que não são o U+0020. A URL sempre carrega `%20` (U+0020), então
 * qualquer outro espaço no valor gravado torna o nome inalcançável por link.
 */
const NON_BREAKING_SPACES = /[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\t\r\n\f\v]/g;

/**
 * Tamanho máximo do `username`.
 *
 * 39 é o limite que a coluna já tinha (`varchar(39)`, mesmo valor que o GitHub
 * usa). Fica aqui para o model recusar antes de o banco truncar/estourar.
 */
export const USERNAME_MAX_LENGTH = 39;

/** Menor nome aceito — mesma regra que o formulário já mostrava. */
export const USERNAME_MIN_LENGTH = 3;

/**
 * Forma canônica do username: é o que deve ser **gravado** e o que deve ser
 * usado para **buscar**. As duas pontas passam por aqui, senão o valor gravado
 * e o procurado divergem (que foi exatamente o defeito).
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeUsername(value) {
  return String(value ?? "")
    .replace(INVISIBLE_CHARACTERS, "")
    .normalize("NFC")
    .replace(NON_BREAKING_SPACES, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

/**
 * Valida a forma já normalizada e devolve a mensagem do problema, ou `null`
 * quando está tudo certo.
 *
 * Devolve a mensagem em vez de lançar para o chamador decidir o tipo de erro —
 * o mesmo texto serve ao servidor (`ValidationError`) e ao formulário.
 *
 * @param {string} normalized
 * @returns {string|null}
 */
export function usernameProblem(normalized) {
  if (!normalized) {
    return "Informe um nome de usuário.";
  }

  if (normalized.length < USERNAME_MIN_LENGTH) {
    return `O nome de usuário deve ter ao menos ${USERNAME_MIN_LENGTH} caracteres.`;
  }

  if (normalized.length > USERNAME_MAX_LENGTH) {
    return `O nome de usuário deve ter no máximo ${USERNAME_MAX_LENGTH} caracteres.`;
  }

  return null;
}
