import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import activation from "models/activation";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("PATCH /api/v1/reset-password/[token_id]", () => {
  let createdUser;

  beforeAll(async () => {
    createdUser = await orchestrator.createUser({
      username: "ResetSenhaToken",
      email: "reset.senha.token@teste.dev",
      password: "Senha@Antiga1",
      cpf: "80123456702",
    });
  });

  test("Changes password with a valid token", async () => {
    const resetToken = await activation.create(createdUser.id, activation.TOKEN_PURPOSE.RESET);

    const response = await fetch(`${webserver.origin}/api/v1/reset-password/${resetToken.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "Senha@Nova1" }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body).toMatchObject({
      id: resetToken.id,
      user_id: createdUser.id,
    });
    expect(body.used_at).not.toBeNull();
  });

  test("Short password returns 400", async () => {
    const resetToken = await activation.create(createdUser.id, activation.TOKEN_PURPOSE.RESET);

    const response = await fetch(`${webserver.origin}/api/v1/reset-password/${resetToken.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "123" }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Missing password returns 400", async () => {
    const resetToken = await activation.create(createdUser.id, activation.TOKEN_PURPOSE.RESET);

    const response = await fetch(`${webserver.origin}/api/v1/reset-password/${resetToken.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Non-existent token returns 404", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/reset-password/b80cfad3-f589-4c0f-b12d-df686093c2a7`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "Senha@Nova1" }),
    });
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });

  test("Already used token returns 404", async () => {
    const resetToken = await activation.create(createdUser.id, activation.TOKEN_PURPOSE.RESET);

    const firstResponse = await fetch(`${webserver.origin}/api/v1/reset-password/${resetToken.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "Senha@Nova2" }),
    });
    expect(firstResponse.status).toBe(201);

    const secondResponse = await fetch(`${webserver.origin}/api/v1/reset-password/${resetToken.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "Senha@Nova3" }),
    });
    expect(secondResponse.status).toBe(404);

    const body = await secondResponse.json();
    expect(body.name).toBe("NotFoundError");
  });

  test("Token de ativação NÃO troca senha", async () => {
    // O ponto da migration `activation-token-purpose`: os dois tokens viviam na
    // mesma tabela sem nada que os distinguisse, então o token que chega por
    // e-mail no cadastro — que fica guardado no inbox, que pode ter sido
    // encaminhado — servia para trocar a senha. Aqui a finalidade é o que
    // separa, e o token de ativação precisa ser recusado.
    const activationToken = await activation.create(createdUser.id);

    const response = await fetch(`${webserver.origin}/api/v1/reset-password/${activationToken.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "Senha@Invasor1" }),
    });

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");

    // E o token continua **não consumido**: o fluxo de ativação segue valendo,
    // que é o que impede a recusa de virar um efeito colateral.
    const stillValid = await activation.findOneValidById(activationToken.id);
    expect(stillValid.used_at).toBeNull();
    expect(stillValid.purpose).toBe(activation.TOKEN_PURPOSE.ACTIVATION);
  });
});
