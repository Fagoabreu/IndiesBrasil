import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import { createAdminUser } from "tests/helpers/testUtils";
import contact from "models/contact";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("DELETE /api/v1/contact-types/[contact_type_id]", () => {
  let createdContactTypeId;

  beforeAll(async () => {
    const createdType = await contact.createType({ icon_key: "Pix", icon_img: "pix" });
    createdContactTypeId = createdType.id;
  });

  test("Anonymous user cannot delete a contact type", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/contact-types/${createdContactTypeId}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
  });

  test("Activated user without read:admin cannot delete a contact type", async () => {
    const ctx = await createActivatedUserWithSession({
      username: "ContatoTipoComumDel",
      email: "contato.tipo.comum.del@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456713,
    });

    const response = await fetch(`${webserver.origin}/api/v1/contact-types/${createdContactTypeId}`, {
      method: "DELETE",
      headers: authHeaders(ctx.sessionToken),
    });
    expect(response.status).toBe(403);
  });

  test("Admin deleting a non-existent contact type returns 500", async () => {
    const admin = await createAdminUser({
      username: "ContatoTipoAdminDel",
      email: "contato.tipo.admin.del@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456714,
    });

    const response = await fetch(`${webserver.origin}/api/v1/contact-types/999999`, {
      method: "DELETE",
      headers: authHeaders(admin.sessionToken),
    });
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.name).toBe("InternalServerError");
  });

  test("Admin can delete a contact type", async () => {
    const admin = await createAdminUser({
      username: "ContatoTipoAdminDelOk",
      email: "contato.tipo.admin.del.ok@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456715,
    });

    const response = await fetch(`${webserver.origin}/api/v1/contact-types/${createdContactTypeId}`, {
      method: "DELETE",
      headers: authHeaders(admin.sessionToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.icon_key).toBe("Pix");
    expect(body.icon_img).toBe("pix");
    expect(body.id).toBe(createdContactTypeId);
  });
});
