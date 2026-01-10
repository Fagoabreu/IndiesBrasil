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
            FROM posts
            WHERE created_at >= NOW() - INTERVAL '30 days'
          ) AS posts,
          (
            SELECT COUNT(*)
            FROM posts
            WHERE created_at BETWEEN (NOW() - INTERVAL '60 days')
                                  AND (NOW() - INTERVAL '30 days')
          ) AS previous_posts;

      `,
    });
    return results.rows[0];
  }
}

const serverStatus = {
  getSummary,
};

export default serverStatus;
