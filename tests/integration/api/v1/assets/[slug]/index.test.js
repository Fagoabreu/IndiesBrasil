import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { authHeaders, createActivatedUserWithSession } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import asset from "models/asset";
import assetCategory from "models/assetCategory";
import moderation from "models/moderation";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("/api/v1/assets/[slug]", () => {
  let owner;
  let ownerToken;
  let outsider;
  let studio;
  let sprites;
  let shaders;
  let created;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoAssetDetalhe",
      email: "dono.asset.detalhe@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 64123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const outsiderCtx = await createActivatedUserWithSession({
      username: "VisitanteAssetDetalhe",
      email: "visitante.asset.detalhe@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 64123456702,
    });
    outsider = outsiderCtx.user;

    studio = await organization.create(owner, { name: "Estúdio Asset Detalhe" });
    sprites = await assetCategory.findBySlug("sprites");
    shaders = await assetCategory.findBySlug("shaders");

    created = await asset.create(owner.id, studio.id, {
      name: "Pacote Detalhe",
      short_description: "Pacote usado nos testes de detalhe",
      external_url: "https://exemplo.itch.io/pacote-detalhe",
      category_ids: [sprites.id],
      license: "cc0",
    });
  });

  test("Visitante lê o detalhe", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.name).toBe("Pacote Detalhe");
    expect(body.external_url).toBe("https://exemplo.itch.io/pacote-detalhe");
    expect(body.categories).toHaveLength(1);
    expect(body.viewer).toEqual({
      canEdit: false,
      userReview: null,
      likedByUser: false,
      likesCount: 0,
      commentsCount: 0,
    });
  });

  test("Visitante não pode editar", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Invasão" }),
    });

    expect(response.status).toBe(403);
  });

  test("Usuário sem vínculo com o estúdio não pode editar", async () => {
    const session = await orchestrator.createSession(outsider);

    const response = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}`, {
      method: "PATCH",
      headers: { ...authHeaders(session.token), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Invasão" }),
    });

    expect(response.status).toBe(403);
  });

  test("Estúdio edita nome, URL, licença e categorias", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Pacote Detalhe Editado",
        external_url: "https://kenney.nl/assets/pacote-detalhe",
        license: "cc-by",
        category_ids: [sprites.id, shaders.id],
      }),
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.name).toBe("Pacote Detalhe Editado");
    expect(body.slug).toBe("pacote-detalhe-editado");
    expect(body.external_url).toBe("https://kenney.nl/assets/pacote-detalhe");
    expect(body.license).toBe("cc-by");
    expect(body.categories.map((category) => category.slug).sort()).toEqual(["shaders", "sprites"]);

    created = body;
  });

  test("URL inválida responde 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "Content-Type": "application/json" },
      body: JSON.stringify({ external_url: "javascript:alert(1)" }),
    });

    expect(response.status).toBe(400);
  });

  test("Categoria inativa não pode ser vinculada", async () => {
    const inactive = await assetCategory.create({
      name: "Categoria Desativada",
      group_key: "codigo",
      display_order: 99,
    });
    await assetCategory.update(inactive.id, { is_active: false });

    const response = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "Content-Type": "application/json" },
      body: JSON.stringify({ category_ids: [sprites.id, inactive.id] }),
    });

    expect(response.status).toBe(400);
  });

  test("Asset bloqueado responde 404 para todos", async () => {
    await moderation.createBlock({
      targetType: "asset",
      targetId: created.id,
      reason: "violacao_termos",
      moderatorId: owner.id,
    });

    const anonymous = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}`);
    expect(anonymous.status).toBe(404);

    const authenticated = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}`, {
      headers: authHeaders(ownerToken),
    });
    expect(authenticated.status).toBe(404);
  });

  test("Estúdio exclui o próprio asset", async () => {
    const blockRow = await moderation.findActiveBlock("asset", created.id);
    await moderation.revokeBlock(blockRow.id, owner.id);

    const response = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(204);

    const after = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}`);
    expect(after.status).toBe(404);
  });
});
