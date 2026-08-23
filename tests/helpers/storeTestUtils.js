import orchestrator from "tests/orchestrator.js";
import organization from "models/organization.js";
import contact from "models/contact.js";

export const VALID_CNPJ = "11.222.333/0001-81";

export function authHeaders(sessionToken) {
  return { cookie: `session_id=${sessionToken}` };
}

export async function createActivatedUserWithSession(userObject) {
  const createdUser = await orchestrator.createUser(userObject);
  await orchestrator.activateUser(createdUser);
  const sessionObject = await orchestrator.createSession(createdUser);
  return { user: createdUser, sessionToken: sessionObject.token };
}

/**
 * Cria um estúdio elegível para vender na loja (CNPJ válido + endereço + contato).
 * O usuário informado vira o dono do estúdio.
 */
export async function createEligibleStudio(ownerUser, { name = "Estúdio Loja Teste" } = {}) {
  const studio = await organization.create(ownerUser, {
    name,
    cnpj: VALID_CNPJ,
    address: {
      street: "Rua das Lojas",
      number: "100",
      complement: "Sala 1",
      neighborhood: "Centro",
      city: "São Paulo",
      state: "SP",
      zip_code: "01001000",
    },
  });

  const contactTypes = await contact.findAllType();
  await organization.createContact(studio.id, contactTypes[0].id, "contato@estudio.dev");

  return studio;
}
