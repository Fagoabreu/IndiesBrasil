/**
 * Stream status checker for Twitch and YouTube.
 * Uses Twitch Helix API (app access token) and YouTube Data API v3.
 * Requires env vars: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, YOUTUBE_API_KEY
 */

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_STREAMS_URL = "https://api.twitch.tv/helix/streams";
const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

// In-memory token cache (refreshed automatically when expired)
let cachedToken = null;
let tokenExpiresAt = 0;

async function getTwitchAppToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const body = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    grant_type: "client_credentials",
  });

  const res = await fetch(TWITCH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Twitch token request failed: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // Expire 60 seconds early to avoid edge cases
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

/**
 * Checks live status for one or more Twitch channels.
 * @param {string[]} channelNames - array of Twitch login names (case-insensitive)
 * @returns {Array} array of live stream objects from Twitch Helix API
 */
async function checkTwitchChannels(channelNames) {
  if (!channelNames.length) return [];
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    console.warn("[streamChecker] TWITCH_CLIENT_ID ou TWITCH_CLIENT_SECRET n\u00e3o configurados. Canais Twitch n\u00e3o ser\u00e3o verificados.");
    return [];
  }

  const token = await getTwitchAppToken();

  // Twitch allows up to 100 user_login params per request
  const params = channelNames
    .slice(0, 100)
    .map((n) => `user_login=${encodeURIComponent(n.toLowerCase())}`)
    .join("&");

  const res = await fetch(`${TWITCH_STREAMS_URL}?${params}`, {
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.data || [];
}

/**
 * Checks live status for one or more YouTube channel IDs.
 * @param {string[]} channelIds - array of YouTube channel IDs (UCxxxxxxxx)
 * @returns {Array} array of { channelId, videoId, title, viewerCount, thumbnailUrl }
 */
async function checkYouTubeChannels(channelIds) {
  if (!channelIds.length) return [];
  if (!process.env.YOUTUBE_API_KEY) {
    console.warn("[streamChecker] YOUTUBE_API_KEY n\u00e3o configurada. Canais YouTube n\u00e3o ser\u00e3o verificados.");
    return [];
  }

  const results = [];

  for (const channelId of channelIds) {
    try {
      // Search for active live broadcasts on this channel
      const searchRes = await fetch(
        `${YOUTUBE_SEARCH_URL}?part=id,snippet&channelId=${encodeURIComponent(channelId)}&type=video&eventType=live&key=${process.env.YOUTUBE_API_KEY}`,
      );

      if (!searchRes.ok) continue;
      const searchData = await searchRes.json();

      if (!searchData.items?.length) continue;

      const videoId = searchData.items[0].id.videoId;
      const snippet = searchData.items[0].snippet;

      // Fetch live viewer count from videos endpoint
      const videoRes = await fetch(`${YOUTUBE_VIDEOS_URL}?part=liveStreamingDetails,snippet&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`);

      let viewerCount = null;
      if (videoRes.ok) {
        const videoData = await videoRes.json();
        const item = videoData.items?.[0];
        viewerCount = item?.liveStreamingDetails?.concurrentViewers ? Number.parseInt(item.liveStreamingDetails.concurrentViewers, 10) : null;
      }

      results.push({
        channelId,
        videoId,
        title: snippet.title,
        viewerCount,
        thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || null,
        categoryName: null, // YouTube search doesn't return category
      });
    } catch {
      // Silently skip failed individual channel checks
    }
  }

  return results;
}

export { checkTwitchChannels, checkYouTubeChannels };
