import {
  resolveOrgNotificationHref,
  resolveOrgNotificationMessage,
  resolveOrgNotificationTitle,
  resolveUserNotificationHref,
} from "@/lib/notifications";

/**
 * O link de cada notificação de estúdio.
 *
 * Estes endereços são o único caminho entre o sino e o conteúdo: um `href`
 * errado não aparece em nenhum log — a pessoa clica e cai na página errada (ou
 * em nenhuma). O caso da reunião nasceu de um relato real: o aviso de "Reunião
 * agendada" levava à lista de reuniões do estúdio, sem indicar qual delas era a
 * nova.
 */

const base = {
  id: 1,
  org_slug: "estudio-exemplo",
  org_name: "Estúdio Exemplo",
  source_username: "ana",
  created_at: "2026-10-27T12:00:00.000Z",
};

describe("resolveOrgNotificationHref — reuniões", () => {
  test("Leva à página de reuniões do estúdio já apontando para a reunião", () => {
    const href = resolveOrgNotificationHref({
      ...base,
      type: "org_meeting_scheduled",
      resource_type: "meeting",
      resource_id: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
      subject_title: "Reunião semanal",
    });

    expect(href).toBe("/estudios/estudio-exemplo/reunioes?meeting=1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed");
  });

  test("Sem `resource_id` cai na lista — link quebrado é pior que link genérico", () => {
    const href = resolveOrgNotificationHref({
      ...base,
      type: "org_meeting_scheduled",
      resource_type: "meeting",
      resource_id: null,
    });

    expect(href).toBe("/estudios/estudio-exemplo/reunioes");
  });

  test("O estúdio do link é o do aviso, não um fixo", () => {
    const href = resolveOrgNotificationHref({
      ...base,
      org_slug: "outro-estudio",
      type: "org_meeting_scheduled",
      resource_id: "abc",
    });

    expect(href).toBe("/estudios/outro-estudio/reunioes?meeting=abc");
  });
});

describe("resolveOrgNotificationHref — demais tipos", () => {
  test.each([
    ["org_post_liked", { resource_id: "42" }, "/posts/42"],
    ["org_post_commented", { resource_id: "42" }, "/posts/42"],
    ["org_game_reviewed", { resource_id: "meu-jogo" }, "/jogos/meu-jogo"],
    ["org_boardgame_liked", { resource_id: "minha-mesa" }, "/jogos-de-mesa/minha-mesa"],
    ["org_book_commented", { resource_id: "meu-quadrinho" }, "/quadrinhos/meu-quadrinho"],
    ["org_asset_reviewed", { resource_id: "meu-asset" }, "/assets/meu-asset"],
    ["org_order_received", { resource_id: "7" }, "/estudios/estudio-exemplo/pedidos"],
    ["org_order_updated", { resource_id: "7" }, "/estudios/estudio-exemplo/pedidos"],
  ])("%s", (type, extra, expected) => {
    expect(resolveOrgNotificationHref({ ...base, type, ...extra })).toBe(expected);
  });

  test("Mensagem abre a conversa na aba de mensagens do estúdio", () => {
    const href = resolveOrgNotificationHref({ ...base, type: "new_message", resource_id: "conv-1" });
    expect(href).toBe("/estudios/estudio-exemplo/?tab=mensagens&conversa=conv-1");
  });

  test("Tipo desconhecido não inventa destino", () => {
    expect(resolveOrgNotificationHref({ ...base, type: "tipo_que_nao_existe" })).toBeNull();
  });
});

describe("resolveUserNotificationHref — notificações pessoais", () => {
  test.each([
    ["studio_invitation", { org_slug: "estudio-x" }, "/estudios/estudio-x"],
    ["post_liked", { post_id: 7 }, "/posts/7"],
    ["post_commented", { post_id: 7 }, "/posts/7"],
    ["new_follower", { source_username: "ana" }, "/perfil/ana"],
    ["new_message", {}, "/perfil/eu?tab=mensagens"],
  ])("%s", (type, extra, expected) => {
    expect(resolveUserNotificationHref({ type, ...extra }, "eu")).toBe(expected);
  });

  test("Sem os dados do alvo o item não é clicável", () => {
    expect(resolveUserNotificationHref({ type: "studio_invitation" }, "eu")).toBeNull();
    expect(resolveUserNotificationHref({ type: "post_liked" }, "eu")).toBeNull();
    expect(resolveUserNotificationHref({ type: "new_follower" }, "eu")).toBeNull();
    expect(resolveUserNotificationHref({ type: "tipo_novo" }, "eu")).toBeNull();
  });

  test("Mensagem abre a caixa de quem recebeu, não o perfil do remetente", () => {
    // A caixa é privada; `source_username` aqui é isca para um destino errado.
    const href = resolveUserNotificationHref({ type: "new_message", source_username: "quem-escreveu" }, "eu");
    expect(href).toBe("/perfil/eu?tab=mensagens");
  });
});

describe("Título e mensagem da reunião", () => {
  const notification = {
    ...base,
    type: "org_meeting_scheduled",
    subject_title: "Reunião semanal",
  };

  test("A mensagem cita quem agendou, o assunto e o estúdio", () => {
    expect(resolveOrgNotificationTitle(notification)).toBe("Reunião agendada");
    expect(resolveOrgNotificationMessage(notification)).toBe('@ana agendou "Reunião semanal" no estúdio Estúdio Exemplo.');
  });

  test("Campos ausentes caem em texto neutro, sem 'undefined' na tela", () => {
    const message = resolveOrgNotificationMessage({ type: "org_meeting_scheduled" });

    expect(message).toContain("@alguém");
    expect(message).toContain("estúdio estúdio");
    expect(message).not.toContain("undefined");
  });
});
