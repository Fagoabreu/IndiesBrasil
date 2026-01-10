import { NotFoundError, ValidationError } from "@/infra/errors";
import database from "infra/database";

const camposBase = `
  p.id,
  p.organization_id,
  p.event_id,
  p.content,
  p.img,
  p.created_at,
  p.parent_post_id,
  p.embed,
  pui.secure_url AS post_img_url,
  u.username AS author_username,
  u.avatar_image AS author_avatar_image,
  uui.secure_url AS author_avatar_url,
  COALESCE(l.likes_count, 0) AS likes_count,
  COALESCE(c.comments_count, 0) AS comments_count,
`;

const joinsBase = `
  INNER JOIN users u
    ON p.author_id = u.id
        
  -- UserAvatar
  LEFT JOIN uploaded_images uui
    ON uui.id = u.avatar_image 
        
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

  -- Se existem Imagem
  LEFT JOIN uploaded_images pui
    ON pui.id = p.img 
`;

const baseSelectQuery = `
  SELECT
    ${camposBase}
    (pl.post_id IS NOT NULL) AS liked_by_user,
    (u.id = $1) AS is_current_user
  FROM 
    posts p
    ${joinsBase}

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

const baseSelectQueryByTags = `
SELECT
          ${camposBase}
          (pl.post_id IS NOT NULL) AS liked_by_user,
          (u.id = $1) AS is_current_user
        FROM
          tags t
          inner join post_tags pt
            on pt.tag_id=t.id
          inner join posts p
            on p.id = pt.post_id
          ${joinsBase}

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

const baseNoUserSelectQuery = `
SELECT
          ${camposBase}
          false AS liked_by_user,
          false AS is_current_user
        FROM 
          posts p
          ${joinsBase}
`;

async function create(postInputValues) {
  const newPost = await runInsertQuery(postInputValues);
  if (postInputValues.tags) {
    await Promise.all(
      postInputValues.tags.map(async (tag) => {
        return await runAddTagsQuery(newPost.id, tag.id);
      }),
    );
  }
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
          parent_post_id,
          embed)
      values
        ($1, $2, $3,$4, $5, timezone('utc',now()), $6, $7, $8)
      returning
        *
      `,
      values: [
        postInputValues.author_id,
        postInputValues.organization_id,
        postInputValues.event_id,
        postInputValues.content,
        postInputValues.img,
        postInputValues.visibility ?? "public",
        postInputValues.parent_post_id,
        postInputValues.embed,
      ],
    });
    return results.rows[0];
  }

  async function runAddTagsQuery(post_id, tag_id) {
    console.log("Post_tag", post_id, tag_id);
    const results = await database.query({
      text: `
      insert into
        post_tags  (
          post_id,
          tag_id)
      values
        ($1, $2)
      returning
        *
      `,
      values: [post_id, tag_id],
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

async function deleteCommentsByPostId(postId) {
  await runDeleteQuery(postId);

  async function runDeleteQuery(postId) {
    await database.query({
      text: `
      delete from comments
      where post_id=$1
      `,
      values: [postId],
    });
  }
}

async function getPosts(user_id, seachType, tag) {
  if (user_id && seachType === "following") {
    const userPosts = await runSelectFollowingsQuery(user_id);
    return userPosts;
  }

  if (user_id && seachType === "tag") {
    const userPosts = await runSelectTagQuery(user_id, tag);
    return userPosts;
  }

  if (user_id) {
    const userPosts = await runSelectQuery(user_id);
    return userPosts;
  }
  const noUserPosts = await runSelectNoUserQuery(user_id);
  return noUserPosts;

  async function runSelectQuery(user_id) {
    const results = await database.query({
      text: baseSelectQuery + ` ORDER BY p.created_at DESC;`,
      values: [user_id || null],
    });
    return results.rows;
  }

  async function runSelectFollowingsQuery(user_id) {
    const results = await database.query({
      text:
        baseSelectQuery +
        `
        inner join user_followers uf
          on uf.lead_user_id = u.id
          and uf.follower_id=$1
        ORDER BY p.created_at DESC;`,
      values: [user_id],
    });
    return results.rows;
  }

  async function runSelectTagQuery(user_id, tag) {
    const results = await database.query({
      text:
        baseSelectQueryByTags +
        `
        where t.name=$2
        ORDER BY p.created_at DESC;`,
      values: [user_id, tag],
    });
    return results.rows;
  }

  async function runSelectNoUserQuery() {
    const results = await database.query({
      text: baseNoUserSelectQuery + ` ORDER BY p.created_at DESC;`,
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

async function setPostLikes(postId, userId, liked) {
  const post = await getPostById(userId, postId);
  if (!post) {
    throw new NotFoundError({
      message: "O id do post informado não foi encontrado no sistema.",
      action: "Verifique se o post não foi removido",
    });
  }

  if (post.is_current_user) {
    throw new ValidationError({ message: "O criador do post não pode marcar a propria postagem com gostei" });
  }

  const { rowCount } = await database.query({
    text: `
    select 1
    from 
      post_likes pl
    where 
      pl.post_id = $1 
      and pl.user_id = $2
    `,
    values: [postId, userId],
  });

  const alreadyLiked = rowCount > 0;

  // 🔁 toggle automático
  if (liked === undefined) {
    if (alreadyLiked) {
      await deletePostLike(postId, userId);
      return { liked: false, action: "removed" };
    } else {
      await createPostLike(postId, userId);
      return { liked: true, action: "created" };
    }
  }

  // 👍 like explícito
  if (liked === true && !alreadyLiked) {
    await createPostLike(postId, userId);
    return { liked: true, action: "created" };
  }

  // 👎 unlike explícito
  if (liked === false && alreadyLiked) {
    await deletePostLike(postId, userId);
    return { liked: false, action: "removed" };
  }

  // 🔕 nada mudou
  return { liked: alreadyLiked, action: "noop" };

  async function createPostLike(postId, userId) {
    await database.query({
      text: `
      insert into 
      post_likes (post_id, user_id)
      values ($1, $2)
      `,
      values: [postId, userId],
    });
  }

  async function deletePostLike(postId, userId) {
    await database.query({
      text: `
      delete from 
        post_likes
      where 
        post_id=$1 
        and user_id=$2
      `,
      values: [postId, userId],
    });
  }
}

const post = {
  create,
  deleteById,
  getPosts,
  getPostById,
  deletePostByIdAndAuthorId,
  deleteCommentsByPostId,
  setPostLikes,
};

export default post;
