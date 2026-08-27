import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import contact from "models/contact";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("DELETE /api/v1/studios/[slug]/contacts/[id]", () => {
  let ownerToken;
  let otherToken;
  let studio;
  let contactId;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoContatoEstudio",
      email: "dono.contato.estudio@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456716,
    });
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroContatoDeletar",
      email: "outro.contato.deletar@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456717,
    });
    otherToken = otherCtx.sessionToken;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Contato Delete" });

    const types = await contact.findAllType();
    const createdContact = await organization.createContact(studio.id, types[0].id, "contato@estudio.dev");
    contactId = createdContact.id;
  });

  test("Anonymous user cannot delete a contact", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/contacts/${contactId}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Non-admin user cannot delete a contact", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/contacts/${contactId}`, {
      method: "DELETE",
      headers: authHeaders(otherToken),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can delete a contact", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/contacts/${contactId}`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(204);

    const listResponse = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/contacts`, {
      headers: authHeaders(ownerToken),
    });
    expect(await listResponse.json()).toEqual([]);
  });
});
