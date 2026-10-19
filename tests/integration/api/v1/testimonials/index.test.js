import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { authHeaders, createActivatedUserWithSession } from "tests/helpers/storeTestUtils";
import database from "infra/database";

/**
 * Depoimento: **um por pessoa**, e o autor pode editar ou excluir o seu a
 * qualquer momento pela interface.
 *
 * O ponto mais importante aqui é o que a rota não controla: o índice único
 * `testimonials_one_per_author` é a garantia final, então o teste o exercita
 * direto no banco. Se ele cair, dois envios simultâneos passariam pela
 * checagem do model e criariam dois depoimentos para a mesma pessoa.
 */

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("/api/v1/testimonials", () => {
  let userToken;
  let user;

  beforeAll(async () => {
    const ctx = await createActivatedUserWithSession({
      username: "AutorDepoimento",
      email: "autor.depoimento@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 71123456701,
    });

    user = ctx.user;
    userToken = ctx.sessionToken;
  });

  test("Visitante lê a lista (vazia) e não pode publicar", async () => {
    const list = await fetch(`${webserver.origin}/api/v1/testimonials`);
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual([]);

    const post = await fetch(`${webserver.origin}/api/v1/testimonials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Sem sessão" }),
    });

    expect(post.status).toBe(403);
  });

  test("Visitante não tem depoimento em /mine", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/testimonials/mine`);

    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  test("Usuário logado publica o próprio depoimento", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/testimonials`, {
      method: "POST",
      headers: { ...authHeaders(userToken), "Content-Type": "application/json" },
      body: JSON.stringify({ content: "A comunidade me ajudou a lançar meu primeiro jogo.", role: "Desenvolvedor" }),
    });

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.author_id).toBe(user.id);
    expect(body.content).toBe("A comunidade me ajudou a lançar meu primeiro jogo.");
    expect(body.role).toBe("Desenvolvedor");
    expect(body.status).toBe("approved");
  });

  test("O segundo depoimento do mesmo usuário responde 400 e explica a edição", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/testimonials`, {
      method: "POST",
      headers: { ...authHeaders(userToken), "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Outro depoimento" }),
    });

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.message).toBe("Você já tem um depoimento publicado.");
    expect(body.action).toContain("Edite o depoimento existente");
  });

  test("O índice único impede o segundo registro mesmo fora da rota", async () => {
    // `database.query` embrulha o erro do driver em `ServiceError`, então o
    // código do Postgres fica na causa.
    await expect(
      database.query({
        text: `INSERT INTO testimonials (author_id, content) VALUES ($1, $2)`,
        values: [user.id, "Inserido direto no banco"],
      }),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
  });

  test("/mine devolve o depoimento do usuário logado", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/testimonials/mine`, {
      headers: authHeaders(userToken),
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.content).toBe("A comunidade me ajudou a lançar meu primeiro jogo.");
    expect(body.updated_at).toBeTruthy();
  });

  test("O autor edita o próprio depoimento", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/testimonials/mine`, {
      method: "PATCH",
      headers: { ...authHeaders(userToken), "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Texto atualizado depois de reler.", role: "Desenvolvedor indie" }),
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.content).toBe("Texto atualizado depois de reler.");
    expect(body.role).toBe("Desenvolvedor indie");

    const list = await (await fetch(`${webserver.origin}/api/v1/testimonials`)).json();
    expect(list).toHaveLength(1);
    expect(list[0].content).toBe("Texto atualizado depois de reler.");
  });

  test("Depoimento é texto puro: tags são removidas na escrita", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/testimonials/mine`, {
      method: "PATCH",
      headers: { ...authHeaders(userToken), "Content-Type": "application/json" },
      body: JSON.stringify({ content: "<b>Comunidade</b> <script>alert(1)</script>incrível" }),
    });

    expect(response.status).toBe(200);
    // O sanitizador remove a tag E o conteúdo de `<script>` — o texto que sobra
    // é o que o usuário escreveu fora do bloco.
    expect((await response.json()).content).toBe("Comunidade incrível");
  });

  test("Conteúdo vazio ou acima do limite responde 400", async () => {
    const empty = await fetch(`${webserver.origin}/api/v1/testimonials/mine`, {
      method: "PATCH",
      headers: { ...authHeaders(userToken), "Content-Type": "application/json" },
      body: JSON.stringify({ content: "   " }),
    });
    expect(empty.status).toBe(400);

    const tooLong = await fetch(`${webserver.origin}/api/v1/testimonials/mine`, {
      method: "PATCH",
      headers: { ...authHeaders(userToken), "Content-Type": "application/json" },
      body: JSON.stringify({ content: "a".repeat(501) }),
    });
    expect(tooLong.status).toBe(400);
  });

  test("O autor exclui o próprio depoimento", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/testimonials/mine`, {
      method: "DELETE",
      headers: authHeaders(userToken),
    });

    expect(response.status).toBe(204);

    const mine = await (await fetch(`${webserver.origin}/api/v1/testimonials/mine`, { headers: authHeaders(userToken) })).json();
    expect(mine).toBeNull();

    const list = await (await fetch(`${webserver.origin}/api/v1/testimonials`)).json();
    expect(list).toEqual([]);
  });

  test("Editar ou excluir sem ter depoimento responde 404", async () => {
    const patch = await fetch(`${webserver.origin}/api/v1/testimonials/mine`, {
      method: "PATCH",
      headers: { ...authHeaders(userToken), "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Não existe" }),
    });
    expect(patch.status).toBe(404);

    const del = await fetch(`${webserver.origin}/api/v1/testimonials/mine`, {
      method: "DELETE",
      headers: authHeaders(userToken),
    });
    expect(del.status).toBe(404);
  });

  test("Depois de excluir, o mesmo usuário pode publicar de novo", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/testimonials`, {
      method: "POST",
      headers: { ...authHeaders(userToken), "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Recomecei o depoimento do zero." }),
    });

    expect(response.status).toBe(201);
    expect((await response.json()).content).toBe("Recomecei o depoimento do zero.");
  });
});
