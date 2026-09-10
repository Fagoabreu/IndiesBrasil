import database from "infra/database";
import password from "models/password";
import { ValidationError, NotFoundError } from "infra/errors.js";
import notification from "./notification";

async function create(userInputValues) {
  await validateUniqueUsename(userInputValues.username);
  await validateUniqueEmail(userInputValues.email);
  await validateUniqueCPF(userInputValues.cpf);
  await hashPasswordInObject(userInputValues);
  injectDefaultFeaturesInObject(userInputValues);

  const newUser = await runInsertQuery(userInputValues);
  return secureUserInterface(newUser);

  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
      Insert into
        users (
          username,
          email,
          password,
          cpf,
          birth_date,
          features,
          resumo,
          visibility,
          bio)
      values
        ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      returning
        *`,
      values: [
        userInputValues.username,
        userInputValues.email,
        userInputValues.password,
        userInputValues.cpf,
        userInputValues.birth_date,
        userInputValues.features,
        userInputValues.resumo,
        userInputValues.visibility || "public",
        userInputValues.bio,
      ],
    });
    return results.rows[0];
  }

  function injectDefaultFeaturesInObject(userInputValues) {
    userInputValues.features = ["read:activation_token"];
  }
}

async function update(username, userInputValues) {
  const currentUser = await findOneByUsername(username);
  if ("username" in userInputValues) {
    await validateUniqueUsename(userInputValues.username);
  }
  if ("email" in userInputValues) {
    await validateUniqueEmail(userInputValues.email);
  }
  if ("cpf" in userInputValues) {
    await validateUniqueCPF(userInputValues.cpf);
  }
  if ("birth_date" in userInputValues) {
    validateBirthDate(userInputValues.birth_date);
  }
  if ("password" in userInputValues) {
    await hashPasswordInObject(userInputValues);
  }
  const userWithNewValues = {
    ...currentUser,
    ...userInputValues,
  };
  const updatedUser = await runUpdatedQuery(userWithNewValues);
  return updatedUser;
}

async function findOneById(id) {
  const userFound = await runSelectQuery(id);
  return userFound;

  async function runSelectQuery(id) {
    const results = await database.query({
      text: `
        select
          id,
          username,
          email,
          cpf,
          features,
          reputation,
          resumo,
          bio,
          visibility,
          background_image,
          avatar_image,
          created_at,
          updated_at
        from
          users u
        where
          id = $1
        limit
          1`,
      values: [id],
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

async function findOneByUsername(username) {
  const userFound = await runSelectQuery(username);
  return userFound;

  async function runSelectQuery(username) {
    const results = await database.query({
      text: `
        select
          u.id,
          u.username,
          u.email,
          u.updated_at,
          u.created_at,
          ui.secure_url as avatar_image,
          u.cpf,
          u.password,
          u.features,
          u.reputation,
          u.resumo,
          u.bio,
          u.visibility,
          ub.secure_url as background_image,
          COALESCE(f.followers_count, 0) AS followers_count,
          COALESCE(f2.following_count,0) as following_count,
          COALESCE(p.posts_count,0) as posts_count
        from
          users u
          -- Seguidores do usuário
          LEFT JOIN (
            SELECT
              lead_user_id,
              COUNT(*) AS followers_count
            FROM user_followers
            GROUP BY lead_user_id
          ) f ON f.lead_user_id = u.id
          -- usuário seguindo
          LEFT JOIN (
            SELECT
              follower_id,
              COUNT(*) AS following_count
            FROM user_followers
            GROUP BY follower_id
          ) f2 ON f2.follower_id = u.id
          -- Posts do Usuario
          LEFT JOIN (
            SELECT
              author_id,
              COUNT(*) AS posts_count
            FROM posts
            GROUP BY author_id
          ) p ON p.author_id = u.id
          -- busca imagens
          left join uploaded_images ui on ui.id = u.avatar_image
          left join uploaded_images ub on ub.id = u.background_image
        where
          LOWER(u.username) = LOWER($1)
        limit
          1`,
      values: [username],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "O username informado não foi encontrado no sistema.",
        action: "Verifique se o username foi digitado corretamente",
      });
    }

    return results.rows[0];
  }
}

function secureUserInterface(selectedUser) {
  if (!selectedUser) {
    return;
  }

  return {
    id: selectedUser.id,
    username: selectedUser.username,
    email: selectedUser.email,
    updated_at: selectedUser.updated_at,
    created_at: selectedUser.created_at,
    followers_count: selectedUser.followers_count,
    following_count: selectedUser.following_count,
    posts_count: selectedUser.posts_count,
    features: selectedUser.features,
    reputation: selectedUser.reputation,
    resumo: selectedUser.resumo,
    bio: selectedUser.bio,
    visibility: selectedUser.visibility,
    avatar_image: selectedUser.avatar_image,
    background_image: selectedUser.background_image,
  };
}

async function findOneByUsernameSecured(username) {
  const user = await findOneByUsername(username);
  return secureUserInterface(user);
}

async function findOneByEmail(email) {
  const userFound = await runSelectQuery(email);
  return userFound;

  async function runSelectQuery(email) {
    const results = await database.query({
      text: `
        select
          *
        from
          users u
        where
          LOWER(u.email) = LOWER($1)
        limit
          1`,
      values: [email],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "O email informado não foi encontrado no sistema.",
        action: "Verifique se o email foi digitado corretamente",
      });
    }

    return results.rows[0];
  }
}

function validateBirthDate(birthDate) {
  if (Number.isNaN(birthDate.getTime())) {
    throw new ValidationError({
      message: "Data de nascimento inválida.",
      action: "Verifique se a data de nascimento foi digitada corretamente",
    });
  }
}

async function validateUniqueEmail(email) {
  const results = await database.query({
    text: `
      select email
      from users u
      where LOWER(u.email) = LOWER($1)`,
    values: [email],
  });
  if (results.rowCount > 0) {
    throw new ValidationError({
      message: "O email informado já está sendo utilizado.",
      action: "Utilize outro email para esta operação.",
    });
  }
}

async function validateUniqueUsename(username) {
  const results = await database.query({
    text: `
      select username
      from users u
      where LOWER(u.username) = LOWER($1)`,
    values: [username],
  });
  if (results.rowCount > 0) {
    throw new ValidationError({
      message: "O usuario informado já está sendo utilizado.",
      action: "Utilize outro username para esta operação.",
    });
  }
}

async function validateUniqueCPF(cpf) {
  const results = await database.query({
    text: `
      select cpf
      from users u
      where u.cpf = $1`,
    values: [cpf],
  });
  if (results.rowCount > 0) {
    throw new ValidationError({
      message: "O cpf informado já está sendo utilizado.",
      action: "Utilize outro cpf para esta operação.",
    });
  }
}

async function hashPasswordInObject(userInputValues) {
  const hashedPassword = await password.hash(userInputValues.password);
  userInputValues.password = hashedPassword;
}

async function setFeatures(userId, features) {
  const updatedUser = await runUpdatedQuery(userId, features);
  return updatedUser;

  async function runUpdatedQuery(userId, features) {
    const results = await database.query({
      text: `
      update
        users
      set
        features = $2,
        updated_at = timezone('utc',now())
      where
        id = $1
      returning
        *
      `,
      values: [userId, features],
    });
    return results.rows[0];
  }
}

async function addFeatures(userId, features) {
  const updatedUser = await runUpdatedQuery(userId, features);
  return updatedUser;

  async function runUpdatedQuery(userId, features) {
    const results = await database.query({
      text: `
      update
        users
      set
        features = array_cat(features,$2),
        updated_at = timezone('utc',now())
      where
        id = $1
      returning
        *
      `,
      values: [userId, features],
    });
    return results.rows[0];
  }
}

async function isFollowingUser(followerId, leaderId) {
  const results = await database.query({
    text: `
      SELECT EXISTS (
        SELECT 1 FROM user_followers
        WHERE follower_id = $1 AND lead_user_id = $2
      ) AS is_following
      `,
    values: [followerId, leaderId],
  });
  return results.rows[0].is_following;
}

async function runUpdatedQuery(userWithNewValues) {
  const results = await database.query({
    text: `
      update
        users
      set
        username = $2,
        email = $3,
        password = $4,
        cpf = $5,
        resumo = $6,
        bio = $7,
        visibility= $8,
        updated_at = timezone('utc',now())
      where
        id = $1
      returning
        *
    `,
    values: [
      userWithNewValues.id,
      userWithNewValues.username,
      userWithNewValues.email,
      userWithNewValues.password,
      userWithNewValues.cpf,
      userWithNewValues.resumo,
      userWithNewValues.bio,
      userWithNewValues.visibility,
    ],
  });
  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "Usuario não encontrado.",
      action: "verifique se os dados enviados estão corretos.",
    });
  }

  return results.rows[0];
}

const DEFAULT_MEMBERS_LIMIT = 20;
const MAX_MEMBERS_LIMIT = 50;
const MAX_MEMBERS_SEARCH_LENGTH = 64;

// O cursor é keyset (created_at + id) para a paginação ser estável mesmo
// quando novos membros entram — ORDER BY RANDOM() (comportamento antigo)
// não permite paginar sem repetir/pular registros.
function encodeMembersCursor(row) {
  return `${row.created_at_cursor}|${row.id}`;
}

function decodeMembersCursor(cursor) {
  if (typeof cursor !== "string") {
    return null;
  }

  const separatorIndex = cursor.lastIndexOf("|");
  if (separatorIndex < 1) {
    return null;
  }

  const createdAt = cursor.slice(0, separatorIndex);
  const id = cursor.slice(separatorIndex + 1);
  if (!createdAt || !id) {
    return null;
  }

  return { createdAt, id };
}

function normalizeMembersLimit(limit) {
  const parsed = Number.parseInt(limit, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_MEMBERS_LIMIT;
  }
  return Math.min(Math.max(parsed, 1), MAX_MEMBERS_LIMIT);
}

// Lista membros com busca e paginação por cursor.
// Retorna { items, total, hasMore, nextCursor }.
async function findUsers(options = {}) {
  const { userId, isfollowing, q } = options;
  const limit = normalizeMembersLimit(options.limit);
  const cursor = decodeMembersCursor(options.cursor);
  const search = typeof q === "string" ? q.trim().slice(0, MAX_MEMBERS_SEARCH_LENGTH) : "";

  // `u.created_at::text` preserva os microssegundos — o driver `pg`
  // converte timestamptz para Date e perderia precisão no cursor.
  const baseQuery = `
      SELECT
        u.id,
        u.username,
        u.created_at,
        u.created_at::text AS created_at_cursor,
        u.reputation,
        ui.secure_url as avatar_image,
        u.resumo,
        u.bio,
        u.visibility,
        ub.secure_url as background_image,
        COALESCE(f.followers_count, 0) AS followers_count,
        COALESCE(p.posts_count, 0) AS posts_count,
        (uf.follower_id IS NOT NULL) AS is_following
      FROM users u
        -- Seguidores do usuário
        LEFT JOIN (
            SELECT
              lead_user_id,
              COUNT(*) AS followers_count
            FROM user_followers
            GROUP BY lead_user_id
          ) f ON f.lead_user_id = u.id
        --Posts do Usuario
        LEFT JOIN (
          SELECT
            author_id,
            COUNT(*) AS posts_count
          FROM posts
          GROUP BY author_id
        ) p ON p.author_id = u.id
        -- Verifica se o usuário atual segue esse usuário
        LEFT JOIN user_followers uf
          ON uf.lead_user_id = u.id
          AND uf.follower_id = $1::uuid
        --busca imagens
        left join uploaded_images ui
          on ui.id = u.avatar_image
        left join uploaded_images ub
          on ub.id = u.background_image
    `;

  // $1 ($1::uuid IS NULL) cobre o caso anônimo, em que o usuário não tem id.
  const conditions = ["($1::uuid IS NULL OR u.id <> $1::uuid)"];
  const whereValues = [userId ?? null];

  if (isfollowing !== undefined) {
    const shouldFollow = isfollowing === true || isfollowing === "true";
    conditions.push(`${shouldFollow ? "" : "NOT "}EXISTS (
          SELECT 1
          FROM user_followers uf2
          WHERE uf2.lead_user_id = u.id
          AND uf2.follower_id = $1::uuid
        )`);
  }

  if (search) {
    whereValues.push(search);
    // strpos em vez de LIKE: o termo é literal, sem semântica de % e _.
    conditions.push(`(
          strpos(lower(u.username), lower($${whereValues.length})) > 0
          OR strpos(lower(COALESCE(u.resumo, '')), lower($${whereValues.length})) > 0
        )`);
  }

  const dataValues = [...whereValues];
  let cursorCondition = "";
  if (cursor) {
    dataValues.push(cursor.createdAt, cursor.id);
    cursorCondition = `
        AND (u.created_at, u.id) < ($${dataValues.length - 1}::timestamptz, $${dataValues.length}::uuid)`;
  }
  // Busca uma linha extra para saber se há próxima página sem heurística.
  dataValues.push(limit + 1);

  const totalResults = await database.query({
    text: `
      SELECT
        COUNT(*)::int AS total
      FROM users u
      WHERE
        ${conditions.join("\n        AND ")}`,
    values: whereValues,
  });

  const results = await database.query({
    text: `
      ${baseQuery}
      WHERE
        ${conditions.join("\n        AND ")}${cursorCondition}
      ORDER BY
        u.created_at DESC,
        u.id DESC
      LIMIT $${dataValues.length}`,
    values: dataValues,
  });

  const hasMore = results.rows.length > limit;
  const items = hasMore ? results.rows.slice(0, limit) : results.rows;
  const nextCursor = hasMore && items.length > 0 ? encodeMembersCursor(items[items.length - 1]) : null;

  return {
    items,
    total: totalResults.rows[0]?.total ?? 0,
    hasMore,
    nextCursor,
  };
}

async function addFollow(followerId, leaderId) {
  const result = await database.query({
    text: `
        INSERT INTO user_followers (follower_id, lead_user_id)
        VALUES ($1, $2)
        ON CONFLICT (follower_id, lead_user_id) DO NOTHING
        RETURNING 'followed' AS action, true as followed
      `,
    values: [followerId, leaderId],
  });

  if (result.rowCount === 0) {
    return { followed: "true", action: "already_following" };
  }
  await notification.createUserNotification({
    user_id: leaderId,
    source_user_id: followerId,
    type: "new_follower",
  });
  return result.rows[0];
}

async function removeFollow(followerId, leaderId) {
  const result = await database.query({
    text: `
      DELETE FROM user_followers
      WHERE follower_id = $1 AND lead_user_id = $2
      RETURNING 'unfollowed' AS action, false as followed
    `,
    values: [followerId, leaderId],
  });

  if (result.rowCount === 0) {
    return { followed: "false", action: "not_following" };
  }

  return result.rows[0];
}

const user = {
  create,
  update,
  //permissions
  setFeatures,
  addFeatures,
  //follow
  addFollow,
  removeFollow,
  //select
  findOneById,
  findOneByUsername,
  findOneByUsernameSecured,
  findOneByEmail,
  findUsers,
  isFollowingUser,
  //Security
  secureUserInterface,
};

export default user;
