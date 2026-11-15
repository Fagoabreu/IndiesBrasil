import { SITE_NAME, embedHostname, normalizeHostname, pageTitle, siteHostname } from "@/lib/seo";

/**
 * Host do site no formato que players de terceiros aceitam em `parent`.
 *
 * O caso que originou o arquivo: `.env.development` define
 * `NEXT_PUBLIC_BASE_URL=localhost` (sem esquema) e o resolvedor de embeds fazia
 * `new URL(variável).hostname` — `TypeError: Invalid URL`, que subia sem
 * tratamento e fazia **todo** post com link da Twitch responder 500.
 *
 * A configuração tem as duas formas em uso (host puro no ambiente local, URL
 * completa em produção), então as duas precisam funcionar.
 */

describe("lib/seo.js — host do site", () => {
  const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  afterEach(() => {
    if (originalBaseUrl === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
    else process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl;
  });

  describe("normalizeHostname()", () => {
    test("aceita host puro — a forma do .env.development", () => {
      expect(normalizeHostname("localhost")).toBe("localhost");
      expect(normalizeHostname("jogos.social.br")).toBe("jogos.social.br");
    });

    test("aceita URL completa e descarta esquema e porta", () => {
      expect(normalizeHostname("http://localhost:3000")).toBe("localhost");
      expect(normalizeHostname("https://jogos.social.br")).toBe("jogos.social.br");
      expect(normalizeHostname("https://jogos.social.br/streams")).toBe("jogos.social.br");
    });

    test("apara espaços em volta", () => {
      expect(normalizeHostname("  jogos.social.br  ")).toBe("jogos.social.br");
    });

    test("valor ausente ou vazio não é host", () => {
      expect(normalizeHostname(null)).toBeNull();
      expect(normalizeHostname(undefined)).toBeNull();
      expect(normalizeHostname("   ")).toBeNull();
    });

    test("valor que não é endereço não vira host inventado", () => {
      expect(normalizeHostname("https://")).toBeNull();
    });
  });

  describe("siteHostname()", () => {
    test("não lança quando a configuração vem sem esquema", () => {
      process.env.NEXT_PUBLIC_BASE_URL = "localhost";

      expect(() => siteHostname()).not.toThrow();
      expect(siteHostname()).toBe("localhost");
    });

    test("a configuração de execução tem precedência sobre o endereço canônico", () => {
      process.env.NEXT_PUBLIC_BASE_URL = "http://127.0.0.1:3001";

      expect(siteHostname()).toBe("127.0.0.1");
    });

    test("configuração vazia cai no endereço canônico, nunca em null", () => {
      process.env.NEXT_PUBLIC_BASE_URL = "";

      // `parent=null` é embed inválido: o valor sempre tem de ser um host.
      expect(siteHostname()).toBeTruthy();
      expect(siteHostname()).not.toBe("null");
    });
  });

  describe("embedHostname()", () => {
    test("sem navegador, usa a configuração do processo", () => {
      process.env.NEXT_PUBLIC_BASE_URL = "localhost";

      expect(embedHostname()).toBe("localhost");
    });
  });
});

/**
 * Nome da marca e título de página.
 *
 * A marca estava literal em ~90 arquivos antes do rebrand. Agora ela vem de
 * `SITE_NAME` (que lê `NEXT_PUBLIC_SITE_NAME`) e o título passa por
 * `pageTitle()`. Estes testes fixam o contrato que o resto do app consome —
 * se alguém voltar a escrever o nome à mão, o `pageTitle` deixa de ser a fonte.
 */
describe("lib/seo.js — marca", () => {
  test("SITE_NAME tem valor mesmo sem a variável de ambiente", () => {
    expect(typeof SITE_NAME).toBe("string");
    expect(SITE_NAME.trim().length).toBeGreaterThan(0);
  });

  test("pageTitle() põe a marca no fim", () => {
    expect(pageTitle("Agenda")).toBe(`Agenda — ${SITE_NAME}`);
  });

  test("pageTitle() não duplica a marca quando o rótulo já a contém", () => {
    // "Como publicar no Jogos Social — Jogos Social" era o título real da
    // página antes deste guard.
    const label = `Como publicar no ${SITE_NAME}`;
    expect(pageTitle(label)).toBe(label);
  });

  test("pageTitle() sem rótulo devolve só a marca", () => {
    expect(pageTitle()).toBe(SITE_NAME);
    expect(pageTitle("   ")).toBe(SITE_NAME);
    expect(pageTitle(null)).toBe(SITE_NAME);
  });
});