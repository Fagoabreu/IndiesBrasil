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

describe("GET/POST /api/v1/studios/[slug]/contacts", () => {
  let ownerToken;
  let otherToken;
  let studio;
  let contactTypeId;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoContatosEstudio",
      email: "dono.contatos.estudio@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456714,
    });
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroContatoEstudio",
      email: "outro.contato.estudio@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 55123456715,
    });
    otherToken = otherCtx.sessionToken;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Contatos" });

    const types = await contact.findAllType();
    contactTypeId = types[0].id;
  });

  test("Anonymous user cannot list contacts", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/contacts`);
    expect(response.status).toBe(403);
  });

  test("Owner can list an empty contacts list", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/contacts`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test("Anonymous user cannot create a contact", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/contacts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contact_type_id: contactTypeId, contact_value: "contato@estudio.dev" }),
    });
    expect(response.status).toBe(403);
  });

  test("Non-admin user cannot create a contact", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/contacts`, {
      method: "POST",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ contact_type_id: contactTypeId, contact_value: "contato@estudio.dev" }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can create a contact", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/contacts`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ contact_type_id: contactTypeId, contact_value: "contato@estudio.dev" }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.contact_value).toBe("contato@estudio.dev");
  });

  test("Owner cannot create a contact without type or value", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/contacts`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ contact_type_id: contactTypeId }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });
});
