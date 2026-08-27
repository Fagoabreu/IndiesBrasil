import orchestrator from "tests/orchestrator.js";

/**
 * Cria um usuário ativado com sessão e as features adicionais informadas
 * (usado para testar rotas que exigem features privilegiadas, ex.: read:admin).
 *
 * @param {string[]} features Features adicionais a conceder ao usuário.
 * @param {object} [userObject] Campos customizados para `orchestrator.createUser`.
 * @returns {Promise<{ user: object, sessionToken: string }>}
 */
export async function createPrivilegedUser(features, userObject = {}) {
  const createdUser = await orchestrator.createUser(userObject);
  await orchestrator.activateUser(createdUser);
  const updatedUser = await orchestrator.addFeaturesToUser(createdUser, features);
  const sessionObject = await orchestrator.createSession(createdUser);
  return { user: updatedUser, sessionToken: sessionObject.token };
}

/**
 * Atalho: cria um usuário ativado com sessão e a feature `read:admin`.
 */
export async function createAdminUser(userObject = {}) {
  return createPrivilegedUser(["read:admin"], userObject);
}
