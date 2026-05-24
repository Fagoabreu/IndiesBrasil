import { InternalServerError } from "@/infra/errors.js";

const availableFeatures = new Set([
  //USER
  "create:user",
  "read:user",
  "read:user:self",
  "update:user",
  "update:user:others",

  //SESSION
  "create:session",
  "read:session",

  //ACTIVATION_TOKEN,
  "read:activation_token",

  //MIGRATION
  "read:migration",
  "create:migration",

  //STATUS
  "read:status",
  "read:status:all",

  //POST
  "create:post",
  "read:post",
  "read:post:all",

  //contact_type,
  "read:contact_type",
  "read:contact_type:all",

  //comment
  "read:comment",
  "read:comment:all",

  //like
  "read:like",

  //tag
  "read:tag:all",
  "count:tag:all",

  //tool
  "read:tool",
  "read:tool:all",

  //profession
  "read:profession:all",
  "read:profession",

  //profile
  "read:profile",
  "read:profile_contact",
  "read:profile_contact:all",
  "read:profile_formacoes",
  "read:profile_formacoes:all",
  "read:profile_history",
  "read:profile_history:all",
  "read:profile_role",
  "read:profile_role:all",
  "read:profile_tool",
  "read:profile_tool:all",

  //follow user
  "read:user_follow",

  //server status
  "read:summary",

  //notification
  "read:user_notifications",
  "read:user_notifications:all",
  "read:post_notifications",
  "read:post_notifications:all",

  //event / calendar
  "read:event",
  "read:event:all",
  "create:event",
  "update:event",
  "delete:event",
  "create:event:rsvp",
  "create:event:invitation",

  //studio / organization
  "read:studio",
  "read:studio:all",
  "create:studio",
  "update:studio",
  "delete:studio",
  "read:studio:member",
  "create:studio:member",
  "delete:studio:member",
  "read:studio:invitation",
  "create:studio:invitation",
  "read:studio:follow",
  "create:studio:follow",

  //game
  "read:game",
  "read:game:all",
  "create:game",
  "update:game",
  "delete:game",
  "create:game:follow",
  "read:game:follow",
  "create:game:review",
  "update:game:review",
]);

function can(user, feature, resource) {
  validateUser(user);
  validateFeature(feature);
  let authorized = false;
  if (user.features.includes(feature)) {
    authorized = true;
  }

  if (feature === "update:user" && resource) {
    authorized = false;
    if (user.id === resource.id || can(user, "update:user:others")) {
      authorized = true;
    }
  }
  return authorized;
}

