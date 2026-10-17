import { isYoutubeShort, normalizeInstagramUrl, youtubeVideoId } from "@/lib/embedLinks";

/**
 * Reconhecimento de links que têm embed próprio.
 *
 * Dois defeitos motivaram o módulo, e os dois apareciam como card quebrado — sem
 * erro no build, no lint ou no log:
 *
 * 1. `youtube.com/live/<id>` (o endereço que a própria página "ao vivo" copia)
 *    não era reconhecido: o link caía em `fetchLinkPreview`, o YouTube não serve
 *    o HTML do vídeo para uma requisição de servidor e o post ficava com um card
 *    de preview **sem imagem**.
 * 2. `/reels/<id>` (o caminho que o app do Instagram compartilha) responde
 *    **404** em `/embed/captioned/`; só `/reel/<id>` responde 200. O embed
 *    recebia um permalink inexistente e o espaço ficava vazio.
 */

describe("lib/embedLinks.js — youtubeVideoId()", () => {
  test("watch?v=", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=K17df81RL9Y")).toBe("K17df81RL9Y");
    expect(youtubeVideoId("https://www.youtube.com/watch?v=K17df81RL9Y&list=RDVHoT4N43jK8&index=3")).toBe("K17df81RL9Y");
  });

  test("youtu.be", () => {
    expect(youtubeVideoId("https://youtu.be/K17df81RL9Y?t=30")).toBe("K17df81RL9Y");
  });

  test("live — o caso do relato", () => {
    expect(youtubeVideoId("https://www.youtube.com/live/nylSK90nI8M?is=zTsTB7X5AE4UrdnU")).toBe("nylSK90nI8M");
    expect(youtubeVideoId("https://youtube.com/live/nylSK90nI8M")).toBe("nylSK90nI8M");
  });

  test("shorts, embed e v", () => {
    expect(youtubeVideoId("https://www.youtube.com/shorts/abc123XYZ")).toBe("abc123XYZ");
    expect(youtubeVideoId("https://www.youtube.com/embed/abc123XYZ")).toBe("abc123XYZ");
    expect(youtubeVideoId("https://www.youtube.com/v/abc123XYZ")).toBe("abc123XYZ");
  });

  test("variações de host", () => {
    expect(youtubeVideoId("https://m.youtube.com/watch?v=K17df81RL9Y")).toBe("K17df81RL9Y");
    expect(youtubeVideoId("https://music.youtube.com/watch?v=K17df81RL9Y")).toBe("K17df81RL9Y");
    expect(youtubeVideoId("http://YOUTUBE.COM/live/nylSK90nI8M")).toBe("nylSK90nI8M");
  });

  test("canal, playlist e busca não são vídeo", () => {
    // Devolver um id aqui faria a página de canal ser desenhada como player.
    expect(youtubeVideoId("https://www.youtube.com/channel/UCabc123")).toBeNull();
    expect(youtubeVideoId("https://www.youtube.com/@algumcanal")).toBeNull();
    expect(youtubeVideoId("https://www.youtube.com/playlist?list=RDVHoT4N43jK8")).toBeNull();
    expect(youtubeVideoId("https://www.youtube.com/results?search_query=jogos")).toBeNull();
  });

  test("outros hosts e entradas inválidas", () => {
    expect(youtubeVideoId("https://vimeo.com/123456")).toBeNull();
    expect(youtubeVideoId("https://notyoutube.com/watch?v=K17df81RL9Y")).toBeNull();
    expect(youtubeVideoId("")).toBeNull();
    expect(youtubeVideoId(undefined)).toBeNull();
    expect(youtubeVideoId("não é url")).toBeNull();
  });
});

describe("lib/embedLinks.js — isYoutubeShort()", () => {
  test("reconhece Short", () => {
    expect(isYoutubeShort("https://www.youtube.com/shorts/abc123XYZ")).toBe(true);
  });

  test("não confunde vídeo comum nem live", () => {
    expect(isYoutubeShort("https://www.youtube.com/watch?v=K17df81RL9Y")).toBe(false);
    expect(isYoutubeShort("https://www.youtube.com/live/nylSK90nI8M")).toBe(false);
    expect(isYoutubeShort(undefined)).toBe(false);
  });
});

describe("lib/embedLinks.js — normalizeInstagramUrl()", () => {
  test("/reels/ vira /reel/ — a forma que responde ao embed", () => {
    expect(normalizeInstagramUrl("https://www.instagram.com/reels/DekdsTQSSLj/")).toBe("https://www.instagram.com/reel/DekdsTQSSLj/");
    expect(normalizeInstagramUrl("https://www.instagram.com/reels/DekdsTQSSLj")).toBe("https://www.instagram.com/reel/DekdsTQSSLj/");
  });

  test("post e IGTV continuam com o próprio caminho", () => {
    expect(normalizeInstagramUrl("https://www.instagram.com/p/Cabc123/")).toBe("https://www.instagram.com/p/Cabc123/");
    expect(normalizeInstagramUrl("https://www.instagram.com/tv/Cabc123/")).toBe("https://www.instagram.com/tv/Cabc123/");
  });

  test("descarta query de rastreio e host sem www", () => {
    expect(normalizeInstagramUrl("https://instagram.com/reels/DekdsTQSSLj/?igsh=abc")).toBe("https://www.instagram.com/reel/DekdsTQSSLj/");
  });

  test("perfil, stories e outros hosts não são publicação", () => {
    expect(normalizeInstagramUrl("https://www.instagram.com/algumperfil/")).toBeNull();
    expect(normalizeInstagramUrl("https://www.instagram.com/stories/algumperfil/123")).toBeNull();
    expect(normalizeInstagramUrl("https://notinstagram.com/reels/DekdsTQSSLj/")).toBeNull();
    expect(normalizeInstagramUrl("")).toBeNull();
  });
});
