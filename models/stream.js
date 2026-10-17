import database from "infra/database";
import { checkTwitchChannels, checkYouTubeChannels } from "lib/streamChecker";
import { twitchThumbnailUrl } from "lib/streams";

/**
 * Colunas do canal + status cacheado de cada plataforma.
 *
 * Fica numa constante porque a listagem e o detalhe leem exatamente a mesma
 * coisa: separar as duas consultas por coluna faria a página de assistir perder
 * um campo na primeira alteração e divergir em silêncio.
 */
const STUDIO_STREAM_COLUMNS = `
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
`;

/**
 * Estúdio bloqueado pela moderação não aparece em nenhuma listagem de streams.
 *
 * Fica num trecho só porque a listagem (`getStudiosWithStreams`) e o sitemap
 * (`findAllForSitemap`) são as duas varreduras públicas do tipo, e cópias
 * divergiriam em silêncio — foi assim que o canal bloqueado ficou como primeiro
 * card da listagem, antes deste filtro existir.
 */
const STUDIO_NOT_BLOCKED = `
  NOT EXISTS (
    SELECT 1
    FROM moderation_actions ma
    WHERE ma.revoked_at IS NULL
      AND (ma.expires_at IS NULL OR ma.expires_at > now())
      AND ma.target_type = 'studio'
      AND ma.target_id = o.id::text
  )
`;

const STUDIO_STREAM_JOINS = `
  FROM organizations o
  LEFT JOIN uploaded_images ui_logo ON ui_logo.id = o.img
  LEFT JOIN org_stream_status st ON st.org_id = o.id AND st.platform = 'twitch'
  LEFT JOIN org_stream_status sy ON sy.org_id = o.id AND sy.platform = 'youtube'
  WHERE (o.twitch_channel IS NOT NULL OR o.youtube_channel_id IS NOT NULL)
    AND ${STUDIO_NOT_BLOCKED}
`;

/**
 * A ordem vale para as duas telas: ao vivo primeiro, por audiência, e depois o
 * resto por nome — o estúdio bloqueado já saiu no `WHERE`.
 */
const STUDIO_STREAM_ORDER = `
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
`;

/**
 * Escolhe qual plataforma está transmitindo. Só faz sentido quando o estúdio
 * está ao vivo — offline as duas colunas são falsas e o resultado é `null`.
 */
function pickActivePlatform(row) {
  if (row.twitch_channel && row.twitch_is_live) return "twitch";
  if (row.youtube_channel_id && row.youtube_is_live) return "youtube";
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
  return {
    viewer_count: null,
    stream_title: null,
    thumbnail_url: null,
    category_name: null,
    checked_at: null,
  };
}

/**
 * Converte a linha do banco no objeto que as telas consomem: as duas colunas de
 * status viram um status só, o da plataforma que está no ar.
 *
 * Mora aqui, e não na rota, porque a página de assistir lê o mesmo formato por
 * `findBySlug` — duas cópias divergiriam (a rota já foi o único lugar que sabia
 * ler `active_platform`).
 */
function serializeRow(row) {
  const activePlatform = pickActivePlatform(row);

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
    ...pickStreamFields(row, activePlatform),
  };
}

/**
 * Todos os estúdios com canal cadastrado e o último status cacheado de cada um,
 * ao vivo primeiro (por audiência), depois os offline por nome.
 *
 * Estúdio bloqueado pela moderação sai da lista — é varredura pública em massa e
 * repete o filtro de `models/game.js` (ver `findAllForSitemap`); antes dela esta
 * era a única listagem do site que ignorava o bloqueio.
 */
async function getStudiosWithStreams() {
  const result = await database.query({
    text: `
      SELECT ${STUDIO_STREAM_COLUMNS}
      ${STUDIO_STREAM_JOINS}
      ${STUDIO_STREAM_ORDER}
    `,
  });

  return result.rows.map(serializeRow);
}

/**
 * Um estúdio com canal cadastrado, pelo slug — o que a página de assistir
 * (`pages/streams/[slug].js`) precisa.
 *
 * Devolve `null` (e não lança) quando não existe, quando não tem canal ou quando
 * o estúdio está bloqueado: os três casos são o mesmo 404 para o visitante, e
 * distinguir "não tem canal" de "não existe" revelaria um estúdio que a
 * moderação tirou do ar.
 */
async function findBySlug(slug) {
  const result = await database.query({
    text: `
      SELECT ${STUDIO_STREAM_COLUMNS}
      ${STUDIO_STREAM_JOINS}
        AND o.slug = $1
    `,
    values: [slug],
  });

  return result.rows[0] ? serializeRow(result.rows[0]) : null;
}

/**
 * Lista para o sitemap: só o endereço (`slug`) de cada estúdio que tem canal.
 *
 * Não reaproveita `getStudiosWithStreams`: ela monta o card (JOIN da logo e das
 * duas colunas de status) e devolve tudo o que o sitemap descarta. Aqui é uma
 * varredura simples, sem paginação, com o mesmo filtro de moderação — as duas
 * são o mesmo `STUDIO_NOT_BLOCKED`, para o sitemap não anunciar estúdio que a
 * listagem esconde.
 *
 * **Sem `updated_at`, e por isso sem `<lastmod>`**: a única data que muda nesta
 * página é o `checked_at` do status ao vivo, que a verificação reescreve a cada
 * 5 minutos. Carimbo que muda sem o conteúdo mudar é o ruído que faz o Google
 * ignorar o campo (ver o doc do topo de `lib/sitemap.js`) — as organizações usam
 * `created_at` como proxy, mas aqui ele diria ainda menos (a data do estúdio,
 * não do canal).
 */
async function findAllForSitemap() {
  const result = await database.query({
    text: `
      SELECT o.slug
      FROM organizations o
      WHERE (o.twitch_channel IS NOT NULL OR o.youtube_channel_id IS NOT NULL)
        AND ${STUDIO_NOT_BLOCKED}
      ORDER BY o.name ASC
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

    const thumbnailUrl = twitchThumbnailUrl(stream?.thumbnail_url);

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

const stream = { getStudiosWithStreams, findBySlug, findAllForSitemap, refreshAllStreamStatuses };
export default stream;
