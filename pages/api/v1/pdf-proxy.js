import { createRouter } from "next-connect";
import controller from "infra/controller";
import rateLimit from "lib/rate-limit.js";
import { isSafeUrl } from "lib/ssrf-guard";

/**
 * Proxy para PDFs hospedados no Cloudinary (raw/upload).
 *
 * O pdfjs-dist precisa fazer fetch() do PDF para renderizar, mas o CSP de
 * produção só permite connect-src para 'self' e api.cloudinary.com.
 * Este proxy faz o download server-side e retorna os bytes ao cliente como
 * 'self', sem violar o CSP.
 */
export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(controller.rateLimitBy({ limiter: rateLimit.limiters.proxy }), getHandler)
  .handler(controller.errorHandlers);

/** Limite de resposta (Pages Router) e de tamanho do PDF upstream. */
const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50 MB

export const config = {
  api: {
    responseLimit: "50mb",
  },
};

async function getHandler(request, response) {
  const { url } = request.query;

  if (!url) {
    return response.status(400).json({ error: "Missing url parameter" });
  }

  // Permitir apenas PDFs do Cloudinary (único caso de uso legítimo deste proxy).
  // A allowlist + validação de IP bloqueia SSRF para serviços internos/metadata.
  if (!(await isSafeUrl(url, { allowedHosts: ["res.cloudinary.com"] }))) {
    return response.status(400).json({ error: "Invalid URL" });
  }

  try {
    const pdfResponse = await fetch(url, {
      headers: { "User-Agent": "IndiesBrasil/1.0 (pdf proxy)" },
      signal: AbortSignal.timeout(30000),
    });

    if (!pdfResponse.ok) {
      return response.status(pdfResponse.status).json({ error: "PDF not found" });
    }

    const contentType = pdfResponse.headers.get("content-type");
    const contentLength = pdfResponse.headers.get("content-length");

    if (contentLength && Number.parseInt(contentLength, 10) > MAX_PDF_BYTES) {
      return response.status(413).json({ error: "PDF too large" });
    }

    // O Content-Type do upstream nunca é repassado verbatim: um raw do
    // Cloudinary apontado por `pdf_url` poderia responder text/html, e servir
    // isso da nossa origem seria XSS same-origin. Se não for PDF, recusa.
    const upstreamMime = contentType ? contentType.split(";")[0].trim().toLowerCase() : "";
    if (upstreamMime && upstreamMime !== "application/pdf") {
      return response.status(415).json({ error: "Upstream is not a PDF" });
    }

    const buffer = await pdfResponse.arrayBuffer();

    if (buffer.byteLength > MAX_PDF_BYTES) {
      return response.status(413).json({ error: "PDF too large" });
    }

    response.setHeader("Content-Type", "application/pdf");
    if (contentLength) {
      response.setHeader("Content-Length", contentLength);
    }
    // Impede o browser de reinterpretar o conteúdo como outro tipo.
    response.setHeader("X-Content-Type-Options", "nosniff");
    // `inline` é necessário: o pdfjs-dist renderiza o documento no viewer.
    response.setHeader("Content-Disposition", "inline");
    response.setHeader("Cache-Control", "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400");
    response.status(200).send(Buffer.from(buffer));
  } catch (err) {
    console.error("pdf-proxy error:", err);
    return response.status(502).json({ error: "Failed to fetch PDF from upstream" });
  }
}