function filterOutput(user, feature, resource) {
  validateUser(user);
  validateFeature(feature);
  validateResource(resource);
  if (feature === "read:user") {
    return getUserResource(resource);
  }

  if (feature === "read:user:self") {
    if (user.id === resource.id)
      return {
        id: resource.id,
        username: resource.username,
        email: resource.email,
        cpf: resource.cpf,
        features: resource.features,
        created_at: resource.created_at,
        updated_at: resource.updated_at,
        followers_count: resource.followers_count,
        following_count: resource.following_count,
        posts_count: resource.posts_count,
        resumo: resource.resumo,
        bio: resource.bio,
        visibility: resource.visibility,
        avatar_image: resource.avatar_image,
        background_image: resource.background_image,
      };
  }

  if (feature === "read:session") {
    if (user.id === resource.user_id)
      return {
        id: resource.id,
        token: resource.token,
        user_id: resource.user_id,
        created_at: resource.created_at,
        updated_at: resource.updated_at,
        expires_at: resource.expires_at,
      };
  }

  if (feature === "read:activation_token") {
    return {
      id: resource.id,
      user_id: resource.user_id,
      created_at: resource.created_at,
      updated_at: resource.updated_at,
      expires_at: resource.expires_at,
      used_at: resource.used_at,
    };
  }

  if (feature === "read:migration") {
    return resource.map((migration) => {
      return {
        path: migration.path,
        name: migration.name,
        timestamp: migration.timestamp,
      };
    });
  }

  if (feature === "read:status") {
    const output = {
      updated_at: resource.updated_at,
      dependencies: {
        database: {
          max_connections: resource.dependencies.database.max_connections,
          opened_connections: resource.dependencies.database.opened_connections,
        },
      },
    };

    if (can(user, "read:status:all")) {
      output.dependencies.database.version = resource.dependencies.database.version;
    }

    return output;
  }

  if (feature === "read:post") {
    return getPostResource(resource);
  }

  if (feature === "read:post:all") {
    return resource.map((resourceItem) => {
      return getPostResource(resourceItem);
    });
  }

  if (feature === "read:contact_type") {
    return getContactTypeResource(resource);
  }

  if (feature === "read:contact_type:all") {
    return resource.map((resourceItem) => {
      return getContactTypeResource(resourceItem);
    });
  }

  if (feature === "read:comment") {
    return getCommentResource(resource);
  }

  if (feature === "read:comment:all") {
    return resource.map((resourceItem) => {
      return getCommentResource(resourceItem);
    });
  }

  if (feature === "read:like") {
    return {
      liked: resource.liked,
      action: resource.action,
    };
  }

  if (feature === "read:profession:all") {
    return resource.map((resourceItem) => {
      return getProfessionResource(resourceItem);
    });
  }

  if (feature === "read:profession") {
    return getProfessionResource(resource);
  }

  if (feature === "read:summary") {
    return {
      user_accounts: resource.user_accounts,
      posts: resource.posts,
      previous_posts: resource.previous_posts,
      events: resource.events,
      previous_events: resource.previous_events,
    };
  }

  if (feature === "read:tag:all") {
    return resource.map((resourceItem) => {
      return getTagResource(resourceItem);
    });
  }

  if (feature === "count:tag:all") {
    return resource.map((resourceItem) => {
      return getTagCountResource(resourceItem);
    });
  }

  if (feature === "read:tool") {
    return getToolResource(resource);
  }

  if (feature === "read:tool:all") {
    return resource.map((respurceItem) => {
      return getToolResource(respurceItem);
    });
  }

  if (feature === "read:profile") {
    return getProfileResource(resource);
  }

  if (feature === "read:profile_contact") {
    return getProfileContactResource(resource);
  }

  if (feature === "read:profile_contact:all") {
    return resource.map((resourceItem) => {
      return getProfileContactResource(resourceItem);
    });
  }

  if (feature === "read:profile_history") {
    return getProfileHistoryResource(resource);
  }

  if (feature === "read:profile_history:all") {
    return resource.map((resourceItem) => {
      return getProfileHistoryResource(resourceItem);
    });
  }

  if (feature === "read:profile_formacoes") {
    return getProfileFormacoesResource(resource);
  }

  if (feature === "read:profile_formacoes:all") {
    return resource.map((resourceItem) => {
      return getProfileFormacoesResource(resourceItem);
    });
  }

  if (feature === "read:profile_role") {
    return getProfileRoleResource(resource);
  }

  if (feature === "read:profile_role:all") {
    return resource.map((resourceItem) => {
      return getProfileRoleResource(resourceItem);
    });
  }

  if (feature === "read:profile_tool") {
    return getProfileToolResource(resource);
  }

  if (feature === "read:profile_tool:all") {
    return resource.map((resourceItem) => {
      return getProfileToolResource(resourceItem);
    });
  }

  if (feature === "read:profile_images") {
    return getProfileImagesResource(resource);
  }

  if (feature === "read:profile_images:all") {
    return resource.map((resourceItem) => {
      return getProfileImagesResource(resourceItem);
    });
  }

  if (feature === "read:user_follow") {
    return {
      followed: resource.followed,
      action: resource.action,
    };
  }

  if (feature === "read:post_notifications") {
    return getPostNotificationsResource(resource);
  }

  if (feature === "read:post_notifications:all") {
    return resource.map((resourceItem) => {
      return getPostNotificationsResource(resourceItem);
    });
  }

  if (feature === "read:user_notifications") {
    return getUserNotificationsResource(resource);
  }

  if (feature === "read:user_notifications:all") {
    return resource.map((resourceItem) => {
      return getUserNotificationsResource(resourceItem);
    });
  }
}

function getUserResource(resource, showFeatures = true) {
  const userData = {
    id: resource.id,
    username: resource.username,
    features: resource.features,
    created_at: resource.created_at,
    updated_at: resource.updated_at,
    followers_count: resource.followers_count,
    following_count: resource.following_count,
    posts_count: resource.posts_count,
    resumo: resource.resumo,
    bio: resource.bio,
    visibility: resource.visibility,
    avatar_image: resource.avatar_image,
    background_image: resource.background_image,
    is_following: resource.is_following,
  };

  if (!showFeatures) {
    delete userData.features;
  }

  return userData;
}

function getPostResource(resource) {
  return {
    id: resource.id,
    organization_id: resource.organization_id,
    event_id: resource.event_id,
    event_title: resource.event_title,
    event_slug: resource.event_slug,
    content: resource.content,
    img: resource.img,
    created_at: resource.created_at,
    parent_post_id: resource.parent_post_id,
    embed: resource.embed,
    post_img_url: resource.post_img_url,
    author_username: resource.author_username,
    author_avatar_image: resource.author_avatar_image,
    author_avatar_url: resource.author_avatar_url,
    likes_count: resource.likes_count,
    comments_count: resource.comments_count,
    liked_by_user: resource.liked_by_user,
    is_current_user: resource.is_current_user,
  };
}

