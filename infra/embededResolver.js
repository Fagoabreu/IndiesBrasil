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

  return fetchLinkPreview(url);
}

function extractLinks(text) {
  if (!text) return [];

  const urlRegex = /(https?:\/\/[^\s]+)/g;

  return [...new Set(text.match(urlRegex) || [])];
}

function isYouTube(url) {
  return /youtube\.com|youtu\.be/.test(url);
}

function isTwitch(url) {
  return /twitch\.tv/.test(url);
}

function resolveYouTube(url) {
  const videoId = url.match(/v=([^&]+)/)?.[1] || url.match(/youtu\.be\/([^?]+)/)?.[1];

  if (!videoId) return null;

  return {
    type: "youtube",
    videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    url,
  };
}

function resolveTwitch(url) {
  const channel = url.split("twitch.tv/")[1];
  const webserverOrigin = webserver.origin;
  if (!channel) return null;

  return {
    type: "twitch",
    channel,
    embedUrl: `https://player.twitch.tv/?channel=${channel}&parent=${webserverOrigin}`,
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
