import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

// Este endpoint chama a API externa paga da NFe.io (`naturalperson.api.nfe.io`).
// Como os testes de integração rodam contra o servidor Next.js em processo
// separado, `jest.spyOn(globalThis, "fetch")` não intercepta o `fetch` do
// servidor. Portanto cobrimos apenas a validação de entrada, determinística:
// método não-POST (405) e CPF ausente (400). Os ramos de sucesso/erro do
// upstream dependem de rede externa + API key e não são cobertos aqui.

describe("POST /api/v1/apicheck/check-cpf", () => {
  test("Non-POST method returns 405", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/apicheck/check-cpf`);
    expect(response.status).toBe(405);

    const body = await response.json();
    expect(body.error).toBe("Method not allowed");
  });

  test("Missing cpf returns 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/apicheck/check-cpf`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("CPF required");
  });
});
