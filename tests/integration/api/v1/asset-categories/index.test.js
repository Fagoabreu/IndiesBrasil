import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { authHeaders, createActivatedUserWithSession } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import asset from "models/asset";
import assetCategory from "models/assetCategory";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("/api/v1/asset-categories", () => {
  let admin;
  let adminToken;
  let memberToken;
  let studio;
  let member;

  beforeAll(async () => {
    const adminCtx = await createActivatedUserWithSession({
      username: "AdminCategorias",
      email: "admin.categorias@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 65123456701,
    });
    admin = adminCtx.user;
    adminToken = adminCtx.sessionToken;
    await orchestrator.addFeaturesToUser(admin, ["read:admin"]);

    const memberCtx = await createActivatedUserWithSession({
      username: "MembroCategorias",
      email: "membro.categorias@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 65123456702,
    });
    member = memberCtx.user;
    memberToken = memberCtx.sessionToken;

    studio = await organization.create(member, { name: "Estúdio Categorias" });
  });

  test("Visitante lê a taxonomia pública (seed da migration)", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/asset-categories`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.length).toBeGreaterThan(0);
    expect(body.map((category) => category.slug)).toContain("sprites");
    expect(body.every((category) => category.is_active)).toBe(true);
  });

  test("Categoria inativa só aparece para administrador", async () => {
    const inactive = await assetCategory.create({ name: "Fora de Linha", group_key: "codigo", display_order: 90 });
    await assetCategory.update(inactive.id, { is_active: false });

    const anonymous = await fetch(`${webserver.origin}/api/v1/asset-categories`);
    const anonymousBody = await anonymous.json();
    expect(anonymousBody.map((category) => category.slug)).not.toContain(inactive.slug);

    const forbidden = await fetch(`${webserver.origin}/api/v1/asset-categories?include_inactive=true`);
    expect(forbidden.status).toBe(403);

    const asAdmin = await fetch(`${webserver.origin}/api/v1/asset-categories?include_inactive=true`, {
      headers: authHeaders(adminToken),
    });
    expect(asAdmin.status).toBe(200);

    const adminBody = await asAdmin.json();
    expect(adminBody.map((category) => category.slug)).toContain(inactive.slug);
  });

  test("Visitante e membro comum não podem criar categoria", async () => {
    const anonymous = await fetch(`${webserver.origin}/api/v1/asset-categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Nova", group_key: "audio" }),
    });
    expect(anonymous.status).toBe(403);

    const asMember = await fetch(`${webserver.origin}/api/v1/asset-categories`, {
      method: "POST",
      headers: { ...authHeaders(memberToken), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Nova", group_key: "audio" }),
    });
    expect(asMember.status).toBe(403);
  });

  test("Administrador cria categoria", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/asset-categories`, {
      method: "POST",
      headers: { ...authHeaders(adminToken), "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Cutscenes",
        description: "Vídeos e sequências animadas",
        group_key: "arte-2d",
        display_order: 10,
      }),
    });

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.slug).toBe("cutscenes");
    expect(body.name).toBe("Cutscenes");
    expect(body.group_key).toBe("arte-2d");
    expect(body.is_active).toBe(true);
  });

  test("Grupo inválido responde 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/asset-categories`, {
      method: "POST",
      headers: { ...authHeaders(adminToken), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Grupo Errado", group_key: "arte" }),
    });

    expect(response.status).toBe(400);
  });

  test("Administrador desativa e reativa sem perder os assets", async () => {
    const sprites = await assetCategory.findBySlug("sprites");
    const created = await asset.create(member.id, studio.id, {
      name: "Asset com Categoria",
      external_url: "https://exemplo.itch.io/asset-categoria",
      category_ids: [sprites.id],
    });

    const deactivate = await fetch(`${webserver.origin}/api/v1/asset-categories/${sprites.id}`, {
      method: "PATCH",
      headers: { ...authHeaders(adminToken), "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });
    expect(deactivate.status).toBe(200);
    expect((await deactivate.json()).is_active).toBe(false);

    // O asset mantém a categoria: desativar tira do seletor e dos filtros, não
    // apaga a classificação de quem já a tinha.
    const detail = await fetch(`${webserver.origin}/api/v1/assets/${created.slug}`);
    const detailBody = await detail.json();
    expect(detailBody.categories.map((category) => category.slug)).toEqual(["sprites"]);

    const reactivate = await fetch(`${webserver.origin}/api/v1/asset-categories/${sprites.id}`, {
      method: "PATCH",
      headers: { ...authHeaders(adminToken), "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: true }),
    });
    expect(reactivate.status).toBe(200);
    expect((await reactivate.json()).is_active).toBe(true);
  });

  test("Excluir categoria em uso responde 400 com a contagem", async () => {
    const sprites = await assetCategory.findBySlug("sprites");

    const response = await fetch(`${webserver.origin}/api/v1/asset-categories/${sprites.id}`, {
      method: "DELETE",
      headers: authHeaders(adminToken),
    });

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.message).toContain("em uso por");
    expect(body.action).toContain("Desative");
  });

  test("Excluir categoria sem uso funciona", async () => {
    const unused = await assetCategory.create({ name: "Sem Uso", group_key: "codigo", display_order: 80 });

    const response = await fetch(`${webserver.origin}/api/v1/asset-categories/${unused.id}`, {
      method: "DELETE",
      headers: authHeaders(adminToken),
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.slug).toBe("sem-uso");
  });

  test("Membro não pode excluir categoria", async () => {
    const unused = await assetCategory.create({ name: "Exclusão Bloqueada", group_key: "audio" });

    const response = await fetch(`${webserver.origin}/api/v1/asset-categories/${unused.id}`, {
      method: "DELETE",
      headers: authHeaders(memberToken),
    });

    expect(response.status).toBe(403);
  });
});
