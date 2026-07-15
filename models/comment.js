import database from "infra/database.js";
import notification from "./notification";

const baseSelectQuery = `
SELECT
  c.id,
  c.post_id,
  c.created_at,
  c.content,
  u.username AS author_username,
  uui.secure_url AS author_avatar_image,
  (c.author_id = $2) AS is_current_user
FROM 
  comments c
  INNER JOIN users u
    ON u.id = c.author_id
  LEFT JOIN uploaded_images uui
    ON uui.id = u.avatar_image
`;

async function create(commentInputValues) {
  const postComment = await runInsertQuery(commentInputValues);

  // Busca o dono do post para notificá-lo do comentário
  const postResult = await database.query({
    text: `SELECT author_id FROM posts WHERE id = $1`,
    values: [commentInputValues.post_id],
  });

  if (postResult.rowCount > 0) {
    const postAuthorId = postResult.rows[0].author_id;
    // Só cria notificação se quem comentou não for o próprio dono do post
    if (postAuthorId !== commentInputValues.author_id) {
      await notification.createPostNotification({
        user_id: postAuthorId,
        source_user_id: commentInputValues.author_id,
        post_id: commentInputValues.post_id,
        type: "post_commented",
      });
    }
  }

  return postComment;

  async function runInsertQuery(commentInputValues) {
    const results = await database.query({
      text: `
        insert into
          comments (
            post_id,
            author_id,
            content,
            created_at)
        values
          ($1, $2, $3,timezone('utc',now()))
        returning
          *
        `,
      values: [commentInputValues.post_id, commentInputValues.author_id, commentInputValues.content],
    });
    return results.rows[0];
  }
}

async function getCommentsByPostId(post_id, user_id) {
  const postComments = await runSelectQuery(post_id, user_id);
  return postComments;

  async function runSelectQuery(post_id, user_id) {
    const whereClause = `WHERE
      c.post_id = $1
      Order by
      c.created_at DESC
    `;

    const results = await database.query({
      text: baseSelectQuery + whereClause,
      values: [post_id, user_id || null],
    });
    return results.rows;
  }
}

async function getCommentsByCommentId(comment_id, user_id) {
  const postComments = await runSelectQuery(comment_id, user_id);
  return postComments;

  async function runSelectQuery(comment_id, user_id) {
    const whereClause = `
      WHERE
      c.id = $1
    `;

    const results = await database.query({
      text: baseSelectQuery + whereClause,
      values: [comment_id, user_id || null],
    });
    return results.rows[0];
  }
}

async function deleteById(comment_id) {
  await runDeleteQuery(comment_id);
  return;

  async function runDeleteQuery(comment_id) {
    await database.query({
      text: `Delete from comments 
        WHERE
        id = $1
      `,
      values: [comment_id],
    });
  }
}

const comment = {
  create,
  getCommentsByPostId,
  getCommentsByCommentId,
  deleteById,
};

export default comment;
