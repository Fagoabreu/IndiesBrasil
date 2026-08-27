import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import notification from "models/notification";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET/PATCH /api/v1/users/[username]/notifications", () => {
  let owner;
  let ownerToken;
  let other;
  let otherToken;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoNotif",
      email: "dono.notif@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 61123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroNotif",
      email: "outro.notif@curso.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 61123456702,
    });
    other = otherCtx.user;
    otherToken = otherCtx.sessionToken;
  });

  test("Anonymous user cannot read another user's notifications", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/notifications`);
    expect(response.status).toBe(403);
  });

  test("Another user cannot read notifications", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/notifications`, {
      headers: authHeaders(otherToken),
    });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Owner can read their own (empty) notifications", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/notifications`, {
      headers: authHeaders(ownerToken),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test("Owner can mark a notification as read", async () => {
    await notification.createUserNotification({
      user_id: owner.id,
      type: "new_follower",
      source_user_id: other.id,
    });

    const response = await fetch(`${webserver.origin}/api/v1/users/${owner.username}/notifications`, {
      method: "PATCH",
      headers: { ...authHeaders(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({
        user_id: owner.id,
        type: "new_follower",
        source_user_id: other.id,
        is_read: true,
      }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({ type: "new_follower", is_read: true });
  });
});
