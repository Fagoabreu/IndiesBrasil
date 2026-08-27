import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET/POST /api/v1/user/addresses", () => {
  let ownerToken;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoEnderecos",
      email: "dono.enderecos@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 53123456701,
    });
    ownerToken = ownerCtx.sessionToken;
  });

  test("Anonymous user cannot read addresses", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/user/addresses`);
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Owner can read an empty address list", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/user/addresses`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test("Anonymous user cannot create an address", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/user/addresses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        street: "Rua das Flores",
        number: "100",
        city: "São Paulo",
        state: "SP",
        zip_code: "01001-000",
      }),
    });
    expect(response.status).toBe(403);
  });

  test("Owner can create an address and it becomes default", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/user/addresses`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({
        street: "Rua das Flores",
        number: "100",
        complement: "Apto 2",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
        zip_code: "01001-000",
      }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body).toMatchObject({
      street: "Rua das Flores",
      number: "100",
      complement: "Apto 2",
      neighborhood: "Centro",
      city: "São Paulo",
      state: "SP",
      zip_code: "01001000",
      country: "Brasil",
      is_default: true,
      label: null,
    });
    expect(body.address_id).toBeTruthy();
    expect(body.user_address_id).toBeTruthy();
  });

  test("A second address is not the default", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/user/addresses`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({
        street: "Avenida Paulista",
        number: "1000",
        city: "São Paulo",
        state: "SP",
        zip_code: "01310-100",
      }),
    });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.is_default).toBe(false);
    expect(body.city).toBe("São Paulo");
    expect(body.zip_code).toBe("01310100");
  });

  test("Owner cannot create an address without a city", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/user/addresses`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ state: "SP" }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Owner cannot create an address without a state", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/user/addresses`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ city: "São Paulo" }),
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.name).toBe("ValidationError");
  });

  test("Owner can list created addresses with default first", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/user/addresses`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(2);
    expect(body[0].is_default).toBe(true);
    expect(body[1].is_default).toBe(false);
  });
});
