/**
 * Grupos de serviços — a hierarquia fixa da taxonomia.
 *
 * Os **serviços** são dados: vivem em `services` e são cadastrados pelo
 * administrador em `/admin/services` e sugeridos por qualquer usuário. Os
 * **grupos** são estrutura de apresentação e não mudam com o conteúdo: são eles
 * que agrupam o seletor do estúdio, os filtros de `/servicos` e a tela de
 * administração.
 *
 * Manter os grupos em código (e não numa tabela) evita uma segunda camada de
 * cadastro para algo que só o código sabe renderizar — mesma escolha de
 * `lib/assetGroups.js`, e o servidor revalida `group_key` contra esta lista em
 * toda escrita.
 */
export const SERVICE_GROUPS = [
  { key: "desenvolvimento", label: "Desenvolvimento", order: 1 },
  { key: "arte-audio", label: "Arte e Áudio", order: 2 },
  { key: "producao", label: "Produção e Publicação", order: 3 },
  { key: "qualidade", label: "Qualidade e Idioma", order: 4 },
  { key: "estrategia", label: "Estratégia e Legal", order: 5 },
];

export const SERVICE_GROUP_KEYS = SERVICE_GROUPS.map((group) => group.key);

/**
 * Teto de serviços por estúdio.
 *
 * Vive aqui (e não no model) porque o formulário também precisa dele: importar
 * `models/service.js` num componente traria o pool do Postgres para o bundle do
 * cliente. O model lê a MESMA constante — o mesmo motivo de
 * `MAX_ASSET_CATEGORIES`.
 *
 * Oito cobre com folga as combinações realistas (um estúdio que faz
 * desenvolvimento + portabilidade + QA + localização usa quatro) e evita a lista
 * com treze chips, que não informa nada.
 */
export const MAX_STUDIO_SERVICES = 8;

/** Limite do resumo por serviço — o mesmo da coluna `summary`. */
export const MAX_SERVICE_SUMMARY_LENGTH = 200;

/** Limite da nota de preço — o mesmo da coluna `price_note`. */
export const MAX_PRICE_NOTE_LENGTH = 60;

/** Verdadeiro quando a chave é um dos grupos conhecidos. */
export function isValidServiceGroup(key) {
  return SERVICE_GROUP_KEYS.includes(key);
}

/** Rótulo do grupo, ou a própria chave quando ela não existe (dado legado). */
export function serviceGroupLabel(key) {
  return SERVICE_GROUPS.find((group) => group.key === key)?.label ?? key;
}

/** Ordena grupos pela posição declarada em `SERVICE_GROUPS`. */
export function compareServiceGroups(a, b) {
  const orderA = SERVICE_GROUPS.find((group) => group.key === a)?.order ?? Number.MAX_SAFE_INTEGER;
  const orderB = SERVICE_GROUPS.find((group) => group.key === b)?.order ?? Number.MAX_SAFE_INTEGER;
  return orderA - orderB;
}

/**
 * Agrupa serviços por `group_key`, na ordem dos grupos fixos.
 *
 * A ordenação dos grupos não pode vir do banco: `display_order` é a posição do
 * serviço DENTRO do grupo, então ordenar por ele misturaria os grupos.
 */
export function groupServices(services = []) {
  return [...SERVICE_GROUPS]
    .sort((a, b) => a.order - b.order)
    .map((group) => ({
      ...group,
      services: services
        .filter((service) => service.group_key === group.key)
        .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "pt-BR")),
    }))
    .filter((group) => group.services.length > 0);
}

/** Texto do chip de um serviço no cartão: o nome curto, sem o grupo. */
export function serviceChipLabel(service) {
  return service?.name ?? "";
}

/**
 * Texto do valor de referência, ou `null` quando não há o que mostrar.
 *
 * Serviço quase nunca tem preço fixo: o que aparece no chip é a combinação de
 * valor e nota, e nenhum dos dois sozinho basta. Sem valor, a nota é o texto
 * ("A combinar"); com valor, a nota vira sufixo ("R$ 1.500,00 por projeto").
 *
 * Delega para `lib/price.js` — a formatação de valor é a mesma do asset, e uma
 * segunda implementação aqui divergiria na primeira mudança de moeda.
 */
export { formatPriceWithNote as formatServicePrice } from "@/lib/price";
