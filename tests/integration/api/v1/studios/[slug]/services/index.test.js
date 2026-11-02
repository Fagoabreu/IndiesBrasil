import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import service from "models/service";
import { MAX_STUDIO_SERVICES } from "@/lib/serviceGroups";

/**
 * Declaração de serviços do estúdio.
 *
 * O que este arquivo fixa:
 *
 *  - **só quem administra o estúdio declara** (dono ou admin, como os contatos);
 *  - **o PUT substitui a lista inteira** — trocar de serviço e limpar tudo
 *    funcionam na mesma chamada, sem estado intermediário inválido;
 *  - **serviço desativado que já estava vinculado continua aceito**: sem isso,
 *    salvar o formulário apagaria a declaração que o admin aposentou depois, e o
 *    estúdio não teria como recuperá-la;
 *  - **valor e resumo são validados** (400 para preço inválido, 400 acima do
 *    teto).
 */

const origin = webserver.origin;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("Serviços do estúdio", () => {
  let ownerToken;
  let insiderToken;
  let outsiderToken;
  let studio;
  let qa;
  let localizacao;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoServicoEstudio",
      email: "dono.servico.estudio@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 70123456701,
    });
    ownerToken = ownerCtx.sessionToken;

    const outsiderCtx = await createActivatedUserWithSession({
      username: "ForaServicoEstudio",
      email: "fora.servico.estudio@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 70123456702,
    });
    outsiderToken = outsiderCtx.sessionToken;

    studio = await organization.create(ownerCtx.user, { name: "Estúdio Serviços" });

    // Um membro comum: pode editar a declaração (a regra é dono **ou** admin,
    // como nos contatos e nos produtos).
    const insiderCtx = await createActivatedUserWithSession({
      username: "MembroServicoEstudio",
      email: "membro.servico.estudio@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 70123456703,
    });
    insiderToken = insiderCtx.sessionToken;
    const invitation = await organization.createInvitation(studio.id, insiderCtx.user.id, ownerCtx.user.id, { role: "admin" });
    await organization.respondToInvitation(invitation.id, insiderCtx.user.id, true);

    qa = await service.findBySlug("qa-testes");
    localizacao = await service.findBySlug("localizacao-traducao");
  });

  async function put(token, services) {
    return fetch(`${origin}/api/v1/studios/${studio.slug}/services`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ services }),
    });
  }

  test("Visitante não lê a declaração", async () => {
    const response = await fetch(`${origin}/api/v1/studios/${studio.slug}/services`);
    expect(response.status).toBe(403);
  });

  test("Usuário de fora não lê nem grava", async () => {
    const read = await fetch(`${origin}/api/v1/studios/${studio.slug}/services`, { headers: authHeaders(outsiderToken) });
    expect(read.status).toBe(403);

    const write = await put(outsiderToken, [{ service_id: qa.id }]);
    expect(write.status).toBe(403);
  });

  test("Dono declara serviços com resumo e valor", async () => {
    const response = await put(ownerToken, [
      { service_id: qa.id, summary: "Testes de regressão a cada build.", price: "2500", price_note: "por mês" },
      { service_id: localizacao.id, summary: "PT-BR, EN e ES." },
    ]);

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(2);

    const qaRow = body.find((item) => item.id === qa.id);
    expect(qaRow.summary).toBe("Testes de regressão a cada build.");
    expect(Number(qaRow.price)).toBe(2500);
    expect(qaRow.price_note).toBe("por mês");
  });

  test("A página pública do estúdio recebe os serviços", async () => {
    const response = await fetch(`${origin}/api/v1/studios/${studio.slug}`);

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.services)).toBe(true);
    expect(body.services).toHaveLength(2);
    expect(body.services[0]).toHaveProperty("name");
  });

  test("O PUT substitui a lista inteira", async () => {
    const response = await put(ownerToken, [{ service_id: qa.id }]);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(qa.id);
  });

  test("Lista vazia limpa a declaração", async () => {
    const response = await put(ownerToken, []);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual([]);
  });

  test("Membro administrador também declara", async () => {
    const response = await put(insiderToken, [{ service_id: localizacao.id }]);
    expect(response.status).toBe(200);
  });

  test("Serviço desativado que o estúdio já declara continua aceito", async () => {
    // O estúdio declara `localizacao`; o admin aposenta o serviço depois.
    await service.update(localizacao.id, { is_active: false });

    const kept = await put(ownerToken, [{ service_id: localizacao.id, summary: "Continua valendo." }]);
    expect(kept.status).toBe(200);

    // Mas um serviço desativado que o estúdio **nunca** declarou é recusado —
    // senão o formulário ofereceria algo que saiu do catálogo.
    const aposentado = await service.create({ name: "Serviço Fora do Ar", group_key: "estrategia" });
    await service.update(aposentado.id, { is_active: false });

    const rejected = await put(ownerToken, [{ service_id: aposentado.id }]);
    expect(rejected.status).toBe(400);

    await service.update(localizacao.id, { is_active: true });
  });

  test("Preço inválido responde 400", async () => {
    const response = await put(ownerToken, [{ service_id: qa.id, price: "abc" }]);
    expect(response.status).toBe(400);
  });

  test("Preço negativo responde 400", async () => {
    const response = await put(ownerToken, [{ service_id: qa.id, price: -10 }]);
    expect(response.status).toBe(400);
  });

  test("Resumo acima do limite responde 400", async () => {
    const response = await put(ownerToken, [{ service_id: qa.id, summary: "a".repeat(201) }]);
    expect(response.status).toBe(400);
  });

  test("Item repetido responde 400", async () => {
    const response = await put(ownerToken, [{ service_id: qa.id }, { service_id: qa.id }]);
    expect(response.status).toBe(400);
  });

  test("Acima do teto de serviços responde 400", async () => {
    const catalog = await service.findAll();
    const tooMany = catalog.slice(0, MAX_STUDIO_SERVICES + 1).map((item) => ({ service_id: item.id }));

    const response = await put(ownerToken, tooMany);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.message).toContain(String(MAX_STUDIO_SERVICES));
  });

  test("Serviço inexistente responde 400", async () => {
    const response = await put(ownerToken, [{ service_id: 999999 }]);
    expect(response.status).toBe(400);
  });
});
