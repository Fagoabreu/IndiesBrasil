/** Wraps an external image URL through our proxy so CSP doesn't block it.
 *  Uses a relative path so it always resolves to the document's origin. */
function proxyImageUrl(imageUrl) {
  if (!imageUrl) return null;
  // Don't proxy already-proxied or same-origin relative URLs
  if (imageUrl.startsWith("/api/")) return imageUrl;
  return `/api/v1/image-proxy?url=${encodeURIComponent(imageUrl)}`;
}

async function getEmbededLinks(content) {
  const links = extractLinks(content);
  const embeds = [];

  if (links.length > 0) {
    for (const link of links) {
      const embedData = await resolveEmbed(link);
      // Server-side resolution failed — store a minimal placeholder so the
      // client can render a basic link card instead of showing nothing.
      embeds.push(embedData || { type: "preview", url: link });
    }
  }
  return embeds;
}

async function resolveEmbed(url) {
  if (isYouTube(url)) {
    return resolveYouTube(url);
  }

  if (isTwitch(url)) {
    return resolveTwitch(url);
  }

  if (isInstagram(url)) {
    return resolveInstagram(url);
  }

  if (isSteamStore(url)) {
    return await resolveSteam(url);
  }

  return fetchLinkPreview(url);
}

function extractLinks(text) {
  if (!text) return [];

  const urlRegex = /(https?:\/\/[^\s]+)/g;

  return [...new Set(text.match(urlRegex) || [])];
}

function isYouTube(url) {
  return /(?:youtube\.com|youtu\.be)/.test(url);
}

function isTwitch(url) {
  return /twitch\.tv/.test(url);
}

function isInstagram(url) {
  return /instagram\.com\/(p|reel|tv)\//.test(url);
}

function isSteamStore(url) {
  return /store\.steampowered\.com\/app\/\d+/.test(url);
}

function resolveYouTube(url) {
  let videoId = null;

  // youtube.com/watch?v=ID
  videoId = url.match(/[?&]v=([^&]+)/)?.[1];

  // youtu.be/ID
  if (!videoId) {
    videoId = url.match(/youtu\.be\/([^?]+)/)?.[1];
  }

  // youtube.com/shorts/ID
  if (!videoId) {
    videoId = url.match(/youtube\.com\/shorts\/([^?]+)/)?.[1];
  }

  if (!videoId) return null;

  return {
    type: "youtube",
    subtype: url.includes("/shorts/") ? "shorts" : "video",
    videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    url,
  };
}

function resolveInstagram(url) {
  return {
    type: "instagram",
    url,
  };
}

