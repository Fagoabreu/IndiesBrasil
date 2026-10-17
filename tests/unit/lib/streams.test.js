import {
  STREAM_THUMBNAIL_SIZE,
  formatCheckedAt,
  formatViewerCount,
  getEmbedUrl,
  getPlatform,
  getPlatformLabel,
  getWatchUrl,
  listStudioChannels,
  resolvePlatformId,
  twitchThumbnailUrl,
} from "@/lib/streams";

/**
 * O registro de plataformas é a tradução entre o canal que o estúdio cadastrou e
 * o que a tela mostra (rótulo, link público, player embutido). Ele é o que a
 * listagem e a página de assistir consultam juntas, então os casos aqui são os
 * que, errados, apareceriam nas duas telas de uma vez: o `parent` do player da
 * Twitch (host de quem renderiza), o canal offline (o YouTube não embute) e o
 * estúdio com os dois canais cadastrados (preferência pela Twitch).
 */

const twitchStudio = {
  twitch_channel: "indiesbrasil",
  youtube_channel_id: null,
  active_platform: null,
  is_live: false,
};

const youtubeStudio = {
  twitch_channel: null,
  youtube_channel_id: "UCabc123",
  active_platform: null,
  is_live: false,
};

const bothChannels = { ...twitchStudio, youtube_channel_id: "UCabc123" };

describe("lib/streams", () => {
  test("resolve a plataforma ao vivo, e o canal cadastrado quando não há transmissão", () => {
    expect(resolvePlatformId({ ...twitchStudio, is_live: true, active_platform: "twitch" })).toBe("twitch");
    expect(resolvePlatformId({ ...youtubeStudio, is_live: true, active_platform: "youtube" })).toBe("youtube");
    // Offline o `active_platform` da rota é nulo: sobra o canal cadastrado.
    expect(resolvePlatformId(bothChannels)).toBe("twitch");
    expect(resolvePlatformId(youtubeStudio)).toBe("youtube");
    expect(resolvePlatformId({ twitch_channel: null, youtube_channel_id: null })).toBeNull();
  });

  test("linka e rotula a plataforma resolvida", () => {
    expect(getWatchUrl(twitchStudio)).toBe("https://www.twitch.tv/indiesbrasil");
    expect(getWatchUrl(youtubeStudio)).toBe("https://www.youtube.com/channel/UCabc123");
    expect(getPlatformLabel(bothChannels)).toBe("Twitch");
    expect(getPlatform("kick")).toBeNull();
  });

  test("lista os canais cadastrados, Twitch antes de YouTube", () => {
    expect(listStudioChannels(bothChannels).map((channel) => channel.label)).toEqual(["Twitch", "YouTube"]);
    expect(listStudioChannels(youtubeStudio)).toEqual([{ id: "youtube", label: "YouTube", url: "https://www.youtube.com/channel/UCabc123" }]);
  });

  test("o player da Twitch abre o canal mesmo offline e usa o host de quem renderiza", () => {
    const url = getEmbedUrl(twitchStudio, "exemplo.com.br");

    expect(url).toContain("channel=indiesbrasil");
    expect(url).toContain("parent=exemplo.com.br");
  });

  test("o player do YouTube só entra com a transmissão no ar", () => {
    expect(getEmbedUrl(youtubeStudio, "exemplo.com.br")).toBeNull();
    expect(getEmbedUrl({ ...youtubeStudio, is_live: true, active_platform: "youtube" }, "exemplo.com.br")).toContain(
      "youtube.com/embed/live_stream?channel=UCabc123",
    );
  });

  test("audiência e horário da verificação", () => {
    expect(formatViewerCount(0)).toBeNull();
    expect(formatViewerCount(999)).toBe("999");
    expect(formatViewerCount(1000)).toBe("1.0k");
    expect(formatViewerCount(42546)).toBe("42.5k");
    expect(formatCheckedAt(null)).toBeNull();
    expect(formatCheckedAt("2026-10-16T21:35:00.000Z")).toBe("16/10, 18:35");
  });

  test("miniatura da Twitch no tamanho declarado no og:image", () => {
    const url = twitchThumbnailUrl("https://static-cdn.jtvnw.net/thumb-{width}x{height}.jpg");

    expect(url).toBe(`https://static-cdn.jtvnw.net/thumb-${STREAM_THUMBNAIL_SIZE.width}x${STREAM_THUMBNAIL_SIZE.height}.jpg`);
    expect(twitchThumbnailUrl(null)).toBeNull();
  });
});
