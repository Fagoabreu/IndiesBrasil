import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import database from "infra/database";
import organization from "models/organization";
import boardgame from "models/boardgame";
import book from "models/book";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession } from "tests/helpers/storeTestUtils";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/status/summary", () => {
  test("Anonymous user gets the summary", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/status/summary`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("user_accounts");
    expect(body).toHaveProperty("new_user_accounts");
    expect(body).toHaveProperty("new_posts");
    expect(body).toHaveProperty("previous_posts");
    expect(body).toHaveProperty("events");
    expect(body).toHaveProperty("previous_events");
    expect(body).toHaveProperty("organizations");
    expect(body).toHaveProperty("new_organizations");
    expect(body).toHaveProperty("games");
    expect(body).toHaveProperty("new_games");
    expect(body).toHaveProperty("boardgames");
    expect(body).toHaveProperty("new_boardgames");
    expect(body).toHaveProperty("books");
    expect(body).toHaveProperty("new_books");
    expect(body).toHaveProperty("live_streams");
    expect(body).toHaveProperty("streaming_studios");
  });

  test("Summary counts activated users", async () => {
    await createActivatedUserWithSession({
      username: "ResumoUsuario",
      email: "resumo.usuario@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 90123456706,
    });

    const response = await fetch(`${webserver.origin}/api/v1/status/summary`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Number(body.user_accounts)).toBe(1);
  });

  test("Summary counts boardgames, books and streaming studios", async () => {
    const { user: owner } = await createActivatedUserWithSession({
      username: "ResumoCatalogo",
      email: "resumo.catalogo@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 90123456707,
    });

    const studio = await organization.create(owner, { name: "Estúdio Resumo" });
    await boardgame.create(owner.id, studio.id, { name: "Jogo de Mesa do Resumo" });
    await book.create(owner.id, studio.id, { title: "Livro do Resumo" });

    // Canal cadastrado → conta em streaming_studios. O status de live vem do
    // cache (org_stream_status), que em produção é alimentado pelo refresh da
    // página de streams; aqui é populado direto para isolar a contagem.
    await database.query({
      text: `UPDATE organizations SET twitch_channel = $1 WHERE id = $2;`,
      values: ["estudio_resumo", studio.id],
    });

    await database.query({
      text: `INSERT INTO org_stream_status (org_id, platform, is_live) VALUES ($1, 'twitch', true);`,
      values: [studio.id],
    });

    const response = await fetch(`${webserver.origin}/api/v1/status/summary`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Number(body.boardgames)).toBe(1);
    expect(Number(body.new_boardgames)).toBe(1);
    expect(Number(body.books)).toBe(1);
    expect(Number(body.new_books)).toBe(1);
    expect(Number(body.live_streams)).toBe(1);
    expect(Number(body.streaming_studios)).toBe(1);
  });
});
