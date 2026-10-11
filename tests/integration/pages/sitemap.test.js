import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import rateLimit from "lib/rate-limit";
import { createSeoFixtures } from "tests/helpers/seoTestFixtures";
import game from "models/game";

/**
 * O sitemap é a porta de entrada do Google para as entidades do site.
 *
 * Estes testes existem porque a falha que motivou a mudança era silenciosa: o
 * sitemap respondia 200 com XML válido, só que listando apenas as nove páginas
 * fixas. Nada quebrava e nenhum log aparecia — a ausência de estúdios, jogos,
 * quadrinhos, cursos, notícias e análises só era visível no Search Console.
 *
 * A verificação é pelo XML servido, não pelo model: o que importa é o endereço
 * que o Google recebe, e `findAllForSitemap` poderia estar correto enquanto a
 * rota servisse outra coisa.
 */

const origin = webserver.origin;

// O domínio das respostas é o do processo do servidor (`NEXT_PUBLIC_SITE_URL`
// ou o padrão), que não é necessariamente o da suíte. Comparar só o caminho
// evita acoplar o teste ao domínio configurado.
const SITE_ORIGIN_PATTERN = /^https?:\/\/[^/]+/;

async function fetchSitemap(path) {
  const response = await fetch(`${origin}${path}`);
  return { response, body: await response.text() };
}

/** Todos os `<loc>` de um arquivo de sitemap, sem o domínio. */
function locations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].replace(SITE_ORIGIN_PATTERN, ""));
}

