import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import moderation from "models/moderation";
import { SITE_URL } from "@/lib/seo";

/**
 * A listagem de streams precisa **linkar** a página de assistir no HTML que sai
 * do servidor, e a página de assistir precisa montar o player nela mesma.
 *
 * Sem isso o canal só existiria depois de JavaScript: a listagem era `"use
 * client"` com busca em `useEffect` (o HTML servido era o spinner) e o player
 * era um `<iframe>` montado no clique — nem o Google nem um preview de link
 * chegavam à página de assistir. É regressão silenciosa: o site continua
 * funcionando perfeitamente no navegador.
 */

const origin = webserver.origin;

async function fetchHtml(path) {
  const response = await fetch(`${origin}${path}`);
  return { response, html: await response.text() };
}

describe("Páginas de streams (HTML servido)", () => {
  let studio;

  beforeAll(async () => {
    await orchestrator.waitForAllServices();
    await orchestrator.clearDatabase();
    await orchestrator.runPendingMigrations();
    await orchestrator.deleteAllEmails();

    const { user } = await createActivatedUserWithSession({
      username: "EstudioAoVivo",
      email: "estudio.ao.vivo@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 90123456799,
    });

    studio = await organization.create(user, { name: "Estúdio Ao Vivo", pitch: "Fazemos jogos e streams." });
    await organization.update(studio.slug, { twitch_channel: "indiesbrasil" });
  });

  test("A listagem linka a página de assistir", async () => {
    const { response, html } = await fetchHtml("/streams");

    expect(response.status).toBe(200);
    expect(html).toContain(`href="/streams/${studio.slug}"`);
  });

  test("A página de assistir traz o player e o canal no HTML", async () => {
    const { response, html } = await fetchHtml(`/streams/${studio.slug}`);

    expect(response.status).toBe(200);
    // O canal está offline (não há status cacheado), mas o player da Twitch abre
    // o canal de qualquer forma — é o estado offline da própria Twitch.
    expect(html).toContain("Estúdio Ao Vivo");
    expect(html).toContain("player.twitch.tv/?channel=indiesbrasil");
    expect(html).toContain("https://www.twitch.tv/indiesbrasil");
    expect(html).toContain(`rel="canonical" href="${SITE_URL}/streams/${studio.slug}"`);
  });

  test("Slug desconhecido responde 404", async () => {
    const { response } = await fetchHtml("/streams/estudio-que-nao-existe");

    expect(response.status).toBe(404);
  });

  test("Canal sem player embutido mostra o estado offline e o link da plataforma", async () => {
    const { user } = await createActivatedUserWithSession({
      username: "EstudioSoYoutube",
      email: "estudio.so.youtube@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 90123456797,
    });

    const youtubeStudio = await organization.create(user, { name: "Estúdio Só YouTube" });
    await organization.update(youtubeStudio.slug, { youtube_channel_id: "UCabc123" });

    const { response, html } = await fetchHtml(`/streams/${youtubeStudio.slug}`);

    expect(response.status).toBe(200);
    // `embed/live_stream` só existe com transmissão no ar: offline a página
    // mostra o aviso e o caminho para o canal, em vez de um iframe vazio.
    expect(html).not.toContain("youtube.com/embed/live_stream");
    expect(html).toContain("está offline agora");
    expect(html).toContain("https://www.youtube.com/channel/UCabc123");
  });

  test("Estúdio bloqueado sai da listagem e não tem página de assistir", async () => {
    const { user } = await createActivatedUserWithSession({
      username: "ModeradorStreams",
      email: "moderador.streams@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 90123456798,
    });

    await moderation.createBlock({
      targetType: "studio",
      targetId: studio.id,
      reason: "violacao_termos",
      moderatorId: user.id,
    });

    const listing = await fetchHtml("/streams");
    expect(listing.html).not.toContain(`href="/streams/${studio.slug}"`);

    const detail = await fetchHtml(`/streams/${studio.slug}`);
    expect(detail.response.status).toBe(404);
  });
});
