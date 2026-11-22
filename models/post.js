import { NotFoundError, ValidationError } from "@/infra/errors";
import database from "infra/database";
import notification from "./notification";
import poll from "./poll";
import reputation from "./reputation";

const camposBase = `
  p.id,
  p.author_id,
  p.organization_id,
  p.event_id,
  p.content,
  p.img,
  p.created_at,
  p.edited_at,
  p.parent_post_id,
  p.embed,
  pui.secure_url AS post_img_url,
  u.username AS author_username,
  u.avatar_image AS author_avatar_image,
  uui.secure_url AS author_avatar_url,
  COALESCE(l.likes_count, 0) AS likes_count,
  COALESCE(c.comments_count, 0) AS comments_count,
  ev.title AS event_title,
  ev.slug AS event_slug,
  org.slug AS organization_slug,
  org.name AS organization_name,
  orglogo.secure_url AS organization_logo_url,
  po.id AS poll_id,
  po.question AS poll_question,
  po.ended_at AS poll_ended_at,
  poll_opts.poll_options AS options,
  user_poll_vote.poll_option_id AS user_vote,
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

  -- Se existe imagem
  LEFT JOIN uploaded_images pui
    ON pui.id = p.img

  -- Evento relacionado
  LEFT JOIN events ev
    ON ev.id = p.event_id

  -- Organização relacionada
  LEFT JOIN organizations org
    ON org.id = p.organization_id
  LEFT JOIN uploaded_images orglogo
    ON orglogo.id = org.img

  -- Enquete (poll)
  LEFT JOIN polls po ON po.id = p.poll_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(json_agg(json_build_object(
      'id', poopt.id,
      'label', poopt.label,
      'votes_count', COALESCE(pv.vote_count, 0)
    ) ORDER BY poopt.id), '[]'::json) AS poll_options
    FROM poll_options poopt
    LEFT JOIN (
      SELECT poll_option_id, COUNT(*) AS vote_count
      FROM poll_votes
      GROUP BY poll_option_id
    ) pv ON pv.poll_option_id = poopt.id
    WHERE poopt.poll_id = po.id
  ) poll_opts ON true

  -- Voto do usuário atual na enquete
  LEFT JOIN LATERAL (
    SELECT pv2.poll_option_id
    FROM poll_votes pv2
    JOIN poll_options po2 ON po2.id = pv2.poll_option_id
    WHERE po2.poll_id = po.id AND pv2.user_id = $1
    LIMIT 1
  ) user_poll_vote ON ($1 IS NOT NULL)

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

// Filtro de moderação — esconde posts bloqueados, posts de autores bloqueados
// e posts de estúdios bloqueados. Sem parâmetros, portanto não altera a
// numeração ($1, $2, ...) dos demais filtros.
const moderationFilter = `
  AND NOT EXISTS (
    SELECT 1
    FROM moderation_actions ma
    WHERE ma.revoked_at IS NULL
      AND (ma.expires_at IS NULL OR ma.expires_at > now())
      AND (
        (ma.target_type = 'post' AND ma.target_id = p.id::text)
        OR (ma.target_type = 'user' AND ma.target_id = p.author_id::text)
        OR (ma.target_type = 'studio' AND ma.target_id = p.organization_id::text)
      )
  )
