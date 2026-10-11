import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import game from "models/game";
import boardgame from "models/boardgame";
import book from "models/book";
import course from "models/course";
import news from "models/news";
import contentReview from "models/content-review";
import event from "models/event";
import moderation from "models/moderation";

/**
 * Cria um exemplar de cada tipo de conteúdo com endereço próprio.
 *
 * Os testes de SEO (`tests/integration/pages/`) precisam dos sete tipos no
 * banco para conferir que cada um é alcançável — e a preparação é idêntica nos
 * dois: sete `create`, um bloqueio de moderação e os identificadores de volta.
 * Deixar isso em cada arquivo faria os dois divergirem no primeiro tipo novo.
 *
 * Devolve também `blockedGameSlug`: um jogo bloqueado precisa **não** aparecer
 * nem no sitemap nem nos links da listagem. É o caso mais fácil de quebrar sem
 * que ninguém note, porque um teste que só confere presença passa com o
 * conteúdo bloqueado publicado.
 *
 * Cria também eventos em visibilidades diferentes (público, `members`,
 * `private` e rascunho). Mesma razão: o sitemap da agenda **tem** de filtrar
 * por visibilidade e status, e um teste que só confere presença passa com o
 * evento público convivendo com o privado publicado.
 */
export async function createSeoFixtures() {
  const { user } = await createActivatedUserWithSession({
    username: "AutorSitemap",
    email: "autor.sitemap@teste.dev",
    password: TEST_CREDENTIALS.userDefault,
    cpf: 90123456705,
  });

  const studio = await organization.create(user, { name: "Estúdio Sitemap" });

  const gameRow = await game.create(studio.id, user.id, { name: "Jogo Sitemap", genre: "Aventura", stage: "released" });

  const boardgameRow = await boardgame.create(user.id, studio.id, { name: "Jogo de Mesa Sitemap", stage: "released" });

  const bookRow = await book.create(user.id, studio.id, { title: "Livro Sitemap" });

  const courseRow = await course.create(user.id, { title: "Curso Sitemap" });

  const newsRow = await news.create({
    author_id: user.id,
    title: "Notícia Sitemap",
    summary: "Resumo da notícia de teste.",
    body: "Corpo da notícia de teste.",
  });

  const analiseRow = await contentReview.create({
    title: "Análise Sitemap",
    authorId: user.id,
    contentType: "game",
    contentId: gameRow.id,
    rating: 5,
  });

  const blockedGame = await game.create(studio.id, user.id, { name: "Jogo Bloqueado Sitemap", stage: "released" });
  await moderation.createBlock({
    targetType: "game",
    targetId: blockedGame.id,
    reason: "violacao_termos",
    moderatorId: user.id,
  });

  // Datas no futuro: o detalhe do evento não depende disso, mas um evento já
  // terminado misturaria o teste com a regra de janela do calendário.
  const inDays = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const publicEvent = await event.create(
    {
      title: "Evento Sitemap Público",
      description: "Evento aberto a qualquer visitante.",
      starts_at: inDays(5),
      ends_at: inDays(6),
      visibility: "public",
      status: "published",
    },
    user.id,
  );

  const privateEvent = await event.create(
    { title: "Evento Sitemap Privado", starts_at: inDays(7), ends_at: inDays(8), visibility: "private", status: "published" },
    user.id,
  );

  const membersEvent = await event.create(
    { title: "Evento Sitemap Membros", starts_at: inDays(9), ends_at: inDays(10), visibility: "members", status: "published" },
    user.id,
  );

  const draftEvent = await event.create(
    { title: "Evento Sitemap Rascunho", starts_at: inDays(11), ends_at: inDays(12), visibility: "public", status: "draft" },
    user.id,
  );

  return {
    user,
    studio,
    gameRow,
    boardgameSlug: boardgameRow.slug,
    bookSlug: bookRow.slug,
    courseSlug: courseRow.slug,
    newsId: newsRow.id,
    analiseSlug: analiseRow.slug,
    publicEventId: publicEvent.id,
    privateEventId: privateEvent.id,
    membersEventId: membersEvent.id,
    draftEventId: draftEvent.id,
    blockedGameSlug: blockedGame.slug,
  };
}

/**
 * Cada hub e as entidades que ele precisa linkar.
 *
 * Fica aqui, e não dentro de um teste, porque é a lista dos tipos de conteúdo
 * do site — o sitemap (`lib/sitemap.js`) e as listagens precisam cobrir
 * exatamente os mesmos.
 *
 * A agenda **não** entra: o calendário é uma visão de mês (o mês é estado da
 * tela, não endereço), então o HTML de `/agenda` não lista os eventos — quem os
 * publica é o sitemap.
 */
export function hubLinks(fixtures) {
  return {
    "/estudios": `/estudios/${fixtures.studio.slug}`,
    "/jogos": `/jogos/${fixtures.gameRow.slug}`,
    "/jogos-de-mesa": `/jogos-de-mesa/${fixtures.boardgameSlug}`,
    "/quadrinhos": `/quadrinhos/${fixtures.bookSlug}`,
    "/estudos": `/estudos/${fixtures.courseSlug}`,
    "/noticias": `/noticias/${fixtures.newsId}`,
    "/analises": `/analises/${fixtures.analiseSlug}`,
  };
}
