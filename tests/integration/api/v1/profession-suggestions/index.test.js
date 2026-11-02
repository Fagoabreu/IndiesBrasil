import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import { createAdminUser } from "tests/helpers/testUtils";
import profession from "models/profession";

/**
 * Sugestões de profissão.
 *
 * A regra é o inverso do catálogo: **qualquer usuário autenticado sugere**, e só
 * o admin decide. O que este arquivo fixa:
 *
 *  - nome já existente responde 400 **dizendo qual** (senão o admin aprovaria uma
 *    duplicata e o catálogo teria dois iguais em grupos diferentes);
 *  - **aprovar cria a profissão na mesma chamada** e exige o ícone — sem ele o
 *    perfil de quem declarar mostraria imagem quebrada;
 *  - sugestão já revisada não volta para `pending` nem cria um segundo item.
 */
const origin = webserver.origin;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("Sugestões de profissão", () => {
  let adminToken;
  let userToken;

  beforeAll(async () => {
    const adminCtx = await createAdminUser({
      username: "AdminSugestoesProf",
      email: "admin.sugestoes.prof@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456701,
    });
    adminToken = adminCtx.sessionToken;

    const userCtx = await createActivatedUserWithSession({
      username: "UsuarioSugestoesProf",
      email: "usuario.sugestoes.prof@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456702,
    });
    userToken = userCtx.sessionToken;
  });

  async function suggest(token, payload) {
    return fetch(`${origin}/api/v1/profession-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(payload),
    });
  }

  test("Visitante não sugere", async () => {
    const response = await fetch(`${origin}/api/v1/profession-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Profissão Nova" }),
    });

    // 403, não 401: quem barra é `canRequest` antes do handler — a mesma
    // convenção de curtir/comentar/avaliar como visitante.
    expect(response.status).toBe(403);
  });

  test("Usuário comum sugere e a sugestão nasce pendente", async () => {
    const response = await suggest(userToken, {
      name: "Roteirista de Missões",
      justification: "Muitos estúdios separam quem escreve a narrativa principal de quem escreve as missões.",
    });

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.status).toBe("pending");
    expect(body.suggested_by_username).toBe("UsuarioSugestoesProf");
  });

  test("Nome que já existe no catálogo responde 400 dizendo qual", async () => {
    const response = await suggest(userToken, { name: "designer de jogos" });

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.message).toContain("Designer de Jogos");
  });

  test("Usuário comum não lê a fila", async () => {
    const response = await fetch(`${origin}/api/v1/profession-suggestions?status=pending`, {
      headers: authHeaders(userToken),
    });

    expect(response.status).toBe(403);
  });

  test("Status inválido responde 400", async () => {
    const response = await fetch(`${origin}/api/v1/profession-suggestions?status=aprovado`, {
      headers: authHeaders(adminToken),
    });

    expect(response.status).toBe(400);
  });

  test("Admin lê a fila pendente", async () => {
    const response = await fetch(`${origin}/api/v1/profession-suggestions?status=pending`, {
      headers: authHeaders(adminToken),
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((item) => item.status === "pending")).toBe(true);
  });

  test("Aprovar cria a profissão no catálogo", async () => {
    const created = await suggest(userToken, { name: "Acessibilidade de Jogos" });
    const suggestion = await created.json();

    const response = await fetch(`${origin}/api/v1/profession-suggestions/${suggestion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ status: "approved", group_key: "design", icon_img: "GameDesigner", description: "Projeta acessibilidade." }),
    });

    expect(response.status).toBe(200);

    const reviewed = await response.json();
    expect(reviewed.status).toBe("approved");

    const inCatalog = await profession.findByName("Acessibilidade de Jogos");
    expect(inCatalog).not.toBeNull();
    expect(inCatalog.group_key).toBe("design");
    expect(inCatalog.icon_img).toBe("GameDesigner");
  });

  test("Aprovar sem ícone responde 400", async () => {
    const created = await suggest(userToken, { name: "Profissão Sem Ícone Escolhido" });
    const suggestion = await created.json();

    const response = await fetch(`${origin}/api/v1/profession-suggestions/${suggestion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ status: "approved", group_key: "outros" }),
    });

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.message).toContain("ícone");
  });

  test("Aprovar sem grupo responde 400", async () => {
    const created = await suggest(userToken, { name: "Profissão Sem Grupo Escolhido" });
    const suggestion = await created.json();

    const response = await fetch(`${origin}/api/v1/profession-suggestions/${suggestion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ status: "approved", icon_img: "Writer" }),
    });

    expect(response.status).toBe(400);
  });

  test("Recusar só marca a sugestão", async () => {
    const created = await suggest(userToken, { name: "Profissão Que Não Existe" });
    const suggestion = await created.json();

    const response = await fetch(`${origin}/api/v1/profession-suggestions/${suggestion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ status: "rejected" }),
    });

    expect(response.status).toBe(200);

    const reviewed = await response.json();
    expect(reviewed.status).toBe("rejected");

    const inCatalog = await profession.findByName("Profissão Que Não Existe");
    expect(inCatalog).toBeNull();
  });

  test("Sugestão já revisada não pode ser revista de novo", async () => {
    const created = await suggest(userToken, { name: "Revisão Dupla Profissão" });
    const suggestion = await created.json();

    const first = await fetch(`${origin}/api/v1/profession-suggestions/${suggestion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ status: "rejected" }),
    });
    expect(first.status).toBe(200);

    const second = await fetch(`${origin}/api/v1/profession-suggestions/${suggestion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ status: "rejected" }),
    });

    // Reaprovar criaria uma segunda profissão com o mesmo nome.
    expect(second.status).toBe(400);
  });
});
