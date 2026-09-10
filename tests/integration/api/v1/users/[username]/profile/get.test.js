import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession } from "tests/helpers/storeTestUtils";
import organization from "models/organization";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/users/[username]/profile", () => {
  let owner;
  let member;
  let studio;

  beforeAll(async () => {
    const ctx = await createActivatedUserWithSession({
      username: "ProfileOwner",
      email: "profile.owner@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 48123456701,
    });
    owner = ctx.user;

    const memberCtx = await createActivatedUserWithSession({
      username: "ProfileMember",
      email: "profile.member@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 48123456702,
    });
    member = memberCtx.user;

    studio = await organization.create(owner, { name: "Estúdio do Perfil" });
    const invitation = await organization.createInvitation(studio.id, member.id, owner.id, { role: "member" });
    await organization.respondToInvitation(invitation.id, member.id, true);
  });

  test("Anonymous user can read a public profile", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/profile`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.user).toMatchObject({ username: "ProfileOwner" });
    expect(Array.isArray(body.historico)).toBe(true);
    expect(Array.isArray(body.formacoes)).toBe(true);
    expect(Array.isArray(body.tools)).toBe(true);
    expect(Array.isArray(body.contacts)).toBe(true);
    expect(Array.isArray(body.roles)).toBe(true);
    expect(Array.isArray(body.studios)).toBe(true);
  });

  test("Profile lists the studios the member belongs to", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${member.username}/profile`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.studios).toEqual([
      {
        id: studio.id,
        slug: studio.slug,
        name: "Estúdio do Perfil",
        logo_url: null,
      },
    ]);
  });

  test("Profile lists the studios the owner created", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/profile`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.studios.map((item) => item.slug)).toEqual([studio.slug]);
  });

  test("Unknown username returns 404", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/UsuarioInexistente/profile`);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body).toEqual({
      name: "NotFoundError",
      message: "O username informado não foi encontrado no sistema.",
      action: "Verifique se o username foi digitado corretamente",
      status_code: 404,
    });
  });
});
