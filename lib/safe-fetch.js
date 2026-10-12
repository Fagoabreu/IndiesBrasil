import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import { isPrivateIp } from "@/lib/ssrf-guard";

/**
 * `fetch` que não deixa o servidor ser usado como ponte para a rede interna.
 *
 * ## O que o guard sozinho não cobria
 *
 * `isSafeUrl` (`lib/ssrf-guard.js`) valida a URL **uma vez**, antes do fetch. O
 * `fetch` do undici segue redirecionamentos por padrão e resolve o DNS de novo
 * no momento de conectar — então sobravam dois caminhos:
 *
 * 1. **Redirect não revalidado.** Basta um host público controlado pelo atacante
 *    responder `302 Location: http://169.254.169.254/latest/meta-data/` para o
 *    servidor buscar o endereço de metadados. Cada hop depois do primeiro
 *    ignorava completamente a checagem.
 * 2. **DNS rebinding (TOCTOU).** A checagem resolvia o nome e descartava o
 *    resultado; a conexão resolvia outra vez, alguns milissegundos depois. Um
 *    DNS com TTL 0 que responde público na primeira consulta e `127.0.0.1` na
 *    segunda passava pela validação.
 *
 * Aqui os dois são fechados na mesma estrutura: os redirecionamentos são
 * seguidos **à mão**, revalidando cada destino, e o endereço que passou na
 * validação é **fixado** na conexão (option `lookup`), de modo que a resposta
 * usada na checagem é a que será de fato usada no socket.
 *
 * ## Por que `node:http`/`node:https` e não `fetch`
 *
 * O `fetch` do Node não expõe como fixar o endereço da conexão sem trazer o
 * `undici` como dependência (o pacote não está no projeto — a versão embutida no
 * Node não exporta o `Agent`). O `http.request`/`https.request` aceita `lookup`
 * diretamente, que é exatamente onde o DNS é resolvido. O TLS continua
 * validando o **hostname** normalmente, porque a URL não muda — só o endereço
 * para onde o socket aponta.
 *
 * ## Interface
 *
 * Devolve um objeto com `ok`, `status`, `statusText`, `headers` (com `get()`),
 * `arrayBuffer()`, `text()` e `json()` — o subconjunto que os três consumidores
 * usam (imagem, PDF e preview de link). Não é um `Response` completo de
 * propósito: emular a interface inteira seria mais código para manter e mais
 * lugares onde a emulação pode divergir do original.
 */

/** Tetos de segurança. O de bytes existe para um upstream hostil não encher a memória. */
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const DEFAULT_MAX_BYTES = 60 * 1024 * 1024; // 60 MB

/** Códigos que o `http.request` trata como "sem corpo". */
const NO_BODY_STATUSES = new Set([204, 205, 304]);

/** Verdadeiro quando o hostname casa a allowlist (subdomínios incluídos). */
function hostAllowed(hostname, allowedHosts) {
  if (!Array.isArray(allowedHosts) || allowedHosts.length === 0) return true;
  return allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

/**
 * Resolve o hostname e devolve UM endereço público para fixar na conexão.
 *
 * Falha fechada em todos os casos ambíguos: se **qualquer** resposta do DNS for
 * privada, o host inteiro é recusado — escolher "o endereço bom" deixaria o
 * round-robin do DNS escolher o ruim na conexão. Nome que não resolve também é
 * recusado (sem endereço, não há o que validar).
 *
 * @returns {Promise<{ address: string, family: number }|null>}
 */
async function pinPublicAddress(hostname) {
  const cleaned = hostname.replace(/^\[|\]$/g, "");

  // IP literal: não há DNS a resolver, só a validar.
  if (net.isIP(cleaned)) {
    if (isPrivateIp(cleaned)) return null;
    return { address: cleaned, family: net.isIPv4(cleaned) ? 4 : 6 };
  }

  let results;
  try {
    results = await dns.lookup(cleaned, { all: true, verbatim: true });
  } catch {
    return null;
  }

  if (results.length === 0) return null;
  if (results.some((entry) => isPrivateIp(entry.address))) return null;

  return { address: results[0].address, family: results[0].family };
}

/** Descomprime o corpo quando o upstream respondeu com encoding. */
function decodeBody(buffer, encoding) {
  const value = (encoding || "").toLowerCase().trim();

  try {
    if (value === "gzip" || value === "x-gzip") return zlib.gunzipSync(buffer);
    if (value === "deflate") {
      // `deflate` é ambíguo na prática: parte dos servidores manda zlib e parte
      // manda raw. Tentar zlib e cair para raw cobre os dois.
      try {
        return zlib.inflateSync(buffer);
      } catch {
        return zlib.inflateRawSync(buffer);
      }
    }
    if (value === "br") return zlib.brotliDecompressSync(buffer);
  } catch {
    // Corpo que não descomprime não derruba a requisição: o consumidor decide
    // (PDF e imagem validam assinatura/tipo, o preview devolve null).
    return buffer;
  }

  return buffer;
}

/**
 * Uma requisição, sem seguir redirecionamento.
 *
 * `pinned` é o endereço já validado; a option `lookup` faz o socket ir para ele
 * sem consultar o DNS de novo.
 *
 * @returns {Promise<{ status: number, statusText: string, headers: object, body: Buffer }>}
 */
function requestOnce(url, { pinned, timeoutMs, maxBytes, headers }) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const transport = isHttps ? https : http;

    const request = transport.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: "GET",
        headers,
        signal: AbortSignal.timeout(timeoutMs),
        // Fixa o endereço validado. O Node chama `lookup` com `all: true` quando
        // `autoSelectFamily` está ligado (padrão no Node 20+), e nesse caso ele
        // espera um array — devolver a forma errada faz a conexão falhar com
        // erro de tipo, então as duas formas são tratadas.
        lookup: (hostname, options, callback) => {
          if (options?.all) {
            callback(null, [{ address: pinned.address, family: pinned.family }]);
            return;
          }
          callback(null, pinned.address, pinned.family);
        },
      },
      (response) => {
        const chunks = [];
        let total = 0;

        if (NO_BODY_STATUSES.has(response.statusCode)) {
          response.resume();
          resolve({ status: response.statusCode, statusText: response.statusMessage || "", headers: response.headers, body: Buffer.alloc(0) });
          return;
        }

        response.on("data", (chunk) => {
          total += chunk.length;
          if (total > maxBytes) {
            // Destrói o socket: sem isto o upstream continuaria enviando e o
            // processo seguraria o buffer já coletado.
            response.destroy(new Error("response too large"));
            return;
          }
          chunks.push(chunk);
        });

        response.on("end", () => {
          resolve({
            status: response.statusCode,
            statusText: response.statusMessage || "",
            headers: response.headers,
            // Corpo **cru**: a descompressão é do envelope (`wrapResponse`), não
            // do transporte. Aqui dentro ela valeria só para esta implementação;
            // movida para o envelope, vale também para qualquer transporte
            // injetado (é o que os testes exercem).
            body: Buffer.concat(chunks),
          });
        });

        response.on("error", reject);
      },
    );

    request.on("error", reject);
    request.end();
  });
}

