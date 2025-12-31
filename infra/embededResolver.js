import webserver from "./webserver";

async function getEmbededLinks(content) {
  const links = extractLinks(content);
  const embeds = [];

  if (links.length > 0) {
    for (const link of links) {
      const embedData = await resolveEmbed(link);
      embeds.push(embedData);
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
    const res = await fetch(url, { method: "GET" });
    const html = await res.text();

    const getMeta = (name) => {
      const match = html.match(new RegExp(`<meta property="og:${name}" content="([^"]+)"`));
      return match ? match[1] : null;
    };

    return {
      type: "preview",
      title: getMeta("title"),
      description: getMeta("description"),
      image: getMeta("image"),
      url,
    };
  } catch {
    return null;
  }
}

const embededResolver = {
  getEmbededLinks,
};

export default embededResolver;
