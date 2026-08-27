import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import contact from "models/contact";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("PATCH/DELETE /api/v1/users/[username]/contacts/[contactId]", () => {
  let owner;
  let ownerToken;
  let otherToken;
  let contactId;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoContato",
      email: "dono.contato@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 51123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroContato",
      email: "outro.contato@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 51123456702,
    });
    otherToken = otherCtx.sessionToken;

    const createdType = await contact.createType({ icon_key: "email", icon_img: "x" });
    const postResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/contacts`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ contact_value: "email@teste.dev", contact_type_id: createdType.id }),
    });
    if (postResponse.status !== 200) {
      throw new Error(`Setup falhou com status ${postResponse.status}`);
    }

    const listResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/contacts`);
    const listBody = await listResponse.json();
    contactId = listBody[0].id;
  });

  test("Anonymous user cannot patch a contact", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contact_value: "novo@teste.dev" }),
    });
    expect(response.status).toBe(403);
  });

  test("Another user cannot patch a contact", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/contacts/${contactId}`, {
      method: "PATCH",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ contact_value: "novo@teste.dev" }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can patch a contact", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/contacts/${contactId}`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ contact_value: "novo@teste.dev" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({ contact_value: "novo@teste.dev" });
  });

  test("Owner can delete a contact", async () => {
    const deleteResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/contacts/${contactId}`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(deleteResponse.status).toBe(200);

    const listResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/contacts`);
    expect(await listResponse.json()).toEqual([]);
  });
});
