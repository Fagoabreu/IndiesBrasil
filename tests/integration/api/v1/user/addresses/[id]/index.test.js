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

describe("PATCH/DELETE /api/v1/user/addresses/[id]", () => {
  let ownerToken;
  let otherToken;
  let addressId;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoEndereco",
      email: "dono.endereco@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 54123456701,
    });
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroEndereco",
      email: "outro.endereco@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 54123456702,
    });
    otherToken = otherCtx.sessionToken;

    const postResponse = await fetch(`${webserver.origin}/api/v1/user/addresses`, {
      method: "POST",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({
        street: "Rua das Flores",
        number: "100",
        city: "São Paulo",
        state: "SP",
        zip_code: "01001-000",
      }),
    });
    if (postResponse.status !== 201) {
      throw new Error(`Setup falhou com status ${postResponse.status}`);
    }
    const createdBody = await postResponse.json();
    addressId = createdBody.address_id;
  });

  test("Anonymous user cannot patch an address", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/user/addresses/${addressId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ city: "Rio de Janeiro" }),
    });
    expect(response.status).toBe(403);
  });

  test("Another user cannot patch an address they do not own", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/user/addresses/${addressId}`, {
      method: "PATCH",
      headers: { ...authHeaders(otherToken), "content-type": "application/json" },
      body: JSON.stringify({ city: "Rio de Janeiro" }),
    });
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });

  test("Owner can patch an address", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/user/addresses/${addressId}`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ city: "Rio de Janeiro", state: "RJ" }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      city: "Rio de Janeiro",
      state: "RJ",
    });
  });

  test("Anonymous user cannot delete an address", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/user/addresses/${addressId}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Another user cannot delete an address they do not own", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/user/addresses/${addressId}`, {
      method: "DELETE",
      headers: authHeaders(otherToken),
    });
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });

  test("Owner can delete an address", async () => {
    const deleteResponse = await fetch(`${webserver.origin}/api/v1/user/addresses/${addressId}`, {
      method: "DELETE",
      headers: authHeaders(ownerToken),
    });
    expect(deleteResponse.status).toBe(200);

    const listResponse = await fetch(`${webserver.origin}/api/v1/user/addresses`, {
      headers: authHeaders(ownerToken),
    });
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual([]);
  });
});