describe("Sitemap", () => {
  let fixtures;

  beforeAll(async () => {
    await orchestrator.waitForAllServices();
    await orchestrator.clearDatabase();
    await orchestrator.runPendingMigrations();
    await orchestrator.deleteAllEmails();

    fixtures = await createSeoFixtures();
  });

  test("O índice lista um arquivo por tipo, inclusive o estático", async () => {
    const { response, body } = await fetchSitemap("/sitemap.xml");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/xml");

    expect(locations(body)).toEqual([
      "/sitemap/estatico.xml",
      "/sitemap/estudios.xml",
      "/sitemap/jogos.xml",
      "/sitemap/jogos-de-mesa.xml",
      "/sitemap/quadrinhos.xml",
      "/sitemap/estudos.xml",
      "/sitemap/noticias.xml",
      "/sitemap/analises.xml",
      "/sitemap/agenda.xml",
    ]);
  });

  test("O índice não lista a si mesmo", async () => {
    const { body } = await fetchSitemap("/sitemap.xml");

    // Um índice de sitemaps não pode listar a si mesmo: o Google descarta o
    // arquivo inteiro com "Sitemap index file cannot contain itself".
    expect(locations(body)).not.toContain("/sitemap.xml");
  });

  test("Cada arquivo traz o hub e as entidades do seu tipo", async () => {
    const expected = {
      "/sitemap/estudios.xml": ["/estudios", `/estudios/${fixtures.studio.slug}`],
      "/sitemap/jogos.xml": ["/jogos", `/jogos/${fixtures.gameRow.slug}`],
      "/sitemap/jogos-de-mesa.xml": ["/jogos-de-mesa", `/jogos-de-mesa/${fixtures.boardgameSlug}`],
      "/sitemap/quadrinhos.xml": ["/quadrinhos", `/quadrinhos/${fixtures.bookSlug}`],
      "/sitemap/estudos.xml": ["/estudos", `/estudos/${fixtures.courseSlug}`],
      "/sitemap/noticias.xml": ["/noticias", `/noticias/${fixtures.newsId}`],
      "/sitemap/analises.xml": ["/analises", `/analises/${fixtures.analiseSlug}`],
      "/sitemap/agenda.xml": ["/agenda", `/agenda/${fixtures.publicEventId}`],
    };

    for (const [path, paths] of Object.entries(expected)) {
      const { response, body } = await fetchSitemap(path);
      expect(response.status).toBe(200);
      expect(locations(body)).toEqual(expect.arrayContaining(paths));
    }
  });

  test("O arquivo estático traz as páginas fixas do site", async () => {
    const { response, body } = await fetchSitemap("/sitemap/estatico.xml");

    expect(response.status).toBe(200);
    expect(locations(body)).toEqual(expect.arrayContaining(["/", "/posts", "/membros", "/cadastro", "/login"]));
  });

  test("Conteúdo bloqueado pela moderação fica fora do sitemap", async () => {
    const { body } = await fetchSitemap("/sitemap/jogos.xml");

    expect(locations(body)).not.toContain(`/jogos/${fixtures.blockedGameSlug}`);
  });

  test("A agenda publica só eventos públicos e publicados", async () => {
    const { response, body } = await fetchSitemap("/sitemap/agenda.xml");
    const paths = locations(body);

    expect(response.status).toBe(200);
    expect(paths).toContain(`/agenda/${fixtures.publicEventId}`);

    // `visibility` menor que público são três estados diferentes e cada um
    // falharia de um jeito: `members` anuncia conteúdo que exige conta,
    // `private` anuncia conteúdo restrito (o sitemap é público por natureza) e
    // `draft` publica uma página que ainda não existe para o visitante.
    expect(paths).not.toContain(`/agenda/${fixtures.membersEventId}`);
    expect(paths).not.toContain(`/agenda/${fixtures.privateEventId}`);
    expect(paths).not.toContain(`/agenda/${fixtures.draftEventId}`);
  });

  test("As reuniões de estúdio não entram no sitemap", async () => {
    const { body } = await fetchSitemap("/sitemap/agenda.xml");

    // Reunião vive em outra tabela (`meetings`), tem lista própria e a página
    // é `noIndex` fixo — o sitemap da agenda publica **eventos**, não reuniões.
    expect(body).not.toContain("/reunioes/");
    expect(locations(body).every((path) => path === "/agenda" || path.startsWith("/agenda/"))).toBe(true);
  });

  test("O lastmod da entidade é a data real da linha, não a hora da requisição", async () => {
    const { body } = await fetchSitemap("/sitemap/jogos.xml");

    const row = await game.findBySlug(fixtures.gameRow.slug);
    const expected = new Date(row.updated_at).toISOString();

    // O sitemap antigo carimbava `new Date()` em todas as URLs: o valor mudava
    // sem o conteúdo mudar, e o Google aprende a ignorar esse sinal.
    expect(body).toContain(`<lastmod>${expected}</lastmod>`);
  });

  test("Tipo de sitemap desconhecido responde 404", async () => {
    const { response } = await fetchSitemap("/sitemap/nao-existe.xml");

    // Nunca um `<urlset>` vazio: arquivo vazio é válido para o Google e o erro
    // passaria como "sitemap processado".
    expect(response.status).toBe(404);
  });

  test("O 404 não repete o valor recebido na resposta", async () => {
    // Sem barra no valor: com barra (ex.: `%3C/script%3E`) o caminho deixa de
    // casar a rota e a resposta passa a ser a página 404 do próprio Next, que
    // tem `<script>` no HTML por definição — o teste mediria outra coisa.
    const { response, body } = await fetchSitemap("/sitemap/%3Cscript%3Ealert(1).xml");

    // O parâmetro vem do visitante. A resposta é `text/plain` com `nosniff`, o
    // que já impede a renderização — o que este teste garante é que não há
    // reflexão nenhuma para depender daquele cabeçalho continuar existindo.
    expect(response.status).toBe(404);
    expect(body).not.toContain("script");
    expect(body).toContain("Sitemap não encontrado");
  });

  test("Varredura repetida do mesmo IP é limitada", async () => {
    // `getClientIp` usa a ÚLTIMA entrada do X-Forwarded-For (o nginx acrescenta
    // o IP real no fim; as anteriores vêm do cliente e podem ser forjadas). Um
    // IP público aqui tira a requisição da isenção de loopback e prova o teto.
    const headers = { "x-forwarded-for": "203.0.113.77" };
    const max = rateLimit.limiters.sitemap.max;

    let lastStatus = 0;
    for (let i = 0; i <= max; i += 1) {
      const response = await fetch(`${origin}/sitemap/estatico.xml`, { headers });
      lastStatus = response.status;
    }

    // Cada arquivo é uma varredura sem paginação e o Next não cacheia
    // `getServerSideProps` no standalone: sem teto, um bot nos oito arquivos
    // vira carga de banco em cima de uma rota de SEO.
    expect(lastStatus).toBe(429);
  });
});
