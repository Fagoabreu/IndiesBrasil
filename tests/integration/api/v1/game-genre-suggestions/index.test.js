import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import { createAdminUser } from "tests/helpers/testUtils";
import organization from "models/organization";
import game from "models/game";

/**
 * Sugestões de gênero de jogo.
 *
 * O fluxo é o inverso do catálogo: **qualquer pessoa autenticada sugere**, e só o
 * admin decide. O que este arquivo fixa:
 *
 *  - a sugestão exige `game_id` — o gênero nasce de um jogo concreto;
 *  - **aprovar cria o gênero E vincula ao jogo de origem** na mesma chamada
 *    (obrigar a pessoa a voltar e reselecionar o gênero novo é o passo que faz a
 *    fila nunca esvaziar);
 *  - nome que já existe no catálogo responde 400 **dizendo qual**, senão o admin
 *    aprovaria uma duplicata sem perceber;
 *  - sugestão já revisada não volta para `pending`.
 */
const origin = webserver.origin;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("Sugestões de gênero", () => {
  let adminToken;
  let userToken;
  let suggestedGame;

  beforeAll(async () => {
    const adminCtx = await createAdminUser({
      username: "AdminSugereGenero",
      email: "admin.sugere.genero@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 95123456701,
    });
    adminToken = adminCtx.sessionToken;

    const userCtx = await createActivatedUserWithSession({
      username: "UsuarioSugereGenero",
      email: "usuario.sugere.genero@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 95123456702,
    });
    userToken = userCtx.sessionToken;

    const studio = await organization.create(userCtx.user, { name: "Estúdio da Sugestão" });
    suggestedGame = await game.create(studio.id, userCtx.user.id, {
      name: "Jogo Que Precisa de Gênero",
      genre_names: ["Puzzle"],
      stage: "concept",
    });
  });

  async function suggest(token, payload) {
    return fetch(`${origin}/api/v1/game-genre-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(payload),
    });
  }

  test("Visitante não sugere", async () => {
    const response = await fetch(`${origin}/api/v1/game-genre-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Gênero de Visitante", game_id: suggestedGame.id }),
    });

    // 403: quem barra é `canRequest`, antes do handler — a mesma convenção de
    // curtir/comentar/avaliar como visitante.
    expect(response.status).toBe(403);
  });

  test("Usuário autenticado sugere um gênero novo", async () => {
    const response = await suggest(userToken, {
      name: "Idle de Fazenda",
      justification: "Progressão ociosa com colheita.",
      game_id: suggestedGame.id,
    });

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.name).toBe("Idle de Fazenda");
    expect(body.status).toBe("pending");
    expect(body.game_slug).toBe(suggestedGame.slug);
    expect(body.suggested_by_username).toBe("UsuarioSugereGenero");
  });

  test("Sugestão sem jogo de origem é recusada", async () => {
    const response = await suggest(userToken, { name: "Gênero Sem Dono" });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("jogo onde o gênero foi sugerido");
  });

  test("Nome que já é gênero do catálogo responde 400 dizendo qual", async () => {
    const response = await suggest(userToken, { name: "plataforma", game_id: suggestedGame.id });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("Plataforma");
  });

  test("Visitante não lê a fila", async () => {
    const response = await fetch(`${origin}/api/v1/game-genre-suggestions`);
    expect(response.status).toBe(403);
  });

  test("Admin vê a fila pendente", async () => {
    const response = await fetch(`${origin}/api/v1/game-genre-suggestions`, {
      headers: authHeaders(adminToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.map((item) => item.name)).toContain("Idle de Fazenda");
  });

  test("Status desconhecido na fila responde 400", async () => {
    const response = await fetch(`${origin}/api/v1/game-genre-suggestions?status=aprovada`, {
      headers: authHeaders(adminToken),
    });
    expect(response.status).toBe(400);
  });

  test("Aprovar cria o gênero e vincula ao jogo de origem", async () => {
    const queue = await fetch(`${origin}/api/v1/game-genre-suggestions`, { headers: authHeaders(adminToken) });
    const pending = (await queue.json()).find((item) => item.name === "Idle de Fazenda");

    const response = await fetch(`${origin}/api/v1/game-genre-suggestions/${pending.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ status: "approved", parent_name: "Simulação" }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("approved");

    // O gênero existe no catálogo, como filho do pai escolhido pelo admin...
    const catalog = await fetch(`${origin}/api/v1/game-genres?flat=true`);
    const node = (await catalog.json()).find((item) => item.name === "Idle de Fazenda");
    expect(node).toMatchObject({ parent_name: "Simulação" });

    // ...e o jogo que gerou a sugestão passou a tê-lo, sem ninguém reabrir o
    // formulário do jogo.
    const detail = await fetch(`${origin}/api/v1/games/${suggestedGame.slug}`);
    const detailBody = await detail.json();
    expect(detailBody.genres.map((genre) => genre.name)).toContain("Idle de Fazenda");
    expect(detailBody.genres.map((genre) => genre.name)).toContain("Puzzle");
  });

  test("Aprovar de novo a mesma sugestão responde 400", async () => {
    const reviewed = await fetch(`${origin}/api/v1/game-genre-suggestions?status=approved`, {
      headers: authHeaders(adminToken),
    });
    const approved = (await reviewed.json()).find((item) => item.name === "Idle de Fazenda");

    const response = await fetch(`${origin}/api/v1/game-genre-suggestions/${approved.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ status: "approved" }),
    });

    // Reaprovar criaria uma segunda linha com o mesmo nome no catálogo.
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("já foi aprovada");
  });

  test("Recusar não cria gênero nenhum", async () => {
    const created = await suggest(userToken, { name: "Gênero Recusado", game_id: suggestedGame.id });
    const suggestion = await created.json();

    const response = await fetch(`${origin}/api/v1/game-genre-suggestions/${suggestion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ status: "rejected" }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("rejected");

    const catalog = await fetch(`${origin}/api/v1/game-genres?flat=true`);
    expect((await catalog.json()).some((item) => item.name === "Gênero Recusado")).toBe(false);
  });

  test("Status inválido na revisão responde 400", async () => {
    const created = await suggest(userToken, { name: "Gênero Pendente", game_id: suggestedGame.id });
    const suggestion = await created.json();

    const response = await fetch(`${origin}/api/v1/game-genre-suggestions/${suggestion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ status: "talvez" }),
    });

    expect(response.status).toBe(400);
  });

  test("Sugestão inexistente responde 404", async () => {
    const response = await fetch(`${origin}/api/v1/game-genre-suggestions/00000000-0000-0000-0000-000000000000`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
      body: JSON.stringify({ status: "approved" }),
    });

    expect(response.status).toBe(404);
  });

  test("Usuário comum não revisa a fila", async () => {
    const created = await suggest(userToken, { name: "Gênero Sem Revisão", game_id: suggestedGame.id });
    const suggestion = await created.json();

    const response = await fetch(`${origin}/api/v1/game-genre-suggestions/${suggestion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(userToken) },
      body: JSON.stringify({ status: "approved" }),
    });

    expect(response.status).toBe(403);
  });
});
