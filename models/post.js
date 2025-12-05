import database from "infra/database";

const baseSelectQuery = `
SELECT
          p.id,
          p.organization_id,
          p.event_id,
          p.content,
          p.img,
          p.created_at,
          p.parent_post_id,
          u.username AS author_username,
          u.avatar_url AS author_avatar_url,
          COALESCE(l.likes_count, 0) AS likes_count,
          COALESCE(c.comments_count, 0) AS comments_count,
          (pl.post_id IS NOT NULL) AS liked_by_user,
          (u.id = $1) AS is_current_user
        FROM 
          posts p
          INNER JOIN users u
            ON p.author_id = u.id

          -- Contagem de likes
          LEFT JOIN LATERAL (
            SELECT COUNT(*) AS likes_count
            FROM post_likes pl
            WHERE pl.post_id = p.id
          ) l ON true

          -- Contagem de comentários
          LEFT JOIN LATERAL (
            SELECT COUNT(*) AS comments_count
              FROM comments co
              WHERE co.post_id = p.id
          ) c ON true

          -- Se o usuário curtiu
          LEFT JOIN LATERAL (
              SELECT 1 AS liked, post_id
              FROM post_likes pl2
              WHERE 
                pl2.post_id = p.id
                AND pl2.user_id = $1
              LIMIT 1
          ) pl ON true
`;

async function create(postInputValues) {
  const newPost = await runInsertQuery(postInputValues);
  return newPost;
  async function runInsertQuery(postInputValues) {
    const results = await database.query({
      text: `
      insert into
        posts (
          author_id,
          organization_id,
          event_id,
          content,
          img,
          created_at,
          visibility,
          parent_post_id)
      values
        ($1, $2, $3,$4, $5, timezone('utc',now()), $6, $7)
      returning
        *
      `,
      values: [postInputValues.author_id, postInputValues.organization_id, postInputValues.event_id, postInputValues.content, postInputValues.img, postInputValues.visibility ?? "public", postInputValues.parent_post_id],
    });
    return results.rows[0];
  }
}

async function deleteById(postId) {
  await runDeleteQuery(postId);

  async function runDeleteQuery(postId) {
    await database.query({
      text: `
      delete from posts
      where id=$1
      `,
      values: [postId],
    });
  }
}

async function getPosts(user_id) {
  const userPosts = await runSelectQuery(user_id);
  return userPosts;

  async function runSelectQuery(user_id) {
    const results = await database.query({
      text: baseSelectQuery + ` ORDER BY p.created_at DESC;`,
      values: [user_id || null],
    });
    return results.rows;
  }
}

async function getPostById(user_id, postId) {
  const userPosts = await runSelectQuery(user_id, postId);
  return userPosts;

  async function runSelectQuery(user_id, postId) {
    const results = await database.query({
      text: baseSelectQuery + ` WHERE p.id=$2;`,
      values: [user_id || null, postId],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "O id informado não foi encontrado no sistema.",
        action: "Verifique se o id foi digitado corretamente",
      });
    }

    return results.rows[0];
  }
}

async function deletePostByIdAndAuthorId(userId, postId) {
  const userPosts = await runDeleteQuery(userId, postId);
  return userPosts;

  async function runDeleteQuery(userId, postId) {
    const results = await database.query({
      text: `Delete from posts p
      WHERE 
        p.author_id=$1 
        and p.id=$2
      returning *
      ;`,
      values: [userId, postId],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "O post informado não foi encontrado ou usuario não é o criador do post.",
        action: "Verifique se o post se o post a ser deletado está correto",
      });
    }

    return results.rows[0];
  }
}

const post = {
  create,
  deleteById,
  getPosts,
  getPostById,
  deletePostByIdAndAuthorId,
};

export default post;
