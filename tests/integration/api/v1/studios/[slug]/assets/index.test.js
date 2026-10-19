import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { authHeaders, createActivatedUserWithSession } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import assetCategory from "models/assetCategory";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("/api/v1/studios/[slug]/assets", () => {
  let ownerToken;
  let outsiderToken;
  let studio;
  let sprites;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoAssetEstudio",
      email: "dono.asset.estudio@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 66123456701,
    });
    ownerToken = ownerCtx.sessionToken;

    const outsiderCtx = await createActivatedUserWithSession({
      username: "ForaAssetEstudio",
      email: "fora.asset.estudio@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 66123456702,
    });
    outsiderToken = outsiderCtx.sessionToken;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Assets API" });
    sprites = await assetCategory.findBySlug("sprites");
  });

  test("Visitante não cria asset", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Invasão", external_url: "https://exemplo.itch.io/x", category_ids: [sprites.id] }),
    });

    expect(response.status).toBe(403);
  });

  test("Quem não é do estúdio não cria asset", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/assets`, {
      method: "POST",
      headers: { ...authHeaders(outsiderToken), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Invasão", external_url: "https://exemplo.itch.io/x", category_ids: [sprites.id] }),
    });

    expect(response.status).toBe(403);
  });

  test("Responsável cria asset com categorias", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/assets`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Pacote do Estúdio",
        external_url: "https://exemplo.itch.io/pacote-estudio",
        category_ids: [sprites.id],
      }),
    });

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.name).toBe("Pacote do Estúdio");
    expect(body.slug).toBe("pacote-do-estudio");
    expect(body.external_url).toBe("https://exemplo.itch.io/pacote-estudio");
    expect(body.is_free).toBe(true);
    expect(body.categories.map((category) => category.slug)).toEqual(["sprites"]);
  });

  test("URL inválida responde 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/assets`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sem URL", external_url: "javascript:alert(1)", category_ids: [sprites.id] }),
    });

    expect(response.status).toBe(400);
  });

  test("Asset sem categoria responde 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/assets`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sem Categoria", external_url: "https://exemplo.itch.io/x", category_ids: [] }),
    });

    expect(response.status).toBe(400);
  });

  test("Listagem do estúdio inclui o asset criado", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/studios/${studio.slug}/assets`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Pacote do Estúdio");
  });
});
