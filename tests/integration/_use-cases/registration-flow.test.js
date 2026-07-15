import webserver from "infra/webserver.js";
import activation from "models/activation.js";
import user from "models/user.js";
import orchestrator from "tests/orchestrator.js";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("Use case: Registration Flow (all successful)", () => {
  let createUserResponseBody;
  let activationTokenId;
  let createSessionResponseBody;

  test("Create user account", async () => {
    const createUserResponse = await fetch(`${webserver.origin}/api/v1/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "RegistrationFlow",
        email: "registration.flow@curso.dev",
        password: TEST_CREDENTIALS.registrationFlow,
        cpf: "12312312312",
      }),
    });
    expect(createUserResponse.status).toBe(201);

    createUserResponseBody = await createUserResponse.json();
    expect(createUserResponseBody).toEqual({
      id: createUserResponseBody.id,
      username: "RegistrationFlow",
      created_at: createUserResponseBody.created_at,
      updated_at: createUserResponseBody.updated_at,
      features: ["read:activation_token"],
      avatar_image: null,
      background_image: null,
      bio: null,
      resumo: null,
      visibility: "public",
    });
  });

  test("Receive activation email", async () => {
    const lastEmail = await orchestrator.getLastEmail();

    expect(lastEmail.sender).toBe("<contato@indies.com.br>");
    expect(lastEmail.recipients[0]).toBe("<registration.flow@curso.dev>");
    expect(lastEmail.subject).toBe("Ative seu cadastro no Indies Brasil");
    expect(lastEmail.text).toContain("RegistrationFlow");

    activationTokenId = orchestrator.extractUUID(lastEmail.text);
    expect(lastEmail.text).toContain(`${webserver.origin}/cadastro/ativar/${activationTokenId}`);

    const activationTokenObject = await activation.findOneValidById(activationTokenId);

    expect(activationTokenObject.user_id).toBe(createUserResponseBody.id);
    expect(activationTokenObject.used_at).toBeNull();
  });

  test("Active account", async () => {
    const activationResponse = await fetch(`${webserver.origin}/api/v1/activations/${activationTokenId}`, {
      method: "PATCH",
    });
    expect(activationResponse.status).toBe(200);
    const activationResponseBody = await activationResponse.json();
    expect(Date.parse(activationResponseBody.used_at)).not.toBeNaN();

    const activatedUser = await user.findOneByUsername("RegistrationFlow");
    expect(activatedUser.features).toEqual([
      "create:session",
      "read:session",
      "read:post",
      "create:post",
      "update:post",
      "read:user",
      "update:user",
      "read:event",
      "create:event",
      "update:event",
      "read:studio",
      "create:studio",
      "update:studio",
      "delete:studio",
      "read:studio:member",
      "create:studio:member",
      "delete:studio:member",
      "read:studio:invitation",
      "create:studio:invitation",
      "read:studio:follow",
      "create:studio:follow",
      "read:game",
      "read:game:all",
      "create:game",
      "update:game",
      "delete:game",
      "create:game:follow",
      "read:game:follow",
      "create:game:review",
      "update:game:review",
      "read:boardgame",
      "read:boardgame:all",
      "create:boardgame",
      "update:boardgame",
      "delete:boardgame",
      "create:boardgame:follow",
      "read:boardgame:follow",
      "create:boardgame:review",
      "update:boardgame:review",
      "read:book",
      "read:book:all",
      "create:book",
      "update:book",
      "delete:book",
      "create:book:review",
      "update:book:review",
      "create:book:follow",
      "read:book:follow",
      "read:course",
      "create:course",
      "update:course",
      "delete:course",
      "read:course:lesson",
      "create:course:lesson",
      "update:course:lesson",
      "delete:course:lesson",
      "create:course:rating",
      "read:course:rating",
      "create:course:progress",
      "read:course:progress",
      "read:course:comment",
      "create:course:comment",
      "update:course:comment",
      "delete:course:comment",
      "create:course:enrollment",
      "read:course:enrollment",
      "read:news",
      "read:news:all",
      "create:news",
      "update:news",
      "delete:news",
      "create:news:rating",
      "create:news:factcheck",
      "create:news:comment",
      "read:content_review",
      "read:content_review:all",
      "create:content_review",
      "update:content_review",
      "delete:content_review",
    ]);
  });

  test("Login", async () => {
    const createSessionResponse = await fetch(`${webserver.origin}/api/v1/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "registration.flow@curso.dev",
        password: TEST_CREDENTIALS.registrationFlow,
      }),
    });
    expect(createSessionResponse.status).toBe(201);

    createSessionResponseBody = await createSessionResponse.json();
    expect(createSessionResponseBody.user_id).toBe(createUserResponseBody.id);
  });

  test("Get user information", async () => {
    const userResponse = await fetch(`${webserver.origin}/api/v1/user`, {
      headers: {
        cookie: `session_id=${createSessionResponseBody.token}`,
      },
    });
    expect(userResponse.status).toBe(200);
    const userResponseBody = await userResponse.json();
    expect(userResponseBody.id).toBe(createUserResponseBody.id);
  });
});
