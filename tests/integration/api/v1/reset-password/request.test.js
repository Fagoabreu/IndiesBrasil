import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession } from "tests/helpers/storeTestUtils";

const CPF = "80123456701";
const EMAIL = "reset.senha@teste.dev";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("POST /api/v1/reset-password/request", () => {
  beforeAll(async () => {
    await createActivatedUserWithSession({
      username: "ResetSenha",
      email: EMAIL,
      password: TEST_CREDENTIALS.userDefault,
      cpf: Number(CPF),
    });
  });

  test("Valid email + CPF returns generic success and sends email", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/reset-password/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: EMAIL, cpf: CPF }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      message: "Se o email cadastrado existir junto ao CPF, enviaremos instruções.",
    });

    const email = await orchestrator.getLastEmail();
    expect(email).not.toBeNull();
    expect(email.text).toContain("ResetSenha");
  });

  test("Unknown email still returns generic success without sending email", async () => {
    await orchestrator.deleteAllEmails();

    const response = await fetch(`${webserver.origin}/api/v1/reset-password/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nao.existe@teste.dev", cpf: CPF }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.message).toBe("Se o email cadastrado existir junto ao CPF, enviaremos instruções.");

    const email = await orchestrator.getLastEmail();
    expect(email).toBeNull();
  });

  test("Mismatched CPF still returns generic success without sending email", async () => {
    await orchestrator.deleteAllEmails();

    const response = await fetch(`${webserver.origin}/api/v1/reset-password/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: EMAIL, cpf: "99999999999" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.message).toBe("Se o email cadastrado existir junto ao CPF, enviaremos instruções.");

    const email = await orchestrator.getLastEmail();
    expect(email).toBeNull();
  });
});
