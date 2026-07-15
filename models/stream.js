import database from "infra/database";
import { checkTwitchChannels, checkYouTubeChannels } from "lib/streamChecker";

/**
 * Returns all studios that have at least one streaming channel registered,
 * including their latest cached live status.
 * Results are ordered: live first (by viewer count), then offline.
 */
async function getStudiosWithStreams() {
  const result = await database.query({
    text: `
      SELECT
        o.id,
        o.slug,
        o.name,
        o.pitch,
        o.twitch_channel,
        o.youtube_channel_id,
        ui_logo.secure_url AS logo_url,

        -- Twitch status
        st.is_live            AS twitch_is_live,
        st.viewer_count       AS twitch_viewer_count,
        st.stream_title       AS twitch_stream_title,
        st.stream_thumbnail_url AS twitch_thumbnail_url,
        st.category_name      AS twitch_category_name,
        st.checked_at         AS twitch_checked_at,

        -- YouTube status
        sy.is_live            AS youtube_is_live,
        sy.viewer_count       AS youtube_viewer_count,
        sy.stream_title       AS youtube_stream_title,
        sy.stream_thumbnail_url AS youtube_thumbnail_url,
        sy.category_name      AS youtube_category_name,
        sy.checked_at         AS youtube_checked_at

      FROM organizations o
      LEFT JOIN uploaded_images ui_logo ON ui_logo.id = o.img
      LEFT JOIN org_stream_status st ON st.org_id = o.id AND st.platform = 'twitch'
      LEFT JOIN org_stream_status sy ON sy.org_id = o.id AND sy.platform = 'youtube'
      WHERE o.twitch_channel IS NOT NULL
         OR o.youtube_channel_id IS NOT NULL
      ORDER BY
        GREATEST(
          CASE WHEN st.is_live THEN 1 ELSE 0 END,
          CASE WHEN sy.is_live THEN 1 ELSE 0 END
        ) DESC,
        GREATEST(
          COALESCE(st.viewer_count, 0),
          COALESCE(sy.viewer_count, 0)
        ) DESC,
        o.name ASC
    `,
  });

  return result.rows;
}

/**
 * Calls Twitch and YouTube APIs for every studio with a registered channel
 * and upserts the results into org_stream_status.
 * Called by the refresh API endpoint.
 */
async function refreshAllStreamStatuses() {
  const orgs = await database.query({
    text: `
      SELECT id, twitch_channel, youtube_channel_id
      FROM organizations
      WHERE twitch_channel IS NOT NULL OR youtube_channel_id IS NOT NULL
    `,
  });

  const rows = orgs.rows;
  if (!rows.length) return { checked: 0 };

  const twitchOrgs = rows.filter((r) => r.twitch_channel);
  const youtubeOrgs = rows.filter((r) => r.youtube_channel_id);

  // ---- Twitch ----
  const twitchLive = await checkTwitchChannels(twitchOrgs.map((r) => r.twitch_channel));

  for (const org of twitchOrgs) {
    const stream = twitchLive.find((s) => s.user_login.toLowerCase() === org.twitch_channel.toLowerCase());

    const thumbnailUrl = stream ? stream.thumbnail_url.replace("{width}", "440").replace("{height}", "248") : null;

    await database.query({
      text: `
        INSERT INTO org_stream_status
          (org_id, platform, is_live, viewer_count, stream_title, stream_thumbnail_url, category_name, checked_at)
        VALUES ($1, 'twitch', $2, $3, $4, $5, $6, now())
        ON CONFLICT (org_id, platform) DO UPDATE SET
          is_live              = EXCLUDED.is_live,
          viewer_count         = EXCLUDED.viewer_count,
          stream_title         = EXCLUDED.stream_title,
          stream_thumbnail_url = EXCLUDED.stream_thumbnail_url,
          category_name        = EXCLUDED.category_name,
          checked_at           = now()
      `,
      values: [org.id, !!stream, stream?.viewer_count ?? null, stream?.title ?? null, thumbnailUrl, stream?.game_name ?? null],
    });
  }

  // ---- YouTube ----
  const youtubeLive = await checkYouTubeChannels(youtubeOrgs.map((r) => r.youtube_channel_id));

  for (const org of youtubeOrgs) {
    const stream = youtubeLive.find((s) => s.channelId === org.youtube_channel_id);

    await database.query({
      text: `
        INSERT INTO org_stream_status
          (org_id, platform, is_live, viewer_count, stream_title, stream_thumbnail_url, category_name, checked_at)
        VALUES ($1, 'youtube', $2, $3, $4, $5, $6, now())
        ON CONFLICT (org_id, platform) DO UPDATE SET
          is_live              = EXCLUDED.is_live,
          viewer_count         = EXCLUDED.viewer_count,
          stream_title         = EXCLUDED.stream_title,
          stream_thumbnail_url = EXCLUDED.stream_thumbnail_url,
          category_name        = EXCLUDED.category_name,
          checked_at           = now()
      `,
      values: [org.id, !!stream, stream?.viewerCount ?? null, stream?.title ?? null, stream?.thumbnailUrl ?? null, stream?.categoryName ?? null],
    });
  }

  // Clean up stale platform records for channels that were removed from the org
  await database.query({
    text: `
      UPDATE org_stream_status oss
      SET
        is_live              = false,
        viewer_count         = NULL,
        stream_title         = NULL,
        stream_thumbnail_url = NULL,
        category_name        = NULL,
        checked_at           = now()
      FROM organizations o
      WHERE oss.org_id = o.id
        AND (
          (oss.platform = 'twitch'   AND o.twitch_channel       IS NULL)
          OR (oss.platform = 'youtube' AND o.youtube_channel_id IS NULL)
        )
    `,
  });

  return { checked: rows.length };
}

const stream = { getStudiosWithStreams, refreshAllStreamStatuses };
export default stream;