`;

async function create(postInputValues) {
  const newPost = await runInsertQuery(postInputValues);
  if (postInputValues.tags) {
    await replaceTags(newPost.id, postInputValues.tags);
  }

  // Cria poll se tiver dados
  if (postInputValues.poll_question && postInputValues.poll_options) {
    const newPoll = await poll.create(postInputValues.poll_question, postInputValues.poll_options);
    await database.query({
      text: "UPDATE posts SET poll_id = $1 WHERE id = $2",
      values: [newPoll.id, newPost.id],
    });
  }

  // Pontuação de reputação (best-effort: não bloqueia a postagem).
  try {
    await reputation.award({
      userId: newPost.author_id,
      action: "post_created",
      referenceId: newPost.id,
    });
  } catch (error) {
    console.error("Falha ao pontuar criação de post", error);
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
}

async function update({ postId, authorId, content, tagList = [], embed = null }) {
  const result = await database.query({
    text: `
      update posts
         set content   = $3,
             embed     = $4,
             edited_at = timezone('utc', now())
       where id = $2
         and author_id = $1
      returning id
      `,
    values: [authorId, postId, content, embed],
  });

  // `author_id` no WHERE: quem não é o autor recebe o mesmo 404 de post
  // inexistente, como no delete. Confirmar a existência de um post alheio não
  // é informação que este endpoint precise entregar.
  if (result.rowCount === 0) {
    throw new NotFoundError({
      message: "O post informado não foi encontrado ou usuario não é o criador do post.",
      action: "Verifique se o post a ser editado está correto",
    });
  }

  await replaceTags(postId, tagList);

  return getPostById(authorId, postId);
}

/**
 * Substitui as tags do post pelo conjunto novo.
 *
 * Criar e editar precisam da MESMA operação: no `create` são as tags do texto
 * publicado; no `update`, é o que faz uma tag removida do texto sair de
 * `post_tags` (sem isso o filtro por tag continuaria achando o post por uma tag
 * que ele não tem mais).
 */
async function replaceTags(postId, tagList) {
  await database.query({
    text: `delete from post_tags where post_id = $1`,
    values: [postId],
  });

  await Promise.all(
    tagList.map((tag) =>
      database.query({
        text: `insert into post_tags (post_id, tag_id) values ($1, $2)`,
        values: [postId, tag.id],
      }),
    ),
  );
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

async function getPosts(user_id, seachType, tag, pagination = {}) {
  const { cursor, limit = 20 } = pagination;

  if (user_id && seachType === "following") {
    const userPosts = await runSelectFollowingsQuery(user_id, cursor, limit);
    return userPosts;
  }

  if (user_id && seachType === "tag") {
    const userPosts = await runSelectTagQuery(user_id, tag, cursor, limit);
    return userPosts;
  }

  if (user_id) {
    const userPosts = await runSelectQuery(user_id, cursor, limit);
    return userPosts;
  }
  const noUserPosts = await runSelectNoUserQuery(cursor, limit);
  return noUserPosts;

  async function runSelectQuery(user_id, cursor, limit) {
    const whereClause = cursor ? ` WHERE p.created_at < $2${moderationFilter}` : ` WHERE 1=1${moderationFilter}`;
    const orderAndLimit = ` ORDER BY p.created_at DESC LIMIT $${cursor ? 3 : 2}`;
    const values = cursor ? [user_id || null, cursor, limit] : [user_id || null, limit];

    const results = await database.query({
      text: baseSelectQuery + whereClause + orderAndLimit + ";",
      values,
    });
    return results.rows;
  }

  async function runSelectFollowingsQuery(user_id, cursor, limit) {
    const whereClause = (cursor ? " AND p.created_at < $2" : "") + moderationFilter;
    const orderAndLimit = ` ORDER BY p.created_at DESC LIMIT $${cursor ? 3 : 2}`;
    const values = cursor ? [user_id, cursor, limit] : [user_id, limit];

    const results = await database.query({
      text:
        baseSelectQuery +
        `
        inner join user_followers uf
          on uf.lead_user_id = u.id
          and uf.follower_id=$1` +
        whereClause +
        orderAndLimit +
        ";",
      values,
    });
    return results.rows;
  }

  async function runSelectTagQuery(user_id, tag, cursor, limit) {
    const whereClause = (cursor ? " AND p.created_at < $3" : "") + moderationFilter;
    const orderAndLimit = ` ORDER BY p.created_at DESC LIMIT $${cursor ? 4 : 3}`;
    const values = cursor ? [user_id, tag, cursor, limit] : [user_id, tag, limit];

    const results = await database.query({
      text:
        baseSelectQueryByTags +
        `
        where t.name=$2` +
        whereClause +
        orderAndLimit +
        ";",
      values,
    });
    return results.rows;
  }

  async function runSelectNoUserQuery(cursor, limit) {
    const whereClause = cursor ? ` WHERE p.created_at < $2${moderationFilter}` : ` WHERE 1=1${moderationFilter}`;
    const orderAndLimit = ` ORDER BY p.created_at DESC LIMIT $${cursor ? 3 : 2}`;
    const values = [null];
    if (cursor) values.push(cursor);
    values.push(limit);

    const results = await database.query({
      text: baseNoUserSelectQuery + whereClause + orderAndLimit + ";",
      values,
    });
    return results.rows;
  }
}

async function getPostById(user_id, postId) {
  const userPosts = await runSelectQuery(user_id, postId);
  return userPosts;

  async function runSelectQuery(user_id, postId) {
    const results = await database.query({
      text: baseSelectQuery + ` WHERE p.id=$2${moderationFilter};`,
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
    throw new ValidationError({
      message: "O criador do post não pode marcar a propria postagem com gostei",
      action: "Verifique se o post não é seu",
    });
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
  const shouldLike = liked === undefined ? !alreadyLiked : liked;

  // Liked
  if (shouldLike && !alreadyLiked) {
    await createPostLike(postId, userId);
    if (post.organization_id) {
      await notification.createOrgNotification({
        org_id: post.organization_id,
        type: "org_post_liked",
        source_user_id: userId,
        resource_type: "post",
        resource_id: String(postId),
        subject_title: (post.content || "").slice(0, 80),
      });
    } else {
      await notification.createPostNotification({
        user_id: post.author_id,
        source_user_id: userId,
        post_id: postId,
        type: "post_liked",
      });
    }
    // Pontuação de reputação (best-effort: não bloqueia a curtida).
    try {
      await reputation.award({
        userId,
        action: "post_liked",
        referenceId: postId,
      });
    } catch (error) {
      console.error("Falha ao pontuar curtida", error);
    }
    return { liked: true, action: "created" };
  }

  // Unliked
  if (!shouldLike && alreadyLiked) {
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

/**
 * Posts de um evento, com o MESMO formato do feed.
 *
 * A versao anterior era uma query propria em `models/event.js` que devolvia so
 * id/content/imagem/autor/curtidas — sem `embed`, sem `comments_count`, sem
 * `is_current_user` e **sem o filtro de moderacao**. A pagina do evento
 * renderizava um card artesanal em que video, card de link e enquete nao
 * apareciam, e post bloqueado continuava listado.
 *
 * Reusa `baseSelectQuery`/`baseNoUserSelectQuery` para a tela poder desenhar
 * com o mesmo `PostCardComponent` do feed.
 */
async function getPostsByEventId(viewerUserId, eventId) {
  if (viewerUserId) {
    const results = await database.query({
      text: baseSelectQuery + ` WHERE p.event_id = $2${moderationFilter} ORDER BY p.created_at DESC`,
      values: [viewerUserId, eventId],
    });
    return results.rows;
  }
  const results = await database.query({
    text: baseNoUserSelectQuery + ` WHERE p.event_id = $2${moderationFilter} ORDER BY p.created_at DESC`,
    values: [null, eventId],
  });
  return results.rows;
}

async function getPostsByOrgId(viewerUserId, orgId) {
  if (viewerUserId) {
    const results = await database.query({
      text: baseSelectQuery + ` WHERE p.organization_id = $2${moderationFilter} ORDER BY p.created_at DESC`,
      values: [viewerUserId, orgId],
    });
    return results.rows;
  }
  const results = await database.query({
    text: baseNoUserSelectQuery + ` WHERE p.organization_id = $2${moderationFilter} ORDER BY p.created_at DESC`,
    values: [null, orgId],
  });
  return results.rows;
}

async function getPostsByUsername(viewerUserId, authorUsername) {
  if (viewerUserId) {
    const results = await database.query({
      text: baseSelectQuery + ` WHERE u.username = $2${moderationFilter} ORDER BY p.created_at DESC`,
      values: [viewerUserId, authorUsername],
    });
    return results.rows;
  }
  const results = await database.query({
    text: baseNoUserSelectQuery + ` WHERE u.username = $2${moderationFilter} ORDER BY p.created_at DESC`,
    values: [null, authorUsername],
  });
  return results.rows;
}

const post = {
  create,
  update,
  deleteById,
  getPosts,
  getPostById,
  getPostsByOrgId,
  getPostsByEventId,
  deletePostByIdAndAuthorId,
  deleteCommentsByPostId,
  setPostLikes,
  getPostsByUsername,
};

export default post;
