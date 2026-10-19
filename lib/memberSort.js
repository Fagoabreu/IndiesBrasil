/**
 * Ordenação do diretório de membros — o registro único.
 *
 * A página (`pages/membros`) e a rota (`GET /api/v1/users`) precisam das mesmas
 * chaves: se a tela oferecer uma opção que a API não aceita, o usuário recebe
 * erro; se a API aceitar uma que a tela não oferece, ninguém descobre. Por isso
 * a lista vive aqui — a mesma escolha de `lib/contactTypes.js`.
 *
 * Só a **lista de chaves** mora aqui; o SQL de cada uma fica em
 * `models/user.js`, que é quem consulta o banco.
 *
 * A leitura padrão (`created_at` desc) é a mesma de antes da ordenação existir —
 * inclusive no formato do cursor, para que um link antigo com `?cursor=` continue
 * funcionando.
 */

/** Colunas ordenáveis. `created_at` é o padrão. */
export const MEMBER_SORT_FIELDS = ["created_at", "reputation", "followers"];

export const MEMBER_SORT_ORDERS = ["asc", "desc"];

export const DEFAULT_MEMBER_SORT = Object.freeze({ field: "created_at", order: "desc" });

/**
 * Opções oferecidas no seletor da tela.
 *
 * O rótulo diz o critério **e** o sentido numa frase só ("Mais antigos"), porque
 * um seletor de campo + outro de direção ocuparia duas linhas no cabeçalho e
 * obrigaria o usuário a ler dois controles para entender a ordem atual.
 */
export const MEMBER_SORT_OPTIONS = Object.freeze([
  { field: "created_at", order: "desc", label: "Mais recentes" },
  { field: "created_at", order: "asc", label: "Mais antigos" },
  { field: "reputation", order: "desc", label: "Maior pontuação" },
  { field: "reputation", order: "asc", label: "Menor pontuação" },
  { field: "followers", order: "desc", label: "Mais seguidores" },
  { field: "followers", order: "asc", label: "Menos seguidores" },
]);

/** Valor do `<select>`: `campo:direção`, uma string só. */
export function memberSortValue({ field, order }) {
  return `${field}:${order}`;
}

/** Verdadeiro quando campo e direção existem na lista. */
export function isMemberSort(field, order) {
  return MEMBER_SORT_FIELDS.includes(field) && MEMBER_SORT_ORDERS.includes(order);
}

/**
 * Converte o valor do seletor (ou os parâmetros da URL) numa ordem válida.
 *
 * Devolve `null` para entrada desconhecida — quem chama decide entre recusar
 * (a rota responde 400) e cair no padrão (a tela). Um `default` silencioso na
 * rota esconderia um erro de quem integrou: `?sort=reputacao` (com "ç") seria
 * servido como "mais recentes" e ninguém notaria.
 */
export function parseMemberSort(field, order) {
  const normalizedField = typeof field === "string" ? field.trim() : "";
  const normalizedOrder = typeof order === "string" ? order.trim() : "";

  // `?sort=reputation:desc` também é aceito: é o valor que o `<select>` usa, e
  // quem copia a URL do seletor não deveria precisar saber que ela é composta.
  if (normalizedField.includes(":") && !normalizedOrder) {
    const [parsedField, parsedOrder] = normalizedField.split(":");
    return isMemberSort(parsedField, parsedOrder) ? { field: parsedField, order: parsedOrder } : null;
  }

  // Campo pedido sem direção: mantém o sentido padrão do campo (desc), em vez
  // de recusar — a URL `?sort=reputation` é uma intenção clara.
  if (normalizedField && !normalizedOrder) {
    return isMemberSort(normalizedField, DEFAULT_MEMBER_SORT.order) ? { field: normalizedField, order: DEFAULT_MEMBER_SORT.order } : null;
  }

  if (normalizedField || normalizedOrder) {
    return isMemberSort(normalizedField, normalizedOrder) ? { field: normalizedField, order: normalizedOrder } : null;
  }

  return null;
}
