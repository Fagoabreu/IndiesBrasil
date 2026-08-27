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

describe("GET/POST /api/v1/users/[username]/contacts", () => {
  let owner;
  let ownerToken;
  let otherToken;
  let contactTypeId;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoContatos",
      email: "dono.contatos@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 50123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroUsuario",
      email: "outro.contatos@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 50123456702,
    });
    otherToken = otherCtx.sessionToken;

    const createdType = await contact.createType({
      icon_key: "email",
      icon_img: "https://icons.dev/email.png",
    });
    contactTypeId = createdType.id;
  });

  test("Anonymous user can read contacts", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/contacts`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test("Anonymous user cannot create contacts", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/contacts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contact_value: "email@teste.dev", contact_type_id: contactTypeId }),
    });
    expect(response.status).toBe(403);
  });

  test("Another user cannot create contacts", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/contacts`, {
      method: "POST",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ contact_value: "email@teste.dev", contact_type_id: contactTypeId }),
    });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Owner can create a contact and read it back", async () => {
    const postResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/contacts`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ contact_value: "email@teste.dev", contact_type_id: contactTypeId }),
    });
    expect(postResponse.status).toBe(200);

    const getResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/contacts`);
    expect(getResponse.status).toBe(200);

    const body = await getResponse.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      contact_value: "email@teste.dev",
      contact_type_id: contactTypeId,
      icon_key: "email",
    });
  });
});
