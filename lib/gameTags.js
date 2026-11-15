/**
 * Tags de jogo — vocabulário LIVRE, diferente de gênero.
 *
 * ## Por que tag existe separada de gênero
 *
 * A taxonomia de gênero cobre "que tipo de jogo é". Não cobre **perspectiva**
 * ("2D Topdown"), **modo** ("Multiplayer") nem **tom** ("Emocional") — e forçar
 * esses conceitos dentro de uma coluna de gênero foi o que produziu valores como
 * `"2D Topdown, Puzzle, Emocional"`, em que o filtro comparava a frase inteira.
 *
 * Tag é o lugar certo: sem curadoria, sem hierarquia, e na mesma tabela `tags`
 * que os posts usam. `game_tags` existe desde `1779840000000` e **nunca recebeu
 * um INSERT** — não é tabela morta, é tabela que faltava ligar.
 *
 * ## Forma
 *
 * `tags.name` é único e minúsculo (`models/tags.js` faz `.toLowerCase()`), então
 * a comparação já é estável. O `#` é prefixo de **exibição**, não faz parte do
 * valor gravado — mesma decisão do `@` no convite de membro.
 */

/** Quantas tags um jogo pode ter. Acima disso a lista deixa de informar. */
export const MAX_GAME_TAGS = 8;

/** Mínimo e máximo do nome — os limites de `tags.name` (`varchar(50)`). */
export const MIN_TAG_LENGTH = 3;
export const MAX_TAG_LENGTH = 50;

/**
 * Nome pronto para gravar: minúsculo, espaços colapsados, sem `#` inicial.
 *
 * Acento **não** é removido: `tags.name` já tem valores acentuados de posts e a
 * unicidade é por valor exato — normalizar acento aqui criaria divergência com o
 * que a busca de tags dos posts encontra.
 */
export function normalizeTagName(value) {
  const name = String(value ?? "")
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
  return name || null;
}

/**
 * Lê o que a pessoa digitou: aceita `#tag, outra tag` e devolve nomes válidos,
 * deduplicados e na ordem digitada.
 *
 * Ignora silenciosamente o que é curto/longo demais em vez de abortar o
 * formulário inteiro — tag é acessório, e recusar o jogo por causa de uma tag de
 * 2 letras seria hostil.
 */
export function parseTagInput(value) {
  const parts = Array.isArray(value) ? value : String(value ?? "").split(",");
  const seen = new Set();
  const names = [];

  for (const part of parts) {
    const name = normalizeTagName(part);
    if (!name) continue;
    if (name.length < MIN_TAG_LENGTH || name.length > MAX_TAG_LENGTH) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }

  return names;
}

const gameTags = {
  MAX_GAME_TAGS,
  MIN_TAG_LENGTH,
  MAX_TAG_LENGTH,
  normalizeTagName,
  parseTagInput,
};

export default gameTags;