/** Envelope da resposta com o subconjunto de `Response` que os consumidores usam. */
function wrapResponse({ status, statusText, headers, body }) {
  // A descompressão vive aqui, e não no transporte: o corpo é descomprimido
  // conforme o `content-encoding` anunciado, independente de quem fez a
  // requisição. Sem isso, o preview de link não encontraria nenhuma meta tag
  // (estaria lendo bytes gzip) e o proxy de imagem serviria lixo.
  const decoded = decodeBody(body, headers?.["content-encoding"]);

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: {
      get: (name) => headers[String(name).toLowerCase()] ?? null,
      has: (name) => Object.hasOwn(headers, String(name).toLowerCase()),
      raw: headers,
    },
    async arrayBuffer() {
      return decoded.buffer.slice(decoded.byteOffset, decoded.byteOffset + decoded.byteLength);
    },
    async text() {
      return decoded.toString("utf8");
    },
    async json() {
      return JSON.parse(decoded.toString("utf8"));
    },
  };
}

/**
 * GET com validação de SSRF em **cada** hop.
 *
 * @param {string} rawUrl
 * @param {{
 *   allowedHosts?: string[],
 *   timeoutMs?: number,
 *   maxBytes?: number,
 *   maxRedirects?: number,
 *   headers?: Record<string, string>,
 *   fetchImpl?: typeof requestOnce,
 * }} [options] — `allowedHosts` restringe os hosts; `fetchImpl` existe para os
 *   testes exercitarem a lógica de redirect sem rede.
 * @returns {Promise<object|null>} resposta embrulhada, ou `null` quando a URL
 *   é recusada (host fora da allowlist, endereço privado, ou redirect a mais).
 */
export async function safeFetch(rawUrl, options = {}) {
  const {
    allowedHosts,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = DEFAULT_MAX_BYTES,
    maxRedirects = MAX_REDIRECTS,
    headers = {},
    fetchImpl = requestOnce,
  } = options;

  let target = String(rawUrl);

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return null;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!hostAllowed(parsed.hostname, allowedHosts)) return null;

    const pinned = await pinPublicAddress(parsed.hostname);
    if (!pinned) return null;

    let response;
    try {
      response = await fetchImpl(target, { pinned, timeoutMs, maxBytes, headers });
    } catch {
      return null;
    }

    const isRedirect = response.status >= 300 && response.status < 400;
    const location = response.headers?.location;

    // Sem `Location` um 3xx não leva a lugar nenhum — devolve como está para o
    // consumidor tratar (o de imagem já trata status não-ok).
    if (!isRedirect || !location) {
      return wrapResponse(response);
    }

    // Último hop permitido: recusa em vez de estourar o laço.
    if (hop === maxRedirects) return null;

    try {
      target = new URL(location, target).href;
    } catch {
      return null;
    }
  }

  return null;
}

const safeFetchModule = { safeFetch };
export default safeFetchModule;
