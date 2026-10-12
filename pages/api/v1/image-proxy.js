import { createRouter } from "next-connect";
import controller from "infra/controller";
import rateLimit from "lib/rate-limit.js";
import { safeFetch } from "lib/safe-fetch";

export const config = {
  api: {
    responseLimit: "10mb",
  },
};

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.rateLimitBy({ limiter: rateLimit.limiters.proxy }), getHandler)
  .handler(controller.errorHandlers);

/**
 * MIME types permitidos, indexados por extensão.
 *
 * `image/svg+xml` NÃO está aqui de propósito: SVG é um documento executável
 * (aceita <script> e handlers inline). Servido a partir da nossa origem, um
 * SVG malicioso executaria JS same-origin e — como o cookie de sessão é
 * enviado automaticamente pelo browser — permitiria agir em nome do usuário,
 * mesmo com `httpOnly`. Raster formats não executam código.
 */
const MIME_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  ico: "image/x-icon",
};

/** Só tipos raster podem ser repassados ao cliente. */
const ALLOWED_MIME = new Set(Object.values(MIME_TYPES));

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const FALLBACK_PIXEL = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/**
 * Resolve o Content-Type a servir, sempre dentro da allowlist.
 * Nunca repassa o header do upstream verbatim — um upstream controlado pelo
 * atacante pode responder `image/svg+xml` ou `text/html`.
 * @returns {string|null} MIME allowlistado ou null se o tipo não for servível.
 */
function resolveMime(contentType, url) {
  const fromHeader = contentType ? contentType.split(";")[0].trim().toLowerCase() : "";
  if (ALLOWED_MIME.has(fromHeader)) {
    return fromHeader;
  }

  const withoutQuery = url.split("?")[0].split("#")[0];
  const ext = withoutQuery.split(".").pop()?.toLowerCase();
  // Object.hasOwn evita que `constructor`/`toString` caiam no prototype.
  if (ext && Object.hasOwn(MIME_TYPES, ext)) {
    return MIME_TYPES[ext];
  }

  return null;
}

/** Cabeçalhos comuns às respostas de imagem. */
function setImageHeaders(response, mime, cacheControl) {
  response.setHeader("Cache-Control", cacheControl);
  response.setHeader("Content-Type", mime);
  // Impede o browser de reinterpretar o conteúdo como outro tipo.
  response.setHeader("X-Content-Type-Options", "nosniff");
  // `inline` (não `attachment`): attachment impede a renderização em <img>.
  response.setHeader("Content-Disposition", "inline");
}

async function getHandler(request, response) {
  const { url } = request.query;

  if (!url) {
    return response.status(400).json({ error: "Missing url parameter" });
  }

  try {
    // Bloqueia SSRF em TODOS os hops, não só na URL de entrada: o
    // `lib/safe-fetch.js` revalida cada redirecionamento e fixa o endereço
    // validado na conexão. Um `fetch(url)` direto seguia o `Location` de um
    // host público controlado pelo atacante sem checar para onde ia.
    const imageResponse = await safeFetch(url, {
      headers: { "User-Agent": "IndiesBrasil/1.0 (image proxy)" },
      timeoutMs: 10000,
    });

    if (!imageResponse) {
      return response.status(400).json({ error: "Invalid URL" });
    }

    // Status não-ok do upstream **não** é repassado: devolver o código real
    // transformava este endpoint num oráculo de varredura da rede interna
    // (porta aberta vs. fechada vs. serviço HTTP que responde). O cliente
    // recebe sempre o mesmo 400; o motivo fica no log.
    if (!imageResponse.ok) {
      console.warn(`[image-proxy] upstream respondeu ${imageResponse.status}`);
      return response.status(400).json({ error: "Image not found" });
    }

    const contentLength = imageResponse.headers.get("content-length");
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_IMAGE_BYTES) {
      return response.status(413).json({ error: "Image too large" });
    }

    const contentType = imageResponse.headers.get("content-type");
    const mime = resolveMime(contentType, url);

    // Tipo fora da allowlist (ex.: SVG) → pixel transparente, para não quebrar
    // o <img> do consumidor.
    if (!mime) {
      setImageHeaders(response, "image/png", "no-cache");
      return response.status(200).send(Buffer.from(FALLBACK_PIXEL, "base64"));
    }

    const buffer = Buffer.from(await imageResponse.arrayBuffer());

    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return response.status(413).json({ error: "Image too large" });
    }

    setImageHeaders(response, mime, "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400");
    response.status(200).send(buffer);
  } catch {
    // Return a transparent 1x1 pixel to avoid broken image icons
    setImageHeaders(response, "image/png", "no-cache");
    response.status(200).send(Buffer.from(FALLBACK_PIXEL, "base64"));
  }
}
