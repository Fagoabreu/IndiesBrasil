import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import { ABOUT_DOCS } from "@/lib/aboutDocs";

/**
 * `/sobre` publica os documentos de `docs/` dentro do site.
 *
 * O que este arquivo fixa, e por quê:
 *
 *  - **o documento está no HTML servido**, não carregado por JavaScript: o
 *    Markdown é lido em `getStaticProps`, então o texto tem de vir na resposta;
 *  - **não sobra href `.md`**: `./roadmap.md` é um caminho válido no repositório
 *    e uma rota inexistente no site. Vira `/sobre/<slug>` ou texto;
 *  - **slug fora da lista é 404** — a lista é a defesa contra ler arquivo
 *    arbitrário pelo caminho.
 */
const origin = webserver.origin;

describe("Sobre — documentos publicados", () => {
  beforeAll(async () => {
    await orchestrator.waitForAllServices();
  });

  test("O índice responde 200 e lista todos os documentos", async () => {
    const response = await fetch(`${origin}/sobre`);
    expect(response.status).toBe(200);

    const html = await response.text();
    for (const doc of ABOUT_DOCS) {
      expect(html).toContain(`href="/sobre/${doc.slug}"`);
      expect(html).toContain(doc.title);
    }
  });

  test.each(ABOUT_DOCS.map((doc) => [doc.slug, doc.title]))("O documento '%s' responde 200 com o título", async (slug, title) => {
    const response = await fetch(`${origin}/sobre/${slug}`);
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain(title);
    // Uma `<h1>` só: a do cabeçalho da página. O `<h1>` do topo do arquivo é
    // removido para não anunciar o mesmo título duas vezes.
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  test("O roadmap publica o conteúdo do arquivo, não um placeholder", async () => {
    const response = await fetch(`${origin}/sobre/roadmap`);
    const html = await response.text();

    expect(html).toContain("Fase 1");
    expect(html).toContain("Infraestrutura");
    // Tabela do documento: se o Markdown não fosse renderizado, isto seria
    // texto com `|`, não `<table>`.
    expect(html).toContain("<table");
  });

  test("Nenhum link `.md` chega ao HTML", async () => {
    const response = await fetch(`${origin}/sobre/funcionalidades`);
    const html = await response.text();

    // `./roteiro-video.md` e `./verificacao-de-membros.md` não são publicados:
    // o link é desfeito e o texto fica. Os publicados viram `/sobre/<slug>`.
    expect(html).not.toMatch(/href="[^"]*\.md"/);
    expect(html).toContain(`href="/sobre/roadmap"`);
  });

  test("Documento é noindex", async () => {
    const response = await fetch(`${origin}/sobre/roadmap`);
    const html = await response.text();

    // São documentos de referência do projeto: não devem competir com as
    // listagens no índice do Google.
    expect(html).toContain('name="robots"');
    expect(html).toContain("noindex");
  });

  test("Slug fora da lista responde 404", async () => {
    const response = await fetch(`${origin}/sobre/nao-existe`);

    expect(response.status).toBe(404);
  });
});
