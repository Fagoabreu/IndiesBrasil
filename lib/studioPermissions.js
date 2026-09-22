import { ValidationError } from "@/infra/errors";

/**
 * Matriz de capacidades do estúdio: quem pode o quê.
 *
 * Módulo **puro** (não importa model) de propósito: as mesmas regras precisam
 * valer nos dois lados, e o model não pode importar `lib/studioAccess.js`
 * (que importa o model — seria um ciclo).
 *
 * - `models/organization.js` aplica a invariante **na escrita**, onde não há
 *   como contornar: trocar a rota contorna a checagem da rota, mas não a da
 *   função que grava.
 * - As rotas usam a mesma matriz para traduzir a recusa em 403/400.
 *
 * Ter a matriz num lugar só é o que impede os caminhos de escrita de
 * divergirem. Hoje são três (papel direto, convite e remoção) e todos passam
 * por estas funções.
 */

/** Papéis que podem ser concedidos a um membro (o dono não é concedido). */
export const STUDIO_MEMBER_ROLES = ["admin", "member"];

/**
 * Rótulos para exibição. O valor cru (`admin`/`member`) é o que a API entrega e
 * o banco guarda; `owner` é derivado, não existe em `org_roles`.
 */
export const STUDIO_ROLE_LABELS = {
  owner: "Responsável",
  admin: "Administrador",
  member: "Membro",
};

/**
 * Capacidades por papel.
 *
 * `owner` vem de `organizations.owner_id` — é estrutural, não uma concessão.
 * O dono recebe uma linha `admin` em `org_roles` na criação, mas **nenhuma
 * regra pode depender dela**: se essa linha for perdida, o responsável ficaria
 * trancado fora do próprio estúdio. Sempre derive `owner` de `owner_id`.
 *
 * Só o responsável concede, revoga ou remove `admin`. Administradores são
 * pares: um admin que pudesse mexer no papel do outro poderia limpar a equipe
 * inteira e ficar sozinho no comando.
 */
export const STUDIO_CAPABILITIES = {
  editSettings: ["owner", "admin"],
  manageMembers: ["owner", "admin"],
  grantAdmin: ["owner"],
  revokeAdmin: ["owner"],
  removeAdmin: ["owner"],
  inviteAsAdmin: ["owner"],
};

/**
 * Papel efetivo do usuário no estúdio, a partir dos vínculos já checados.
 * @returns {"owner" | "admin" | "member" | null} `null` = não participa
 */
export function actorRole({ isOwner = false, isAdmin = false, isMember = false } = {}) {
  if (isOwner) return "owner";
  if (isAdmin) return "admin";
  if (isMember) return "member";
  return null;
}

/**
 * O papel pode exercer a capacidade?
 *
 * Fail-closed: papel nulo (anônimo ou quem não é membro) e capacidade
 * desconhecida devolvem `false`.
 */
export function roleCan(role, capability) {
  return STUDIO_CAPABILITIES[capability]?.includes(role) ?? false;
}

/** Conceder `role` a um membro. */
export function canGrantRole(actor, role) {
  return role === "admin" ? roleCan(actor, "grantAdmin") : roleCan(actor, "manageMembers");
}

/** Revogar `role` de um membro. */
export function canRevokeRole(actor, role) {
  return role === "admin" ? roleCan(actor, "revokeAdmin") : roleCan(actor, "manageMembers");
}

/** Convidar alguém já com o papel definido. */
export function canInviteWithRole(actor, role) {
  return role === "admin" ? roleCan(actor, "inviteAsAdmin") : roleCan(actor, "manageMembers");
}

/**
 * Remover alguém do estúdio.
 *
 * Remover um admin **revoga o papel dele** (a remoção apaga as linhas de
 * `org_roles`), então remover admin é a mesma capacidade de revogar admin —
 * sem isso um admin derrubaria o colega e o reconvidaria como membro comum.
 *
 * Sair por conta própria (`isSelf`) é sempre permitido: é desligamento, não
 * privilégio.
 */
export function canRemoveMember(actor, targetRole, isSelf) {
  if (isSelf) return true;
  if (targetRole === "owner") return false;
  if (targetRole === "admin") return roleCan(actor, "removeAdmin");
  return roleCan(actor, "manageMembers");
}

/**
 * Valida o papel vindo do cliente.
 *
 * Campo ausente vira `member` (compatível com o formulário atual, que não envia
 * `role`). Qualquer outro valor fora da lista é recusado: `null` e `""`
 * violariam o enum no banco e virariam 500, e um default silencioso esconderia
 * o erro de quem chamou.
 */
export function parseMemberRole(value) {
  if (value === undefined) return "member";
  if (typeof value === "string" && STUDIO_MEMBER_ROLES.includes(value)) return value;

  throw new ValidationError({
    message: `Papel inválido: ${JSON.stringify(value)}. Use 'admin' ou 'member'.`,
  });
}