async function fetchLinkPreview(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; IndiesBrasil/1.0; +https://jogos.social.br)",
      },
      signal: AbortSignal.timeout(8000),
    });

    // Bot-protection / non-OK — bail out early
    if (!res.ok) return null;

    const html = await res.text();

    // Flexible meta tag extractor — handles:
    //   property="og:title" OR name="og:title"
    //   attribute order reversed (content before property/name)
    //   single or double quotes
    const getMeta = (name) => {
      // Try property="og:xxx" with double quotes
      let m = new RegExp(`<meta[^>]+property=["']og:${name}["'][^>]+content=["']([^"']+)["']`, "i").exec(html);
      if (m) return decodeHTMLEntities(m[1]);
      // Try reversed order: content first
      m = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${name}["']`, "i").exec(html);
      if (m) return decodeHTMLEntities(m[1]);
      // Try name="og:xxx" (some sites use this)
      m = new RegExp(`<meta[^>]+name=["']og:${name}["'][^>]+content=["']([^"']+)["']`, "i").exec(html);
      if (m) return decodeHTMLEntities(m[1]);
      m = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']og:${name}["']`, "i").exec(html);
      if (m) return decodeHTMLEntities(m[1]);
      return null;
    };

    // Simple HTML entity decoder for common entities
    function decodeHTMLEntities(str) {
      return str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'");
    }

    // Extract <title> tag as fallback
    const getTitleTag = () => {
      const m = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
      return m ? decodeHTMLEntities(m[1].trim()) : null;
    };

    // Extract meta description (non-og) as fallback
    const getMetaDescription = () => {
      const m = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html);
      return m ? decodeHTMLEntities(m[1]) : null;
    };

    // Extract image: og:image -> twitter:image -> first <img>
    const getImageUrl = () => {
      // og:image
      let raw = getMeta("image");
      if (raw) return makeAbsolute(raw, url);
      // twitter:image
      let m = /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i.exec(html);
      if (!m) m = /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i.exec(html);
      if (!m) m = /<meta[^>]+property=["']twitter:image["'][^>]+content=["']([^"']+)["']/i.exec(html);
      if (m?.[1]) return makeAbsolute(m[1], url);
      return null;
    };

    function makeAbsolute(raw, baseUrl) {
      if (!raw) return null;
      if (raw.startsWith("http")) return raw;
      try {
        return new URL(raw, baseUrl).href;
      } catch {
        return raw;
      }
    }

    const title = getMeta("title") || getTitleTag();
    const description = getMeta("description") || getMetaDescription();
    const image = getImageUrl();

    // Wrap external images through our proxy so CSP doesn't block them
    const proxiedImage = proxyImageUrl(image);

    // If we couldn't extract anything useful, don't render an empty card
    if (!title && !description && !image) return null;

    return {
      type: "preview",
      title,
      description,
      image: proxiedImage,
      url,
    };
  } catch {
    return null;
  }
}

function resolveTwitch(url) {
  console.log("base url", process.env.NEXT_PUBLIC_BASE_URL);
  const domain = process.env.NEXT_PUBLIC_BASE_URL ? new URL(process.env.NEXT_PUBLIC_BASE_URL).hostname : "localhost";

  // Canal
  const channelMatch = url.match(/twitch\.tv\/([^/?]+)/);
  if (channelMatch && !url.includes("/videos/") && !url.includes("clips.twitch.tv")) {
    const channel = channelMatch[1];

    return {
      type: "twitch",
      subtype: "channel",
      channel,
      embedUrl: `https://player.twitch.tv/?channel=${channel}&parent=${domain}`,
      url,
    };
  }

  // Vídeo (VOD)
  const videoMatch = url.match(/twitch\.tv\/videos\/(\d+)/);
  if (videoMatch) {
    const videoId = videoMatch[1];

    return {
      type: "twitch",
      subtype: "video",
      videoId,
      embedUrl: `https://player.twitch.tv/?video=${videoId}&parent=${domain}`,
      url,
    };
  }

  // Clip
  const clipMatch = url.match(/clips\.twitch\.tv\/([^/?]+)/);
  if (clipMatch) {
    const clipId = clipMatch[1];

    return {
      type: "twitch",
      subtype: "clip",
      clipId,
      embedUrl: `https://clips.twitch.tv/embed?clip=${clipId}&parent=${domain}`,
      url,
    };
  }

  return null;
}

async function resolveSteam(url) {
  const match = url.match(/store\.steampowered\.com\/app\/(\d+)/);

  if (!match) return null;

  const appId = match[1];
  const capsuleImage = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;

  let title = null;
  let description = null;

  // Use the Steam Store API (JSON) — far more reliable than scraping HTML
  try {
    const apiUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}`;
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "IndiesBrasil/1.0" },
    });
    const json = await res.json();
    const data = json?.[appId]?.data;

    if (data) {
      title = data.name || null;
      description = data.short_description || null;
    }
  } catch {
    // Fallback: image URL is predictable regardless of API failure
  }

  return {
    type: "steam",
    subtype: "store",
    appId,
    url,
    image: capsuleImage,
    title,
    description,
  };
}

const embededResolver = {
  getEmbededLinks,
  fetchLinkPreview,
};

export default embededResolver;
