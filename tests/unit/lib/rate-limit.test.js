import rateLimit from "@/lib/rate-limit";
import { sitemapKeys } from "@/lib/sitemap";

/**
 * Reconhecimento de crawler e os dois tetos do sitemap.
 *
 * O reconhecimento existe para escolher **teto**, não para autorizar: o
 * `User-Agent` vem do cliente e é falsificável. O que estes testes fixam é que o
 * crawler escapa do teto comum (o `429` nesta rota é uma falha silenciosa de SEO
 * — o Search Console a relata como "não foi possível ler o sitemap", sem log de
 * erro) e que continua havendo teto, só que maior.
 */

describe("lib/rate-limit.js — crawler e teto do sitemap", () => {
  describe("isKnownCrawler()", () => {
    test("reconhece os crawlers de buscador", () => {
      const agents = [
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Googlebot-Image/1.0",
        "Google-InspectionTool/1.0",
        "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
        "DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)",
        "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
        "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)",
        "Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)",
      ];

      for (const ua of agents) {
        expect(rateLimit.isKnownCrawler(ua)).toBe(true);
      }
    });

    test("reconhece o verificador do Search Console", () => {
      // É o agente do "Testar URL ao vivo" — o teste que diz se o Google
      // consegue ler o sitemap. Ele cair no teto comum inverteria o sinal que a
      // ferramenta existe para dar.
      expect(rateLimit.isKnownCrawler("Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)")).toBe(true);
    });

    test("reconhece os rastreadores de IA", () => {
      expect(rateLimit.isKnownCrawler("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot")).toBe(
        true,
      );
      expect(rateLimit.isKnownCrawler("ClaudeBot/1.0; claudebot@anthropic.com")).toBe(true);
      expect(rateLimit.isKnownCrawler("Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)")).toBe(true);
    });

    test("não confunde navegador com crawler", () => {
      const agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
        "curl/8.10.1",
        "node",
      ];

      for (const ua of agents) {
        expect(rateLimit.isKnownCrawler(ua)).toBe(false);
      }
    });

    test("header ausente ou vazio não é crawler", () => {
      // Ausência de `User-Agent` é o caso mais comum de requisição de bot, e
      // tratá-la como crawler daria o teto maior justamente a quem não se
      // identifica.
      expect(rateLimit.isKnownCrawler(undefined)).toBe(false);
      expect(rateLimit.isKnownCrawler(null)).toBe(false);
      expect(rateLimit.isKnownCrawler("")).toBe(false);
      expect(rateLimit.isKnownCrawler("   ")).toBe(false);
    });

    test("não depende de caixa", () => {
      expect(rateLimit.isKnownCrawler("GOOGLEBOT")).toBe(true);
      expect(rateLimit.isKnownCrawler("googlebot")).toBe(true);
      expect(rateLimit.isKnownCrawler("GoOgLeBoT/2.1")).toBe(true);
    });
  });

  describe("teto do sitemap", () => {
    test("o teto do crawler é maior que o comum", () => {
      expect(rateLimit.limiters.sitemapCrawler.max).toBeGreaterThan(rateLimit.limiters.sitemap.max);
    });

    test("buscar o índice e todos os arquivos cabe no teto comum, com folga", () => {
      // Um crawler legítimo busca o índice e cada filho. O teto comum precisa
      // estar muito acima disso para não depender de o `User-Agent` ter sido
      // reconhecido — um crawler novo (ou um IP compartilhado) não pode ser
      // barrado por engano.
      //
      // A contagem vem de `sitemapKeys()`, e não digitada: um tipo novo
      // acrescenta um arquivo, e um total fixo aqui continuaria passando
      // enquanto a margem real encolhia.
      const requestsPerCrawl = sitemapKeys().length + 1;
      expect(rateLimit.limiters.sitemap.max).toBeGreaterThanOrEqual(requestsPerCrawl * 10);
    });

    test("o teto comum bloqueia na requisição seguinte ao limite", () => {
      const limiter = rateLimit.limiters.sitemap;
      const key = "203.0.113.9";

      // Cobrir todos os limiters: um estado herdado de outro teste mudaria o
      // resultado deste.
      rateLimit.reset();

      for (let i = 1; i <= limiter.max; i += 1) {
        expect(limiter.check(key).allowed).toBe(true);
      }

      const blocked = limiter.check(key);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.resetMs).toBeGreaterThan(0);
    });

    test("cada IP tem contador próprio", () => {
      const limiter = rateLimit.limiters.sitemap;
      rateLimit.reset();

      for (let i = 0; i < limiter.max; i += 1) {
        limiter.check("203.0.113.10");
      }

      // O esgotamento de um IP não pode afetar outro: a chave é o IP, e é o que
      // mantém o bloqueio de um visitante abusivo sem atingir o resto.
      expect(limiter.check("203.0.113.10").allowed).toBe(false);
      expect(limiter.check("203.0.113.11").allowed).toBe(true);
    });
  });
});
