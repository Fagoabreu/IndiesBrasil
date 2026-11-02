import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import service from "models/service";

/**
 * Sugestões de serviço.
 *
 * A regra é uma só e é o inverso do catálogo: **qualquer usuário autenticado
 * sugere**, e só o admin decide. O que este arquivo fixa:
 *
 *  - nome já existente responde 400 **dizendo qual** (senão o admin aprovaria
 *    uma duplicata e o catálogo teria dois iguais em grupos diferentes);
 *  - **aprovar cria o serviço na mesma chamada** — mandar o admin redigitar o
 *    nome que acabou de ler é o que faz uma fila nunca esvaziar;
 *  - sugestão já revisada não volta para `pending` nem cria um segundo serviço.
 */

const origin = webserver.origin;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("Sugestões de serviço", () => {
  let adminToken;
  let userToken;

  beforeAll(async () => {
    const adminCtx = await createActivatedUserWithSession({
      username: "AdminSugestoes",
      email: "admin.sugestoes@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 71123456701,
    });
    adminToken = adminCtx.sessionToken;
    await orchestrator.addFeaturesToUser(adminCtx.user, ["read:admin"]);

    const userCtx = await createActivatedUserWithSession({
      username: "UsuarioSugestoes",
      email: "usuario.sugestoes@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 71123456702,
    });
    userToken = userCtx.sessionToken;
  });

  async function suggest(token, payload) {
    return fetch(`${origin}/api/v1/service-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(payload),
    });
  }

  test("Visitante não sugere", async () => {
    const response = await fetch(`${origin}/api/v1/service-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Serviço Novo" }),
    });

    // 403, não 401: quem barra é `canRequest` antes do handler — a mesma
    // convenção de curtir/comentar/avaliar como visitante.
    expect(response.status).toBe(403);
  });

  test("Usuário comum sugere e a sugestão nasce pendente", async () => {
    const response = await suggest(userToken, {
      name: "Motion Capture Facial",
      justification: "Muitos estúdios terceirizam captura facial e não encontram aqui.",
    });

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.status).toBe("pending");
    expect(body.suggested_by_username).toBe("UsuarioSugestoes");
  });

  test("Nome que já existe no catálogo responde 400 dizendo qual", async () => {
    const response = await suggest(userToken, { name: "QA e Testes de Bugs" });

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.message).toContain("QA e Testes de Bugs");
  });

  test("Sugestão duplicada na mesma fila é recusada ao aprovar, não ao sugerir", async () => {
    // O catálogo não é consultado duas vezes na sugestão: o segundo envio com o
    // mesmo nome livre é aceito e fica na fila. Quem barra a duplicata é a
    // criação do serviço, no momento de aprovar.
    const first = await suggest(userToken, { name: "Consultoria de Monetização" });
    expect(first.status).toBe(201);

    const second = await suggest(userToken, { name: "Consultoria de Monetização" });
    expect(second.status).toBe(201);
  });

  test("Usuário comum não lê a fila", async () => {
    const response = await fetch(`${origin}/api/v1/service-suggestions?status=pending`, {
      headers: authHeaders(userToken),
    });

    expect(response.status).toBe(403);
  });

  test("Status inválido responde 400", async () => {
    const response = await fetch(`${origin}/api/v1/service-suggestions?status=aprovado`, {
      headers: authHeaders(adminToken),
    });

    expect(response.status).toBe(400);
  });

  test("Admin lê a fila pendente", async () => {
    const response = await fetch(`${origin}/api/v1/service-suggestions?status=pending`, {
      headers: authHeaders(adminToken),
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((item) => item.status === "pending")).toBe(true);
  });

  test("Aprovar cria o serviço no catálogo", async () => {
    const created = await suggest(userToken, { name: "Acessibilidade e Audiodescrição" });
    const suggestion = await created.json();

    const response = await fetch(`${origin}/api/v1/service-suggestions/${suggestion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ status: "approved", group_key: "qualidade", description: "Legendas, leitores de tela e audiodescrição." }),
    });

    expect(response.status).toBe(200);

    const reviewed = await response.json();
    expect(reviewed.status).toBe("approved");
    expect(reviewed.service_id).toBeTruthy();

    const inCatalog = await service.findBySlug("acessibilidade-e-audiodescricao");
    expect(inCatalog).not.toBeNull();
    expect(inCatalog.group_key).toBe("qualidade");
  });

  test("Aprovar sem grupo responde 400", async () => {
    const created = await suggest(userToken, { name: "Serviço Sem Grupo Definido" });
    const suggestion = await created.json();

    const response = await fetch(`${origin}/api/v1/service-suggestions/${suggestion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ status: "approved" }),
    });

    expect(response.status).toBe(400);
  });

  test("Recusar só marca a sugestão", async () => {
    const created = await suggest(userToken, { name: "Serviço Que Não Existe" });
    const suggestion = await created.json();

    const response = await fetch(`${origin}/api/v1/service-suggestions/${suggestion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ status: "rejected" }),
    });

    expect(response.status).toBe(200);

    const reviewed = await response.json();
    expect(reviewed.status).toBe("rejected");
    expect(reviewed.service_id).toBeNull();

    const inCatalog = await service.findBySlug("servico-que-nao-existe");
    expect(inCatalog).toBeNull();
  });

  test("Sugestão já revisada não pode ser revista de novo", async () => {
    const created = await suggest(userToken, { name: "Revisão Dupla" });
    const suggestion = await created.json();

    const first = await fetch(`${origin}/api/v1/service-suggestions/${suggestion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ status: "rejected" }),
    });
    expect(first.status).toBe(200);

    const second = await fetch(`${origin}/api/v1/service-suggestions/${suggestion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ status: "rejected" }),
    });

    // Reaprovar criaria um segundo serviço com o mesmo nome.
    expect(second.status).toBe(400);
  });
});
