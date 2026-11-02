/**
 * Grupos de profissão — a hierarquia fixa da taxonomia.
 *
 * As **profissões** são dados: vivem em `portfolio_roles` e são cadastradas pelo
 * administrador em `/admin/professions` e sugeridas por qualquer usuário. Os
 * **grupos** são estrutura de apresentação e não mudam com o conteúdo: são eles
 * que agrupam o seletor do perfil, a tela de administração e o formulário de
 * sugestão.
 *
 * Mesma escolha de `lib/serviceGroups.js` e `lib/assetGroups.js`: manter os
 * grupos em código evita uma segunda camada de cadastro para algo que só o
 * código sabe renderizar, e o servidor revalida `group_key` contra esta lista em
 * toda escrita.
 */
export const PROFESSION_GROUPS = [
  { key: "arte", label: "Arte", order: 1 },
  { key: "design", label: "Design", order: 2 },
  { key: "programacao", label: "Programação", order: 3 },
  { key: "audio", label: "Áudio", order: 4 },
  { key: "producao", label: "Produção", order: 5 },
  { key: "conteudo", label: "Conteúdo", order: 6 },
  { key: "negocios", label: "Negócios", order: 7 },
  { key: "outros", label: "Outros", order: 8 },
];

export const PROFESSION_GROUP_KEYS = PROFESSION_GROUPS.map((group) => group.key);

/**
 * Grupo de reserva para o que não se encaixa.
 *
 * Existe porque o `group_key` é `NOT NULL` e a migration precisa classificar
 * 25 linhas já existentes; uma profissão nova escolhida pelo admin sempre tem
 * grupo explícito. Nunca aparece vazio na tela.
 */
export const DEFAULT_PROFESSION_GROUP = "outros";

/** Limite do nome — o mesmo da coluna `portfolio_roles.name`. */
export const MAX_PROFESSION_NAME_LENGTH = 80;

/** Limite da justificativa — o mesmo da coluna `justification`. */
export const MAX_PROFESSION_SUGGESTION_LENGTH = 500;

/** Verdadeiro quando a chave é um dos grupos conhecidos. */
export function isValidProfessionGroup(key) {
  return PROFESSION_GROUP_KEYS.includes(key);
}

/** Rótulo do grupo, ou a própria chave quando ela não existe (dado legado). */
export function professionGroupLabel(key) {
  return PROFESSION_GROUPS.find((group) => group.key === key)?.label ?? key;
}

/**
 * Agrupa profissões por `group_key`, na ordem dos grupos fixos.
 *
 * A ordenação dos grupos não pode vir do banco: `display_order` é a posição da
 * profissão DENTRO do grupo, então ordenar por ele misturaria os grupos.
 */
export function groupProfessions(professions = []) {
  return [...PROFESSION_GROUPS]
    .sort((a, b) => a.order - b.order)
    .map((group) => ({
      ...group,
      professions: professions
        .filter((profession) => profession.group_key === group.key)
        .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "pt-BR")),
    }))
    .filter((group) => group.professions.length > 0);
}

/**
 * Nome na forma comparável: sem acento, minúsculo, sem espaços repetidos.
 *
 * É a chave de "essa profissão já existe?" — `"Programador de Jogos"` e
 * `"programador de jogos"` são a mesma profissão, e enquanto a coluna era enum
 * o banco garantia isso sozinho. Agora que é texto, a comparação precisa ser
 * explícita e tolerante.
 */
export function professionKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Nome pronto para gravar: aparado, com espaços colapsados.
 *
 * Devolve `null` quando vazio — quem chama decide se vazio é erro (`create`) ou
 * ausência (`update` com campo omitido).
 */
export function normalizeProfessionName(value) {
  const name = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  return name || null;
}
