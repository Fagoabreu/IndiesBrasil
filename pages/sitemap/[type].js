import rateLimit from "@/lib/rate-limit";
import { buildSitemapFor, entitySitemapFor, sendSitemapXml, sitemapKeys } from "@/lib/sitemap";

/**
 * Um arquivo de sitemap por tipo: `/sitemap/estudios.xml`, `/sitemap/jogos.xml`…
 *
 * O `.xml` faz parte do **valor** do parâmetro, não do caminho do arquivo. É o
 * único jeito de manter a extensão no endereço: o Pages Router casa um segmento
 * dinâmico inteiro, então `sitemap-[type].xml.js` (trecho fixo + dinâmico no
 * mesmo segmento) simplesmente não gera rota — a resposta era o 404 em HTML do
 * site, que o Google leria como "sitemap inválido".
 *
 * A config que liga cada chave ao model está em `lib/sitemap.js`; acrescentar
 * um tipo novo é acrescentar um item lá. Este arquivo não muda.
 */

/**
 * Responde 429 quando o IP passou do teto do limiter de sitemap.
 *
 * `buildSitemapFor` roda uma varredura **sem paginação** por chamada — o
 * sitemap precisa de todas as linhas do tipo —, e o Next não guarda cache de
 * `getServerSideProps` no servidor standalone: sem este teto, cada requisição
 * vira uma consulta à tabela inteira. Tráfego interno e de teste (loopback) não
 * é limitado, o mesmo critério das rotas de login.
 *
 * O teto de crawler conhecido é o mais alto (`sitemapCrawler`), e existe por um
 * defeito observado: o Search Console relatava **"não foi possível ler o
 * sitemap"** enquanto a URL respondia `200` para todo o resto do mundo. Um `429`
 * nesta rota é uma falha silenciosa de SEO — não há log de erro, só um arquivo
 * que o Google deixa de processar.
 *
 * @returns {boolean} `false` quando já respondeu 429 (o chamador deve parar).
 */
function allowRequest(req, res) {
  const clientIp = rateLimit.getClientIp(req);
  if (rateLimit.isLocalRequest(clientIp)) return true;

  // Só o **teto** muda: quem passa por aqui é leitura pública, então reconhecer
  // o crawler não dá acesso a nada que um visitante já não tenha. `User-Agent`
  // não decide autorização em lugar nenhum desta rota.
  const limiter = rateLimit.isKnownCrawler(req.headers["user-agent"]) ? rateLimit.limiters.sitemapCrawler : rateLimit.limiters.sitemap;
  const { allowed, resetMs } = limiter.check(clientIp);
  if (allowed) return true;

  res.statusCode = 429;
  res.setHeader("Retry-After", String(Math.ceil(resetMs / 1000)));
  res.setHeader("Content-Type", "text/plain; charset=UTF-8");
  res.setHeader("Cache-Control", "no-store");
  res.end("Muitas requisições. Tente novamente em instantes.\n");
  return false;
}

export async function getServerSideProps({ params, req, res }) {
  if (!allowRequest(req, res)) return { props: {} };

  const key = params.type.replace(/\.xml$/, "");
  const config = entitySitemapFor(key);

  /**
   * Um tipo só entra no sitemap enquanto o visitante anônimo puder lê-lo.
   *
   * O sitemap é público por natureza, então a lista do controller é o único
   * gate possível — e ele é o mesmo que a listagem e a API do tipo usam. Sem
   * isto, revogar `read:game:all` do anônimo parava a API e a listagem e o
   * sitemap continuava anunciando endereços que passariam a responder 404.
   */
  if (config) {
    const { anonymousCan } = await import("@/infra/controller");
    if (!anonymousCan(config.feature)) return notFoundResponse(res);
  }

  // Chave desconhecida devolve 404, nunca um `<urlset>` vazio: sitemap vazio é
  // um arquivo válido para o Google, e o erro passaria como "processado".
  //
  // A mensagem **não repete o valor recebido**: o parâmetro vem do visitante e
  // apareceria na resposta. Com `nosniff` e `text/plain` isso não vira HTML,
  // mas refletir entrada sem necessidade é hábito que passa a depender de um
  // cabeçalho futuro para continuar inofensivo — a lista de chaves válidas é o
  // que serve para quem está depurando.
  const xml = key === params.type ? null : await buildSitemapFor(key);
  if (!xml) return notFoundResponse(res);

  sendSitemapXml(res, xml);
  return { props: {} };
}

/** 404 em texto — vale tanto para chave inexistente quanto para tipo sem permissão. */
function notFoundResponse(res) {
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=UTF-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(`Sitemap não encontrado. Disponíveis: ${sitemapKeys().join(", ")}.\n`);
  return { props: {} };
}

// Componente vazio — a resposta é enviada inteiramente pelo getServerSideProps.
export default function Sitemap() {
  return null;
}
