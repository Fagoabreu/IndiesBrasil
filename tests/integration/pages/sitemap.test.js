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
      "/sitemap/streams.xml",
      "/sitemap/assets.xml",
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
      "/sitemap/streams.xml": ["/streams", `/streams/${fixtures.studio.slug}`],
      "/sitemap/assets.xml": ["/assets", `/assets/${fixtures.assetSlug}`],
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

    // Mesma regra para asset: bloqueado — ou de estúdio bloqueado — não é
    // endereço a anunciar (a página responderia 404).
    const assets = await fetchSitemap("/sitemap/assets.xml");
    expect(locations(assets.body)).not.toContain(`/assets/${fixtures.blockedAssetSlug}`);
  });

  test("O arquivo de streams publica o canal do estúdio e esconde o estúdio bloqueado", async () => {
    const { response, body } = await fetchSitemap("/sitemap/streams.xml");
    const paths = locations(body);

    expect(response.status).toBe(200);
    // Quem entra é o estúdio que tem canal cadastrado, ao vivo ou não: a página
    // offline é conteúdo dela também.
    expect(paths).toContain(`/streams/${fixtures.studio.slug}`);
    // Estúdio bloqueado esconderia a página do canal (404) — e é a mesma classe
    // de defeito que deixava o canal bloqueado como primeiro card da listagem.
    expect(paths).not.toContain(`/streams/${fixtures.blockedStudioSlug}`);
  });

  test("O sitemap de streams não carimba lastmod", async () => {
    const { body } = await fetchSitemap("/sitemap/streams.xml");

    // A única data que muda nesta página é o status ao vivo, reescrito a cada
    // verificação (5 min). Um `<lastmod>` que se move sem o conteúdo mudar é o
    // sinal que o Google aprende a ignorar — e, sem `updated_at` na linha, a
    // tag some sozinha (`buildUrlEntry` omite valor vazio).
    expect(body).not.toContain("<lastmod>");
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
    //
    // A varredura tem que ser em HTTP, e não consumindo
    // `rateLimit.limiters.sitemap` direto: o limiter vive no **processo do
    // servidor**, e importar o módulo aqui dá outra instância — consumir o
    // contador local não bloquearia requisição nenhuma.
    const headers = { "x-forwarded-for": "203.0.113.77", "user-agent": "curl/8.10.1" };
    const max = rateLimit.limiters.sitemap.max;

    let lastStatus = 0;
    for (let i = 0; i <= max; i += 1) {
      // `estatico` de propósito: é o único arquivo sem consulta ao banco, então
      // o teste mede o limiter, não a varredura.
      const response = await fetch(`${origin}/sitemap/estatico.xml`, { headers });
      lastStatus = response.status;
    }

    // Cada arquivo é uma varredura sem paginação e o Next não cacheia
    // `getServerSideProps` no standalone: sem teto, um bot em todos os arquivos
    // vira carga de banco em cima de uma rota de SEO.
    expect(lastStatus).toBe(429);
  });

  test("Crawler conhecido não cai no teto comum", async () => {
    // O caso que motivou o teto separado: o Search Console relatava "não foi
    // possível ler o sitemap" enquanto a URL respondia 200 para o resto do
    // mundo. `429` nesta rota não gera log de erro — só um sitemap que o Google
    // deixa de processar.
    const ip = "198.51.100.42";

    // Esgota o teto comum com um `User-Agent` comum: o contador do crawler é
    // outro, então quem esgota o comum tem que ser a requisição comum — com UA
    // de crawler desde o início, o teto comum daquele IP ficaria zerado e o
    // teste não provaria nada.
    let commonStatus = 0;
    for (let i = 0; i <= rateLimit.limiters.sitemap.max; i += 1) {
      const response = await fetch(`${origin}/sitemap/estatico.xml`, { headers: { "x-forwarded-for": ip, "user-agent": "curl/8.10.1" } });
      commonStatus = response.status;
    }
    expect(commonStatus).toBe(429);

    // Mesmo IP, mesmo instante: só o `User-Agent` mudou.
    const response = await fetch(`${origin}/sitemap/estatico.xml`, {
      headers: { "x-forwarded-for": ip, "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
    });

    expect(response.status).toBe(200);
  });

  test("O teto do crawler é maior, mas não é isenção", () => {
    // Um `User-Agent` é falsificável e cada requisição é uma varredura sem
    // cache, então o caminho do crawler tem teto próprio — um múltiplo conhecido
    // do comum, não um contador aberto. O valor fica fixado aqui para que
    // remover o teto (isenção literal) apareça como falha, e não como silêncio.
    expect(rateLimit.limiters.sitemapCrawler.max).toBe(600);
    expect(rateLimit.limiters.sitemapCrawler.max).toBeGreaterThan(rateLimit.limiters.sitemap.max);
  });
});
