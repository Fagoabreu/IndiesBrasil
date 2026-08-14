import { createRouter } from "next-connect";
import controller from "infra/controller";
import { isSafeUrl } from "lib/ssrf-guard";

export const config = {
  api: {
    responseLimit: "10mb",
  },
};

export default createRouter().use(controller.injectAnonymousOrUser).get(getHandler).handler(controller.errorHandlers);

/** MIME types for common image extensions. */
const MIME_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
};

async function getHandler(request, response) {
  const { url } = request.query;

  if (!url) {
    return response.status(400).json({ error: "Missing url parameter" });
  }

  // Bloqueia SSRF: exige HTTP(S) público (sem loopback/privado/link-local)
  if (!(await isSafeUrl(url))) {
    return response.status(400).json({ error: "Invalid URL" });
  }

  try {
    const imageResponse = await fetch(url, {
      headers: { "User-Agent": "IndiesBrasil/1.0 (image proxy)" },
      signal: AbortSignal.timeout(10000),
    });

    if (!imageResponse.ok) {
      return response.status(imageResponse.status).json({ error: "Image not found" });
    }

    const contentType = imageResponse.headers.get("content-type");
    const buffer = await imageResponse.arrayBuffer();

    // Determine MIME type from response header or URL extension
    let mime = contentType;
    if (!mime || !mime.startsWith("image/")) {
      const ext = url.split(".").pop()?.split("?")[0]?.toLowerCase();
      mime = MIME_TYPES[ext] || "image/png";
    }

    // Cache for 1 day on CDN, 7 days on browser
    response.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
    response.setHeader("Content-Type", mime);
    response.status(200).send(Buffer.from(buffer));
  } catch {
    // Return a transparent 1x1 pixel to avoid broken image icons
    const fallback = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Content-Type", "image/png");
    response.status(200).send(fallback);
  }
}
