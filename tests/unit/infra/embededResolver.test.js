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
  });
});
