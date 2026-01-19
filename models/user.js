import database from "infra/database";
import password from "models/password";
import { ValidationError, NotFoundError } from "infra/errors.js";

async function create(userInputValues) {
  await validateUniqueUsename(userInputValues.username);
  await validateUniqueEmail(userInputValues.email);
  await validateUniqueCPF(userInputValues.cpf);
  await hashPasswordInObject(userInputValues);
  injectDefaultFeaturesInObject(userInputValues);

  const newUser = await runInsertQuery(userInputValues);
  return {
    username: newUser.username,
    email: newUser.email,
    id: newUser.id,
    cpf: newUser.cpf,
    features: newUser.features,
    created_at: newUser.created_at,
    updated_at: newUser.updated_at,
    password: newUser.password,
  };

  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
      Insert into 
        users (username,email,password,cpf,features) 
      values
        ($1,$2,$3,$4,$5)
      returning
        *`,
      values: [userInputValues.username, userInputValues.email, userInputValues.password, userInputValues.cpf, userInputValues.features],
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
          resumo,
          bio,
          visibility,
          background_image,
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
          username,
          email,
          updated_at,
          created_at,
          avatar_image,
          cpf,
          password,
          features,
          resumo,
          bio,
          visibility,
          u.background_image,
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
    avatar_image: selectedUser.avatar_image,
    followers_count: selectedUser.followers_count,
    following_count: selectedUser.following_count,
    posts_count: selectedUser.posts_count,
    features: selectedUser.features,
    resumo: selectedUser.resumo,
    bio: selectedUser.bio,
    visibility: selectedUser.visibility,
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

async function isFollowingUser(followerId, leaderId) {
  const isFollowing = await runSelectQuery(followerId, leaderId);
  return isFollowing.isFollowing;

  async function runSelectQuery(followerId, leaderId) {
    const results = await database.query({
      text: `
        select 
          case when exists(
            select 1 from user_followers
            where 
              follower_id = $1
              and lead_user_id = $2
            ) then true
          else
            false
          end as isFollowing
        `,
      values: [followerId, leaderId],
    });
    return results.rows[0];
  }
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
        updated_at = timezone('utc',now())
      where 
        id = $1
      returning
        *
    `,
    values: [userWithNewValues.id, userWithNewValues.username, userWithNewValues.email, userWithNewValues.password, userWithNewValues.cpf],
  });
  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "Usuario não encontrado.",
      action: "verifique se os dados enviados estão corretos.",
    });
  }

  return results.rows[0];
}

async function findUsers(userId, isfollowing) {
  if (userId !== undefined) {
    return await runUserSelectQuery(userId, isfollowing);
  }
  return await runNoUserSelectQuery();

  async function runNoUserSelectQuery() {
    const results = await database.query({
      text: `
      SELECT
        u.id,
        u.username,
        u.avatar_image,
        u.resumo,
        u.bio,
        u.visibility,
        u.background_image,
        COALESCE(f.followers_count, 0) AS followers_count,
        COALESCE(p.posts_count, 0) AS posts_count
      FROM users u
        -- Seguidores do usuário
        LEFT JOIN (
          SELECT
            lead_user_id,
            COUNT(*) AS followers_count
          FROM user_followers
          GROUP BY lead_user_id
        ) f ON f.lead_user_id = u.id
        -- Posts do Usuario
        LEFT JOIN (
          SELECT
            author_id,
            COUNT(*) AS posts_count
          FROM posts
          GROUP BY author_id
        ) p ON p.author_id = u.id
      ORDER BY RANDOM()
      LIMIT 10;
      `,
    });
    return results.rows;
  }

  async function runUserSelectQuery(userId, isfollowing) {
    let baseQuery = `
      SELECT
        u.id,
        u.username,
        u.avatar_image,
        u.resumo,
        u.bio,
        u.visibility,
        u.background_image,
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
          AND uf.follower_id = $1
    `;

    let whereClause = `
        WHERE 
          u.id <> $1
        `;
    if (isfollowing != undefined) {
      whereClause += isfollowing === true || isfollowing === "true" ? " AND " : " AND NOT ";
      whereClause += `
          EXISTS (
          SELECT 1
          FROM user_followers uf2
          WHERE uf2.lead_user_id = u.id
          AND uf2.follower_id = $1
        )
      `;
    }
    let endQuery = `
        ORDER BY 
          RANDOM()
        LIMIT 
          10;`;
    const queryText = baseQuery + whereClause + endQuery;
    console.log(queryText);
    const values = [userId];
    const results = await database.query({
      text: queryText,
      values,
    });
    return results.rows;
  }
}

async function addFollow(followerId, leaderId) {
  const result = await database.query({
    text: `
        INSERT INTO user_followers (follower_id, lead_user_id)
        VALUES ($1, $2)
        ON CONFLICT (follower_id, lead_user_id) DO NOTHING
        RETURNING 'followed' AS action
      `,
    values: [followerId, leaderId],
  });

  if (result.rowCount === 0) {
    return { action: "already_following" };
  }
  return result.rows[0];
}

async function removeFollow(followerId, leaderId) {
  const result = await database.query({
    text: `
      DELETE FROM user_followers
      WHERE follower_id = $1 AND lead_user_id = $2
      RETURNING 'unfollowed' AS action
    `,
    values: [followerId, leaderId],
  });

  if (result.rowCount === 0) {
    return { action: "not_following" };
  }

  return result.rows[0];
}

const user = {
  create,
  update,
  //permissions
  setFeatures,
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
