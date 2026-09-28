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

  /* ================================================================
   * Normalização na escrita e enriquecimento na leitura
   *
   * O que este bloco protege: sem a normalização, `@canal` entra no banco como
   * o usuário digitou e não vira link. Sem o enriquecimento, a tela mostra a
   * URL crua no lugar do handle — e era assim que o perfil do Green Tale
   * exibia `https://youtube.com/@GreentaleStudios`.
   * ================================================================ */

  test("Contact is normalized and serialized for display", async () => {
    const type = await contact.createType({ icon_key: "youtube", icon_img: "youtube" });

    const postResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/contacts`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ contact_value: "@MeuCanal", contact_type_id: type.id }),
    });
    expect(postResponse.status).toBe(200);

    // O POST já devolve o contato pronto (antes devolvia tudo `undefined`,
    // porque `saveContato` retornava o array do INSERT).
    const created = await postResponse.json();
    expect(created.contact_value).toBe("https://www.youtube.com/@MeuCanal");
    expect(created.display).toBe("@MeuCanal");
    expect(created.url).toBe("https://www.youtube.com/@MeuCanal");
    expect(created.label).toBe("YouTube");

    const getResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/contacts`);
    const body = await getResponse.json();
    const canal = body.find((c) => c.icon_key === "youtube");

    expect(canal).toMatchObject({
      contact_value: "https://www.youtube.com/@MeuCanal",
      display: "@MeuCanal",
      url: "https://www.youtube.com/@MeuCanal",
      label: "YouTube",
    });
  });

  test("Invalid phone is refused instead of stored", async () => {
    const type = await contact.createType({ icon_key: "whatsapp", icon_img: "whatsapp" });

    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/contacts`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      // DDD 20 não existe — passa por qualquer checagem de tamanho.
      body: JSON.stringify({ contact_value: "(20) 99999-9999", contact_type_id: type.id }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.message).toMatch(/telefone válido/i);

    // E não gravou nada: o telefone inválido não pode sobrar no perfil.
    const getResponse = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/contacts`);
    const contacts = await getResponse.json();
    expect(contacts.filter((c) => c.icon_key === "whatsapp")).toHaveLength(0);
  });

  test("Phone is normalized into a usable link", async () => {
    const type = await contact.createType({ icon_key: "whatsapp", icon_img: "whatsapp" });

    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/contacts`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ contact_value: "(11) 99999-8888", contact_type_id: type.id }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.contact_value).toBe("https://wa.me/5511999998888");
    expect(body.url).toBe("https://wa.me/5511999998888");
    expect(body.display).toBe("(11) 99999-8888");
  });

  test("Unknown contact type is refused", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/contacts`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ contact_value: "qualquer", contact_type_id: 999999 }),
    });
    expect(response.status).toBe(400);
  });
});
