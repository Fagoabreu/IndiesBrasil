import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import service from "models/service";

/**
 * Catálogo de serviços — leitura pública, escrita só do admin.
 *
 * O que este arquivo fixa:
 *
 *  - **o catálogo é público**, mas os inativos só o admin vê (é justamente a
 *    lista dos que saíram do ar);
 *  - **serviço em uso não é excluído**, e sim desativado — a resposta 400 traz a
 *    contagem, porque é ela que diz ao admin o tamanho do problema;
 *  - **grupo inválido responde 400**, não lista inteira.
 */

const origin = webserver.origin;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("Catálogo de serviços", () => {
  let adminToken;
  let userToken;
  let user;

  beforeAll(async () => {
    const adminCtx = await createActivatedUserWithSession({
      username: "AdminServicos",
      email: "admin.servicos@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 69123456701,
    });
    adminToken = adminCtx.sessionToken;
    await orchestrator.addFeaturesToUser(adminCtx.user, ["read:admin"]);

    const userCtx = await createActivatedUserWithSession({
      username: "UsuarioServicos",
      email: "usuario.servicos@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 69123456702,
    });
    userToken = userCtx.sessionToken;
    user = userCtx.user;
  });

  test("O seed deixou os treze serviços no catálogo", async () => {
    const response = await fetch(`${origin}/api/v1/services`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(13);
    expect(body[0]).toHaveProperty("group_key");
    expect(body[0]).toHaveProperty("usage_count");
  });

  test("Filtro por grupo devolve só aquele grupo", async () => {
    const response = await fetch(`${origin}/api/v1/services?group=qualidade`);
    const body = await response.json();

    expect(body.length).toBeGreaterThan(0);
    expect(body.every((item) => item.group_key === "qualidade")).toBe(true);
  });

  test("Grupo desconhecido responde 400 em vez de devolver tudo", async () => {
    const response = await fetch(`${origin}/api/v1/services?group=arte`);
    expect(response.status).toBe(400);
  });

  test("Visitante não vê os inativos", async () => {
    const created = await service.create({ name: "Serviço Aposentado", group_key: "estrategia" });
    await service.update(created.id, { is_active: false });

    const response = await fetch(`${origin}/api/v1/services`);
    const body = await response.json();
    expect(body.find((item) => item.id === created.id)).toBeFalsy();

    const asAdmin = await fetch(`${origin}/api/v1/services?include_inactive=true`, { headers: authHeaders(adminToken) });
    const asAdminBody = await asAdmin.json();
    expect(asAdminBody.find((item) => item.id === created.id)).toBeTruthy();
  });

  test("Usuário comum não pede a lista com inativos", async () => {
    const response = await fetch(`${origin}/api/v1/services?include_inactive=true`, { headers: authHeaders(userToken) });
    expect(response.status).toBe(403);
  });

  test("Usuário comum não cria serviço", async () => {
    const response = await fetch(`${origin}/api/v1/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(userToken) },
      body: JSON.stringify({ name: "Serviço Inventado", group_key: "qualidade" }),
    });

    expect(response.status).toBe(403);
  });

  test("Admin cria, edita e desativa", async () => {
    const created = await fetch(`${origin}/api/v1/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ name: "Consultoria de Áudio", group_key: "arte-audio", description: "Mixagem e masterização." }),
    });
    expect(created.status).toBe(201);

    const serviceCreated = await created.json();

    const patched = await fetch(`${origin}/api/v1/services/${serviceCreated.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ is_active: false, display_order: 9 }),
    });
    expect(patched.status).toBe(200);

    const patchedBody = await patched.json();
    expect(patchedBody.is_active).toBe(false);
    expect(patchedBody.display_order).toBe(9);
  });

  test("Serviço em uso não é excluído: responde 400 com a contagem", async () => {
    const studioService = await service.findBySlug("qa-testes");
    const studio = await organization.create(user, { name: "Estúdio QA Serviços" });
    await organization.setServices(studio.id, [{ service_id: studioService.id }]);

    const response = await fetch(`${origin}/api/v1/services/${studioService.id}`, {
      method: "DELETE",
      headers: authHeaders(adminToken),
    });

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.message).toContain("em uso por 1 estúdio");
    expect(body.action).toContain("Desative");
  });

  test("Serviço sem uso é excluído", async () => {
    const created = await service.create({ name: "Serviço Descartável", group_key: "estrategia" });

    const response = await fetch(`${origin}/api/v1/services/${created.id}`, {
      method: "DELETE",
      headers: authHeaders(adminToken),
    });

    expect(response.status).toBe(204);

    const found = await service.findBySlug(created.slug);
    expect(found).toBeNull();
  });

  test("Grupo inválido na escrita responde 400", async () => {
    const response = await fetch(`${origin}/api/v1/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ name: "Serviço Sem Grupo", group_key: "inexistente" }),
    });

    expect(response.status).toBe(400);
  });
});
