import embededResolver from "@/infra/embededResolver";

/**
 * Resolução dos embeds de post — o caminho que respondia 500.
 *
 * `POST /api/v1/posts` chama `getEmbededLinks` antes de gravar. Quando
 * `NEXT_PUBLIC_BASE_URL` valia `localhost` (o padrão de `.env.development`,
 * **sem esquema**), `resolveTwitch` fazia `new URL("localhost")`, que lança
 * `TypeError: Invalid URL`; a rota não tratava e devolvia 500. Um post com
 * YouTube e Instagram funcionava, o mesmo post com Twitch não — e a mensagem
 * que chegava na tela era "Um erro interno não esperado aconteceu".
 *
 * Só as plataformas resolvidas localmente entram aqui: as que buscam HTML
 * (`preview`, Steam, itch.io) dependeriam de rede e o teste mediria a internet,
 * não o parser.
 */

describe("infra/embededResolver — embeds de post", () => {
  const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  afterEach(() => {
    if (originalBaseUrl === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
    else process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl;
  });

  test("link da Twitch não lança quando a configuração vem sem esquema", async () => {
    process.env.NEXT_PUBLIC_BASE_URL = "localhost";

    const embeds = await embededResolver.getEmbededLinks("https://www.twitch.tv/cooruja");

    expect(embeds).toHaveLength(1);
    expect(embeds[0]).toMatchObject({ type: "twitch", subtype: "channel", channel: "cooruja" });
    expect(embeds[0].embedUrl).toBe("https://player.twitch.tv/?channel=cooruja&parent=localhost");
  });

  test("o `parent` nunca carrega esquema nem porta", async () => {
    process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3001";

    const [embed] = await embededResolver.getEmbededLinks("https://www.twitch.tv/videos/123456");

    // `parent=http://localhost:3001` é embed recusado pela Twitch.
    expect(embed.embedUrl).toBe("https://player.twitch.tv/?video=123456&parent=localhost");
  });

  test("a postagem do relato resolve os três links", async () => {
    process.env.NEXT_PUBLIC_BASE_URL = "localhost";

    const content = [
      "https://www.youtube.com/watch?v=K17df81RL9Y&list=RDVHoT4N43jK8&index=3",
      "https://www.twitch.tv/cooruja",
      "https://www.instagram.com/reels/DekdsTQSSLj",
    ].join("\n");

    const embeds = await embededResolver.getEmbededLinks(content);

    expect(embeds.map((embed) => embed.type)).toEqual(["youtube", "twitch", "instagram"]);
    expect(embeds[0].embedUrl).toBe("https://www.youtube.com/embed/K17df81RL9Y");
    // O permalink gravado precisa ser o que responde ao embed — `/reels/`
    // devolve 404 em `/embed/captioned/`.
    expect(embeds[2].url).toBe("https://www.instagram.com/reel/DekdsTQSSLj/");
  });

  test("link de transmissão ao vivo do YouTube vira player, não preview vazio", async () => {
    const [embed] = await embededResolver.getEmbededLinks("https://www.youtube.com/live/nylSK90nI8M?is=zTsTB7X5AE4UrdnU");

    expect(embed).toMatchObject({ type: "youtube", subtype: "video", videoId: "nylSK90nI8M" });
    expect(embed.embedUrl).toBe("https://www.youtube.com/embed/nylSK90nI8M");
  });

  test("canal do YouTube não vira player — precisa do preview com imagem", async () => {
    // Sem isso o embed era `null` e o post ficava com um card vazio: nada de
    // título nem miniatura.
    const [embed] = await embededResolver.getEmbededLinks("https://www.youtube.com/@algumcanal");

    expect(embed.type).not.toBe("youtube");
  });
});
