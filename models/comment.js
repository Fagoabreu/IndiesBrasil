import database from "infra/database.js";

const baseSelectQuery = `
SELECT
  c.id,
  c.post_id,
  c.created_at,
  c.content,
  u.username AS author_username,
  u.avatar_url AS author_avatar_url,
  (c.author_id = $2) AS is_current_user
FROM 
  comments c
  INNER JOIN users u
    ON u.id = c.author_id 
WHERE
  c.post_id = $1
Order by
  c.created_at DESC
`;

async function create(commentInputValues) {
  const postComment = await runInsertQuery(commentInputValues);
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
    const results = await database.query({
      text: baseSelectQuery,
      values: [post_id, user_id || null],
    });
    return results.rows;
  }
}

async function getCommentsById(comment_id, current_user_id) {}

async function deleteByIdAndAuthorId(author_id, comment_id) {}

const comment = {
  create,
  getCommentsByPostId,
  getCommentsById,
  deleteByIdAndAuthorId,
};

export default comment;
