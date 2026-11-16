import { getAboutDoc, aboutDocPaths, resolveDocLinks, stripDocTitle, ABOUT_DOCS, ABOUT_DOC_SLUGS } from "@/lib/aboutDocs";

/**
 * `lib/aboutDocs.js` decide duas coisas que já quebraram em outro lugar do site
 * e não dão erro nenhum quando quebram:
 *
 *  - link `.md` servido como rota do site (404 com cara de link quebrado);
 *  - título do documento duplicado no `<h1>` (o cabeçalho da página já o mostra).
 *
 * As duas são transformação de string, então o teste é barato — e é o que
 * impede alguém de "simplificar" a regex e reintroduzir o problema.
 */
describe("lib/aboutDocs", () => {
  describe("getAboutDoc", () => {
    test("encontra um documento publicado", () => {
      expect(getAboutDoc("roadmap")).toMatchObject({ slug: "roadmap", file: "roadmap.md" });
    });

    test("devolve null em vez de lançar para slug desconhecido", () => {
      // É este `null` que vira `notFound` na página. Um `throw` transformaria
      // URL errada em 500.
      expect(getAboutDoc("naoexiste")).toBeNull();
      expect(getAboutDoc("../.env")).toBeNull();
      expect(getAboutDoc(undefined)).toBeNull();
      expect(getAboutDoc(["roadmap"])).toBeNull();
    });

    test("o slug nunca é montado em caminho de arquivo", () => {
      // A allowlist é a defesa contra ler arquivo fora de `docs/`: o valor
      // recebido é PROCURADO, não concatenado.
      expect(getAboutDoc("../../.env")).toBeNull();
      expect(ABOUT_DOCS.every((doc) => doc.file.endsWith(".md"))).toBe(true);
      expect(ABOUT_DOCS.every((doc) => !doc.file.includes("/") && !doc.file.includes(".."))).toBe(true);
    });
  });

  describe("aboutDocPaths", () => {
    test("um caminho por documento, no formato do getStaticPaths", () => {
      const paths = aboutDocPaths();

      expect(paths).toHaveLength(ABOUT_DOCS.length);
      expect(paths[0]).toEqual({ params: { slug: ABOUT_DOC_SLUGS[0] } });
    });
  });

  describe("resolveDocLinks", () => {
    test("documento publicado vira a rota /sobre", () => {
      expect(resolveDocLinks('<p><a href="./funcionalidades.md">Funcionalidades</a></p>')).toBe(
        '<p><a href="/sobre/funcionalidades">Funcionalidades</a></p>',
      );
    });

    test("aceita o link sem `./`", () => {
      expect(resolveDocLinks('<a href="roadmap.md">Roadmap</a>')).toBe('<a href="/sobre/roadmap">Roadmap</a>');
    });

    test("documento não publicado perde o link e mantém o texto", () => {
      // Publicar tudo o que é citado transformaria o menu num despejo de notas
      // internas; deixar o link levaria a 404. Texto sem link é a resposta
      // honesta — a mesma regra dos contatos sem URL utilizável.
      expect(resolveDocLinks('<a href="./roteiro-video.md">roteiro do vídeo</a>')).toBe("roteiro do vídeo");
    });

    test("não toca em link externo, âncora nem imagem", () => {
      const html = '<a href="https://example.com/x.md">x</a><a href="#secao">y</a><img src="./foto.md" alt="">';

      expect(resolveDocLinks(html)).toBe(html);
    });

    test("preserva os outros atributos da tag", () => {
      expect(resolveDocLinks('<a href="./roadmap.md" title="Ver">Roadmap</a>')).toBe('<a href="/sobre/roadmap" title="Ver">Roadmap</a>');
    });

    test("preserva o texto que tem marcação dentro", () => {
      expect(resolveDocLinks('<a href="./roadmap.md">ver <strong>roadmap</strong></a>')).toBe(
        '<a href="/sobre/roadmap">ver <strong>roadmap</strong></a>',
      );
    });

    test("entrada vazia não vira 'undefined'", () => {
      expect(resolveDocLinks(null)).toBe("");
      expect(resolveDocLinks(undefined)).toBe("");
    });
  });

  describe("stripDocTitle", () => {
    test("remove o h1 do topo", () => {
      expect(stripDocTitle("<h1>Roadmap</h1>\n<p>texto</p>")).toBe("<p>texto</p>");
    });

    test("mantém h1 que não é o primeiro elemento", () => {
      const html = "<p>intro</p><h1>Seção</h1>";

      // Um `<h1>` no meio do texto é conteúdo, não cabeçalho de página.
      expect(stripDocTitle(html)).toBe(html);
    });

    test("não remove h2", () => {
      const html = "<h2>Visão geral</h2>";

      expect(stripDocTitle(html)).toBe(html);
    });

    test("entrada vazia não vira 'undefined'", () => {
      expect(stripDocTitle(null)).toBe("");
    });
  });
});
