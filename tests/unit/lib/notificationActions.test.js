import {
  isOrgNotification,
  isPostNotification,
  isUnread,
  markAllNotificationsRead,
  markNotificationRead,
  notificationKey,
} from "@/lib/notificationActions";

/**
 * Classificação e destino das notificações.
 *
 * A interface depende destas funções para decidir **o que mostrar** (não lida) e
 * **para onde mandar o PATCH**. Errar o endpoint fazia a marcação falhar — e,
 * antes, falhar em silêncio: o item ficava "lido" na tela, o PATCH não acontecia
 * e a notificação voltava como não lida na próxima abertura.
 */

const personal = { user_id: "u1", type: "new_follower", source_user_id: "u2", org_slug: "", is_read: false };
const message = { user_id: "u1", type: "new_message", source_user_id: "u2", org_slug: "estudio", is_read: false };
const post = { user_id: "u1", type: "post_liked", source_user_id: "u2", org_slug: "", post_id: 42, is_read: true };
const org = { id: "n1", type: "org_post_liked", resource_type: "post", resource_id: "9", is_read: false };

describe("classificação", () => {
  test("do estúdio se identifica por resource_type, não por org_slug", () => {
    expect(isOrgNotification(org)).toBe(true);

    // `new_message` e `studio_invitation` também preenchem `org_slug`; usar esse
    // campo mandaria o PATCH para a rota do estúdio e a marcação falharia.
    expect(isOrgNotification(message)).toBe(false);
    expect(isOrgNotification(personal)).toBe(false);
  });

  test("de post exige post_id e não ser do estúdio", () => {
    expect(isPostNotification(post)).toBe(true);
    expect(isPostNotification(personal)).toBe(false);
    expect(isPostNotification(message)).toBe(false);
    expect(isPostNotification(org)).toBe(false);
  });

  test("isUnread lê is_read das três origens", () => {
    expect(isUnread(personal)).toBe(true);
    expect(isUnread(org)).toBe(true);
    expect(isUnread(post)).toBe(false);
    expect(isUnread(null)).toBe(true);
  });
});

describe("notificationKey", () => {
  test("distingue as três formas sem colidir", () => {
    const keys = [personal, message, post, org].map(notificationKey);
    expect(new Set(keys).size).toBe(4);
  });

  test("do estúdio usa o id", () => {
    expect(notificationKey(org)).toBe("org:n1");
  });

  test("pessoal inclui org_slug — notificações de estúdios diferentes não colidem", () => {
    const a = { ...message, org_slug: "estudio-a" };
    const b = { ...message, org_slug: "estudio-b" };
    expect(notificationKey(a)).not.toBe(notificationKey(b));
  });

  test("de post inclui post_id", () => {
    expect(notificationKey(post)).toContain("42");
    expect(notificationKey({ ...post, post_id: 43 })).not.toBe(notificationKey(post));
  });

  test("linha nula não quebra", () => {
    expect(notificationKey(null)).toBe("");
  });
});

describe("markNotificationRead", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("cada forma usa o endpoint certo", async () => {
    const calls = [];
    global.fetch = jest.fn(async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return { ok: true };
    });

    await markNotificationRead("eu", personal);
    await markNotificationRead("eu", post);
    await markNotificationRead("eu", org);

    expect(calls[0].url).toBe("/api/v1/users/eu/notifications");
    expect(calls[0].body).toMatchObject({ user_id: "u1", type: "new_follower", is_read: true });

    expect(calls[1].url).toBe("/api/v1/users/eu/notifications/post");
    expect(calls[1].body.post_id).toBe(42);

    expect(calls[2].url).toBe("/api/v1/users/eu/notifications/org");
    expect(calls[2].body).toEqual({ notification_id: "n1" });
  });

  test("username é escapado na URL", async () => {
    global.fetch = jest.fn(async () => ({ ok: true }));
    await markNotificationRead("nome com espaço", personal);

    expect(global.fetch.mock.calls[0][0]).toContain("nome%20com%20espa%C3%A7o");
  });

  test("resposta !ok vira erro — não é engolida", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({ message: "Sem permissão." }) }));

    await expect(markNotificationRead("eu", personal)).rejects.toThrow("Sem permissão.");
  });

  test("falha sem corpo ainda vira erro legível", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      json: async () => {
        throw new Error("corpo vazio");
      },
    }));

    await expect(markNotificationRead("eu", personal)).rejects.toThrow("Não foi possível marcar");
  });
});

describe("markAllNotificationsRead", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("marca só as não lidas", async () => {
    global.fetch = jest.fn(async () => ({ ok: true }));

    const failed = await markAllNotificationsRead("eu", [personal, post, org]);

    expect(failed).toEqual([]);
    // `post` já está lida: duas chamadas, não três.
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("devolve as que falharam e não impede as outras", async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      return calls === 1 ? { ok: false, json: async () => ({ message: "x" }) } : { ok: true };
    });

    const failed = await markAllNotificationsRead("eu", [personal, org]);

    expect(failed).toHaveLength(1);
    expect(failed[0]).toBe(personal);
  });

  test("lista vazia não chama o servidor", async () => {
    global.fetch = jest.fn();
    expect(await markAllNotificationsRead("eu", [post])).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
