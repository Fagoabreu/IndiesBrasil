import useSWR from "swr";

/** Quantas sugestões mostrar — a lista é um apoio ao campo, não um diretório. */
export const MEMBER_SUGGEST_LIMIT = 8;

/** Termo mínimo para buscar: uma letra casaria com quase todo mundo. */
export const MEMBER_SUGGEST_MIN_LENGTH = 2;

/**
 * Normaliza o que foi digitado no campo de convite.
 *
 * O campo aceita as duas formas que as pessoas usam ao falar de perfil aqui:
 * `@username` e `username`. O `@` é prefixo de exibição, não faz parte do
 * username no banco — mandá-lo para a API resultaria em "usuário não encontrado".
 * `@` no meio do texto é mantido (só o início é removido).
 */
export function normalizeMemberQuery(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^@+/, "");
}

/**
 * Sugestões de pessoa para o campo de convite do estúdio.
 *
 * Reaproveita `GET /api/v1/users`, a mesma busca da página `/membros`: ela já
 * filtra conta ativada (convidar quem nunca confirmou o e-mail cria um convite
 * que ninguém vê) e já exclui o próprio usuário logado. Um endpoint novo de
 * busca seria a terceira cópia da mesma consulta.
 *
 * Mesmo formato do `useTagSuggest` (SWR com a URL como chave): assim digitar
 * rápido não dispara uma requisição por tecla, porque o SWR deduplica pela
 * chave e o componente aplica debounce antes de trocá-la.
 */
export function useUserSuggest(query) {
  const term = normalizeMemberQuery(query);
  const key = term.length >= MEMBER_SUGGEST_MIN_LENGTH ? `/api/v1/users?q=${encodeURIComponent(term)}&limit=${MEMBER_SUGGEST_LIMIT}` : null;

  return useSWR(key, (url) => fetch(url).then((r) => r.json()));
}
