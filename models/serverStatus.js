import database from "infra/database";

async function getSummary() {
  const newPost = await runSelectQuery();
  return newPost;

  async function runSelectQuery() {
    const results = await database.query({
      text: `
        SELECT
          (
            SELECT COUNT(*)
            FROM users
            WHERE 'create:session' = ANY(features)
          ) AS user_accounts,
          (
            SELECT COUNT(*)
            FROM users
            WHERE 'create:session' = ANY(features)
            and created_at >= NOW() - INTERVAL '30 days'
          ) AS new_user_accounts,
          (
            SELECT COUNT(*)
            FROM posts
            WHERE created_at >= NOW() - INTERVAL '30 days'
          ) AS new_posts,
          (
            SELECT COUNT(*)
            FROM posts
            WHERE created_at BETWEEN (NOW() - INTERVAL '60 days')
                                  AND (NOW() - INTERVAL '30 days')
          ) AS previous_posts,
          (
            SELECT COUNT(*)
            FROM events
            WHERE created_at BETWEEN (NOW() - INTERVAL '60 days')
                                  AND (NOW() - INTERVAL '30 days')
          ) AS previous_events,
          (
            SELECT COUNT(*)
            FROM events
            WHERE created_at >= NOW() - INTERVAL '30 days'
          ) AS events,
          (
            SELECT COUNT(*)
            FROM organizations
          ) AS organizations,
          (
            SELECT COUNT(*)
            FROM organizations
            WHERE created_at >= NOW() - INTERVAL '30 days'
          ) AS new_organizations,
          (
            SELECT COUNT(*)
            FROM games
          ) AS games,
          (
            SELECT COUNT(*)
            FROM games
            WHERE created_at >= NOW() - INTERVAL '30 days'
          ) AS new_games,
          (
            SELECT COUNT(*)
            FROM boardgames
          ) AS boardgames,
          (
            SELECT COUNT(*)
            FROM boardgames
            WHERE created_at >= NOW() - INTERVAL '30 days'
          ) AS new_boardgames,
          (
            SELECT COUNT(*)
            FROM books
          ) AS books,
          (
            SELECT COUNT(*)
            FROM books
            WHERE created_at >= NOW() - INTERVAL '30 days'
          ) AS new_books,
          -- Estúdios com transmissão ao vivo agora. org_stream_status é um
          -- cache alimentado pelo refresh de /api/v1/streams/refresh, então o
          -- número reflete a última verificação (pode estar defasado se
          -- ninguém abriu a página de streams recentemente). DISTINCT porque
          -- o mesmo estúdio pode estar ao vivo na Twitch e no YouTube.
          (
            SELECT COUNT(DISTINCT org_id)
            FROM org_stream_status
            WHERE is_live = true
          ) AS live_streams,
          -- Total de estúdios com canal cadastrado (sempre exato, independe
          -- do cache de status acima).
          (
            SELECT COUNT(*)
            FROM organizations
            WHERE twitch_channel IS NOT NULL OR youtube_channel_id IS NOT NULL
          ) AS streaming_studios
          ;

      `,
    });
    return results.rows[0];
  }
}

const serverStatus = {
  getSummary,
};

export default serverStatus;
