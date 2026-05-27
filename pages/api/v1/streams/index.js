import { createRouter } from "next-connect";
import controller from "infra/controller";
import stream from "models/stream";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);

router.get(controller.canRequest("read:studio"), getHandler);

export default router.handler(controller.errorHandlers);

function pickActivePlatform(twitchLive, youtubeLive) {
  if (twitchLive) return "twitch";
  if (youtubeLive) return "youtube";
  return null;
}

function pickStreamFields(row, platform) {
  if (platform === "twitch") {
    return {
      viewer_count: row.twitch_viewer_count,
      stream_title: row.twitch_stream_title,
      thumbnail_url: row.twitch_thumbnail_url,
      category_name: row.twitch_category_name,
      checked_at: row.twitch_checked_at,
    };
  }
  if (platform === "youtube") {
    return {
      viewer_count: row.youtube_viewer_count,
      stream_title: row.youtube_stream_title,
      thumbnail_url: row.youtube_thumbnail_url,
      category_name: row.youtube_category_name,
      checked_at: row.youtube_checked_at,
    };
  }
  return { viewer_count: null, stream_title: null, thumbnail_url: null, category_name: null, checked_at: null };
}

/**
 * GET /api/v1/streams
 * Returns all studios with streaming channels and their latest live status.
 * Results are ordered: live channels first (by viewer count), then offline.
 */
async function getHandler(request, response) {
  const studios = await stream.getStudiosWithStreams();

  const data = studios.map((row) => {
    const activePlatform = pickActivePlatform(row.twitch_is_live, row.youtube_is_live);
    const streamFields = pickStreamFields(row, activePlatform);

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      pitch: row.pitch,
      logo_url: row.logo_url,
      twitch_channel: row.twitch_channel,
      youtube_channel_id: row.youtube_channel_id,
      is_live: row.twitch_is_live || row.youtube_is_live || false,
      active_platform: activePlatform,
      ...streamFields,
    };
  });

  return response.status(200).json(data);
}