function getCommentResource(resource) {
  return {
    id: resource.id,
    post_id: resource.post_id,
    created_at: resource.created_at,
    content: resource.content,
    author_username: resource.author_username,
    author_avatar_image: resource.author_avatar_image,
    is_current_user: resource.is_current_user,
  };
}

function getContactTypeResource(resource) {
  return {
    id: resource.id,
    icon_key: resource.icon_key,
    icon_img: resource.icon_img,
  };
}

function getProfessionResource(resource) {
  return {
    name: resource.name,
    icon_img: resource.icon_img,
  };
}

function getTagResource(resource) {
  return {
    id: resource.name,
    name: resource.name,
    created_at: resource.created_at,
  };
}

function getTagCountResource(resource) {
  return {
    name: resource.name,
    usage_count: resource.usage_count,
  };
}

function getToolResource(resource) {
  return {
    id: resource.id,
    name: resource.name,
    icon_img: resource.icon_img,
  };
}

function getProfileResource(resource) {
  return {
    user: getUserResource(resource.user, false),
    historico: resource.historico.map((historicoItem) => {
      return getProfileHistoryResource(historicoItem);
    }),
    formacoes: resource.formacoes.map((formacaoItem) => {
      return getProfileFormacoesResource(formacaoItem);
    }),
    tools: resource.tools.map((toolItem) => {
      return getProfileToolResource(toolItem);
    }),
    contacts: resource.contacts.map((contactItem) => {
      return getProfileContactResource(contactItem);
    }),
    roles: resource.roles.map((roleItem) => {
      return getProfileRoleResource(roleItem);
    }),
  };
}

function getProfileContactResource(resource) {
  return {
    id: resource.id,
    icon_img: resource.icon_img,
    icon_key: resource.icon_key,
    contact_type_id: resource.contact_type_id,
    contact_value: resource.contact_value,
  };
}

function getProfileFormacoesResource(resource) {
  return {
    id: resource.id,
    ordem: resource.ordem,
    nome: resource.nome,
    init_date: resource.init_date,
    end_date: resource.end_date,
    instituicao: resource.instituicao,
  };
}

function getProfileHistoryResource(resource) {
  return {
    id: resource.id,
    ordem: resource.ordem,
    cargo: resource.cargo,
    init_date: resource.init_date,
    end_date: resource.end_date,
    company: resource.company,
    cidade: resource.cidade,
    estado: resource.estado,
    atribuicoes: resource.atribuicoes,
  };
}

function getProfileRoleResource(resource) {
  return {
    portfolio_role_name: resource.portfolio_role_name,
    experience: resource.experience,
    ordem: resource.ordem,
    icon_img: resource.icon_img,
  };
}

function getProfileToolResource(resource) {
  return {
    portfolio_tool_id: resource.portfolio_tool_id,
    experience: resource.experience,
    name: resource.name,
    icon_img: resource.icon_img,
  };
}

function getProfileImagesResource(resource) {
  return {
    avatar_image: resource.avatar_image,
    background_image: resource.background_image,
  };
}

function getUserNotificationsResource(resource) {
  return {
    user_id: resource.user_id,
    type: resource.type,
    source_user_id: resource.source_user_id,
    is_read: resource.is_read,
    created_at: resource.created_at,
    title: resource.title,
    message: resource.message,
  };
}

function getPostNotificationsResource(resource) {
  return {
    user_id: resource.user_id,
    type: resource.type,
    source_user_id: resource.source_user_id,
    post_id: resource.post_id,
    is_read: resource.is_read,
    created_at: resource.created_at,
    title: resource.title,
    message: resource.message,
  };
}

function validateUser(user) {
  if (!user?.features) {
    throw new InternalServerError({
      cause: "É necessário fornecer `user` no model authorization.",
    });
  }
}

function validateFeature(feature) {
  if (!feature || !availableFeatures.has(feature)) {
    throw new InternalServerError({
      cause: "É necessário fornecer uma `feature` conhecida no model authorization.",
    });
  }
}

function validateResource(resource) {
  if (!resource) {
    throw new InternalServerError({
      cause: "É necessário fornecer um `resource` em `authorization.filterOutput`.",
    });
  }
}

const authorization = {
  can,
  filterOutput,
};

export default authorization;
