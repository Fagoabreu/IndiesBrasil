import { SITE_URL } from "@/lib/seo";

/**
 * Endereços internos do próprio app.
 *
 * Em produção o container resolve o domínio público para um endereço interno,
 * então uma requisição server-side para `https://jogos.social.br` não funciona —
 * nem por hairpin NAT, nem pelo guard de SSRF, que não tem como distinguir "a
 * nossa própria casa" de "um serviço interno que alguém quer sondar".
 *
 * O servidor do Next escuta em `0.0.0.0:PORT` dentro do container, e é esse
 * endereço que o healthcheck do compose já usa e comprova
 * (`curl -f http://localhost:3000`).
 *
 * Fica em `lib/` porque três lugares precisam da mesma regra: o resolvedor de
 * embeds, o card de imagem e o SSR das páginas.
 */

/** Origem loopback do processo atual. */
export function loopbackOrigin() {
  return `http://127.0.0.1:${process.env.PORT || "3000"}`;
}

/** Verdadeiro quando a URL aponta para o próprio site. */
export function isOwnHost(url) {
  try {
    return new URL(url).hostname === new URL(SITE_URL).hostname;
  } catch {
    return false;
  }
}

/**
 * Converte uma URL do próprio site na equivalente via loopback.
 *
 * Devolve null quando a URL não é nossa — ou, por padrão, quando aponta para uma
 * rota de API: quem busca a própria página quer HTML, não um endpoint interno.
 * Não sobra superfície de SSRF porque o host é descartado e substituído pelo
 * loopback; de uma URL só o caminho é aproveitado.
 */
export function toLoopbackUrl(url, { allowApi = false } = {}) {
  if (!isOwnHost(url)) return null;

  const parsed = new URL(url);
  if (!allowApi && parsed.pathname.startsWith("/api/")) return null;

  return `${loopbackOrigin()}${parsed.pathname}${parsed.search}`;
}
