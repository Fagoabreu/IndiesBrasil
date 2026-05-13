import database from "infra/database";
import user from "./user";
import { NotFoundError } from "@/infra/errors";
import uploadedImages from "./uploadedImages";

async function canReadProfile(currentUser, readerUser) {
  if (currentUser.id === readerUser.id) {
    return true;
  }
  if (readerUser.features.includes("read:admin")) {
    return true;
  }

  switch (currentUser.visibility) {
    case "public":
      return true;
    case "private":
      return false;
    case "followers":
      return await user.isFollowingUser(readerUser.id, currentUser.id);
  }
  return false;
}

async function findByUsername(username, readerUser) {
  const currentUser = await user.findOneByUsernameSecured(username);
  const readableProfile = await canReadProfile(currentUser, readerUser);

  if (!readableProfile) {
    return {
      user: currentUser,
      historico: [],
      formacoes: [],
      tools: [],
      contacts: [],
      roles: [],
    };
  }
  const profile_history = await findPortfolioHistoricoByUserId(currentUser.id);
  const profile_formacoes = await findPortfolioFormacaoByUserId(currentUser.id);
  const profile_tools = await findPortfolioToolsByPortfolioId(currentUser.id);
  const profile_contacts = await findContactsByUserId(currentUser.id);
  const profile_roles = await findRolesByUserId(currentUser.id);
  const is_following = readerUser?.id ? await user.isFollowingUser(readerUser.id, currentUser.id) : false;

  return {
    user: { ...currentUser, is_following },
    historico: profile_history,
    formacoes: profile_formacoes,
    tools: profile_tools,
    contacts: profile_contacts,
    roles: profile_roles,
  };
}

//Formacao
async function findPortfolioFormacaoByUserId(user_id) {
  const userFound = await runSelectQuery(user_id);
  return userFound;

  async function runSelectQuery(user_id) {
    const results = await database.query({
      text: `
        select
          id,
          user_id,
          ordem,
          nome,
          init_date,
          end_date,
          instituicao
        from 
          portfolio_formacao
        where user_id=$1
          `,
      values: [user_id],
    });
    return results.rows;
  }
}

async function patchFormacoes(user_id, formacao_id, userInputValues) {
  const currentFormacao = await selectFormacaoByUserAndId(user_id, formacao_id);
  const formacaoWithNewValues = {
    ...currentFormacao,
    ...userInputValues,
  };
  const updatedFormacao = await updateFormacao(formacaoWithNewValues);
  return updatedFormacao;
}

async function selectFormacaoByUserAndId(user_id, formacao_id) {
  const selectedFunction = await runSelectQuery(user_id, formacao_id);
  return selectedFunction;

  async function runSelectQuery(user_id, formacao_id) {
    const results = await database.query({
      text: `
        Select
          id,
          ordem,
          nome,
          init_date,
          end_date,
          instituicao,
          created_at,
          user_id
        from
          portfolio_formacao
        where
          user_id=$1
          and id=$2
      `,
      values: [user_id, formacao_id],
    });
    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "A relação de usuario e formação não encontrada.",
        action: "Verifique se os ids foram digitados corretamente",
      });
    }

    return results.rows[0];
  }
}

async function updateFormacao(userInputValues) {
  console.log("formacao update:", userInputValues);
  const updatedFormacao = await runUpdateQuery(userInputValues);
  return updatedFormacao;

  async function runUpdateQuery(userInputValues) {
    const results = await database.query({
      text: `
        UPDATE 
          portfolio_formacao
        SET 
          nome=$3, 
          instituicao=$4,
          init_date=$5, 
          end_date=$6, 
          ordem=$7
        WHERE 
          id=$1
          and user_id=$2
        returning *
      `,
      values: [
        userInputValues.id,
        userInputValues.user_id,
        userInputValues.nome,
        userInputValues.instituicao,
        userInputValues.init_date,
        userInputValues.end_date,
        userInputValues.ordem,
      ],
    });
    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "A relação de usuario e formação não encontrada.",
        action: "Verifique se os ids foram digitados corretamente",
      });
    }

    return results.rows[0];
  }
}

async function saveFormacao(userInputValues) {
  if (userInputValues.id) {
    return;
  }
  return await runInsertQuery(userInputValues);

  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
        insert into portfolio_formacao
        (user_id, ordem, nome, init_date, end_date, instituicao)
        values(
        $1,$2,$3,$4,$5,$6
        )
          `,
      values: [
        userInputValues.user_id,
        userInputValues.ordem,
        userInputValues.nome,
        userInputValues.init_date,
        userInputValues.end_date,
        userInputValues.instituicao,
      ],
    });
    return results.rows;
  }
}

async function deleteFormacaoByUserAndId(user_id, formacao_id) {
  const deletedFormacao = await runDeleteQuery(user_id, formacao_id);
  return deletedFormacao;

  async function runDeleteQuery(user_id, formacao_id) {
    const results = await database.query({
      text: `
        delete from 
          portfolio_formacao
        where 
          user_id=$1
          and id = $2
        returning *
      `,
      values: [user_id, formacao_id],
    });
    return results.rows;
  }
}

//Roles
async function saveRoles(userInputValues) {
  if (userInputValues.id) {
    return;
  }
  return await runInsertQuery(userInputValues);

  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
        insert into portfolio_role_ref
        (user_id, portfolio_role_name, experience, ordem)
        values(
        $1,$2,$3,$4
        )
          `,
      values: [userInputValues.user_id, userInputValues.name, userInputValues.experience, userInputValues.ordem],
    });
    return results.rows;
  }
}

async function saveImages(userInputValues) {
  const currentImages = await runSelectQuery(userInputValues.user_id);
  const imagesNewValues = {
    ...currentImages,
    ...userInputValues,
  };
  const updatedImages = await runUpdateQuery(imagesNewValues);
  console.log("Updated images:", updatedImages);
  return updatedImages;

  async function runSelectQuery(user_id) {
    const results = await database.query({
      text: `
        select
          id as user_id,
          avatar_image,
          background_image
        from
          users
        where id=$1
        `,
      values: [user_id],
    });
    return results.rows[0];
  }

  async function runUpdateQuery(imagesNewValues) {
    const results = await database.query({
      text: `
        update users
        set
          avatar_image=$1,
          background_image=$2
        where id=$3
          returning id as user_id, avatar_image, background_image
        `,
      values: [imagesNewValues.avatar_image, imagesNewValues.background_image, imagesNewValues.user_id],
    });
    return results.rows[0];
  }
}

async function patchRoles(user_id, portfolio_role_name, userInputValues) {
  const currentRole = await selectRoleByUserAndRole(user_id, portfolio_role_name);
  const roleWithNewValues = {
    ...currentRole,
    ...userInputValues,
  };
  const updatedRole = await updateRoleByUserAndTool(roleWithNewValues);
  return updatedRole;
}

async function selectRoleByUserAndRole(user_id, portfolio_role_name) {
  const foundRole = await runSelectQuery(user_id, portfolio_role_name);
  return foundRole;

  async function runSelectQuery(user_id, portfolio_role_name) {
    const results = await database.query({
      text: `
        Select
          user_id,
          portfolio_role_name,
          experience,
          ordem
        from 
          portfolio_role_ref
        where
          user_id=$1
          and portfolio_role_name=$2
      `,
      values: [user_id, portfolio_role_name],
    });
    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "A relação de usuario e cargo não encontrada.",
        action: "Verifique se os ids foram digitados corretamente",
      });
    }

    return results.rows[0];
  }
}

async function updateRoleByUserAndTool(userInputValues) {
  const updatedRole = await runUpdateQuery(userInputValues);
  return updatedRole;

  async function runUpdateQuery(userInputValues) {
    const results = await database.query({
      text: `
        Update
          portfolio_role_ref
        set
          experience=$3,
          ordem=$4
        where
          user_id=$1
          and portfolio_role_name=$2
        returning *
      `,
      values: [userInputValues.user_id, userInputValues.portfolio_role_name, userInputValues.experience, userInputValues.ordem],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "A relação de usuario e cargo não encontrada.",
        action: "Verifique se os ids foram digitados corretamente",
      });
    }

    return results.rows[0];
  }
}

async function findRolesByUserId(user_id) {
  const rolesFound = await runSelectQuery(user_id);
  return rolesFound;

  async function runSelectQuery(user_id) {
    const results = await database.query({
      text: `
        select
          prr.user_id,
          prr.portfolio_role_name,
          prr.experience,
          prr.ordem,
          pr.icon_img
        from 
          portfolio_role_ref prr
          inner join portfolio_roles pr
          on pr.name = prr.portfolio_role_name
        where prr.user_id=$1
          `,
      values: [user_id],
    });
    return results.rows;
  }
}

async function deleteRoleByUserAndRole(user_id, portfolio_role_name) {
  const roleDeleted = await runDeleteQuery(user_id, portfolio_role_name);
  return roleDeleted;

  async function runDeleteQuery(user_id, portfolio_role_name) {
    const results = await database.query({
      text: `
        delete from 
          portfolio_role_ref
        where 
          user_id=$1
          and portfolio_role_name = $2
        returning *
      `,
      values: [user_id, portfolio_role_name],
    });
    return results.rows;
  }
}

//Historico
async function findPortfolioHistoricoByUserId(user_id) {
  const userFound = await runSelectQuery(user_id);
  return userFound;

  async function runSelectQuery(user_id) {
    const results = await database.query({
      text: `
        select
          ph.id,
          ph.user_id,
          ph.ordem,
          ph.cargo,
          ph.init_date,
          ph.end_date,
          ph.company,
          ph.cidade,
          ph.estado,
          ph.atribuicoes
        from 
          portfolio_historico ph
        where ph.user_id=$1
          `,
      values: [user_id],
    });
    return results.rows;
  }
}

async function saveHistorico(userInputValues) {
  if (userInputValues.id) {
    return;
  }
  return await runInsertQuery(userInputValues);

  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
        insert into portfolio_historico
        (user_id, ordem, company, cargo, init_date, end_date, cidade, estado, atribuicoes)
        values(
        $1,$2,$3,$4,$5,$6,$7,$8,$9
        )
          `,
      values: [
        userInputValues.user_id,
        userInputValues.ordem,
        userInputValues.company,
        userInputValues.cargo,
        userInputValues.init_date,
        userInputValues.end_date,
        userInputValues.cidade,
        userInputValues.estado,
        userInputValues.atribuicoes,
      ],
    });
    return results.rows;
  }
}

async function patchHistorico(userInputValues) {
  const currentHistory = await selectHistoricoById(userInputValues.id);
  const historyWithNewValues = {
    ...currentHistory,
    ...userInputValues,
  };
  const updatedHistory = await updateHistoricoById(historyWithNewValues);
  return updatedHistory;
}

async function deleteHistoricoById(historico_id) {
  const userFound = await runDeleteQuery(historico_id);
  return userFound;

  async function runDeleteQuery(historico_id) {
    const results = await database.query({
      text: `
        delete from 
          portfolio_historico ph
        where ph.id=$1
      `,
      values: [historico_id],
    });
    return results.rows;
  }
}

async function selectHistoricoById(historicoId) {
  const selectedHistory = await runselectQuery(historicoId);
  return selectedHistory;

  async function runselectQuery(historicoId) {
    const results = await database.query({
      text: `
      select 
        id,
        user_id, 
        ordem, 
        company, 
        cargo, 
        init_date, 
        end_date, 
        cidade, 
        estado, 
        atribuicoes
      from 
        portfolio_historico
      where id = $1
        `,
      values: [historicoId],
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

async function updateHistoricoById(userInputValues) {
  const selectedHistory = await runUpdateQuery(userInputValues);
  return selectedHistory;

  async function runUpdateQuery(userInputValues) {
    const results = await database.query({
      text: `
      update 
        portfolio_historico
      set 
        user_id=$2, 
        ordem=$3, 
        company=$4, 
        cargo=$5, 
        init_date=$6, 
        end_date=$7, 
        cidade=$8, 
        estado=$9, 
        atribuicoes=$10
      where 
        id = $1
      returning *
        `,
      values: [
        userInputValues.id,
        userInputValues.user_id,
        userInputValues.ordem,
        userInputValues.company,
        userInputValues.cargo,
        userInputValues.init_date,
        userInputValues.end_date,
        userInputValues.cidade,
        userInputValues.estado,
        userInputValues.atribuicoes,
      ],
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

//Contato
async function findContactsByUserId(user_id) {
  const userFound = await runSelectQuery(user_id);
  return userFound;

  async function runSelectQuery(user_id) {
    const results = await database.query({
      text: `
        select
          uc.id,
          uc.user_id,
          uc.contact_value,
          uc.contact_type_id,
          ct.icon_img,
          ct.icon_key
        from 
          users_contacts uc
          inner join contact_type ct
          on ct.id = uc.contact_type_id
        where uc.user_id=$1
          `,
      values: [user_id],
    });
    return results.rows;
  }
}

async function saveContato(userInputValues) {
  if (userInputValues.id) {
    return;
  }
  return await runInsertQuery(userInputValues);

  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
        insert into users_contacts
        (user_id, contact_value, contact_type_id)
        values(
        $1,$2,$3
        )
          `,
      values: [userInputValues.user_id, userInputValues.contact_value, userInputValues.contact_type_id],
    });
    return results.rows;
  }
}

async function patchContacts(userInputValues) {
  const currentContact = await selectContatoById(userInputValues.id);
  const contactWithNewValues = {
    ...currentContact,
    ...userInputValues,
  };
  const updatedContact = await updateContatoById(contactWithNewValues);
  return updatedContact;
}

async function selectContatoById(contatoId) {
  const selectedContact = await runselectQuery(contatoId);
  return selectedContact;

  async function runselectQuery(contatoId) {
    const results = await database.query({
      text: `
      select 
        id,
        user_id, 
        contact_type_id, 
        contact_value
      from 
        users_contacts
      where id = $1
        `,
      values: [contatoId],
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

async function updateContatoById(userInputValues) {
  const updatedContact = await runUpdateQuery(userInputValues);
  return updatedContact;

  async function runUpdateQuery(userInputValues) {
    const results = await database.query({
      text: `
      update 
        users_contacts
      set 
        user_id=$2, 
        contact_type_id=$3, 
        contact_value=$4
      where 
        id = $1
      returning *
        `,
      values: [userInputValues.id, userInputValues.user_id, userInputValues.contact_type_id, userInputValues.contact_value],
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

async function deleteContatoById(contact_id) {
  const userFound = await runDeleteQuery(contact_id);
  return userFound;

  async function runDeleteQuery(contact_id) {
    const results = await database.query({
      text: `
        delete from 
          users_contacts uc
        where uc.id=$1
        returning *
      `,
      values: [contact_id],
    });
    return results.rows;
  }
}

//Tool
async function findPortfolioToolsByPortfolioId(user_id) {
  const userFound = await runSelectQuery(user_id);
  return userFound;

  async function runSelectQuery(user_id) {
    const results = await database.query({
      text: `
        select
          ptf.user_id,
          ptf.portfolio_tool_id,
          ptf.experience,
          pt.name,
          pt.icon_img
        from 
          portfolio_tool_ref ptf
          inner join portfolio_tools pt
            on pt.id=ptf.portfolio_tool_id
        where ptf.user_id=$1
          `,
      values: [user_id],
    });
    return results.rows;
  }
}

async function saveTools(userInputValues) {
  if (userInputValues.id) {
    return;
  }
  return await runInsertQuery(userInputValues);

  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
        insert into portfolio_tool_ref
        (user_id, portfolio_tool_id, experience)
        values(
        $1,$2,$3
        )
          `,
      values: [userInputValues.user_id, userInputValues.portfolio_tool_id, userInputValues.experience],
    });
    return results.rows;
  }
}

async function patchTools(user_id, portfolio_tool_id, userInputValues) {
  const currentTool = await selectToolByUserAndTool(user_id, portfolio_tool_id);
  console.log(currentTool);
  const toolWithNewValues = {
    ...currentTool,
    ...userInputValues,
  };
  const updatedContact = await updateToolByUserAndTool(toolWithNewValues);
  return updatedContact;
}

async function selectToolByUserAndTool(user_id, portfolio_tool_id) {
  const toolFound = await runSelectQuery(user_id, portfolio_tool_id);
  return toolFound;

  async function runSelectQuery(user_id, portfolio_tool_id) {
    const results = await database.query({
      text: `
        Select
          portfolio_tool_id,
          user_id,
          experience
        from 
          portfolio_tool_ref
        where
          user_id=$1
          and portfolio_tool_id=$2
      `,
      values: [user_id, portfolio_tool_id],
    });
    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "A relação de usuario e ferramenta não encontrada.",
        action: "Verifique se os ids foram digitados corretamente",
      });
    }

    return results.rows[0];
  }
}

async function updateToolByUserAndTool(userInputValues) {
  const selectedTool = await runUpdateQuery(userInputValues);
  return selectedTool;

  async function runUpdateQuery(userInputValues) {
    const results = await database.query({
      text: `
      update 
        portfolio_tool_ref
      set 
        experience = $3
      where 
        user_id = $1
        and portfolio_tool_id = $2
      returning *
        `,
      values: [userInputValues.user_id, userInputValues.portfolio_tool_id, userInputValues.experience],
    });
    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "Os ids informados não foi encontrado no sistema.",
        action: "Verifique se os ids foram digitados corretamente",
      });
    }

    return results.rows[0];
  }
}

async function deleteToolByUserAndTool(user_id, portfolio_tool_id) {
  const userDeleted = await runDeleteQuery(user_id, portfolio_tool_id);
  return userDeleted;

  async function runDeleteQuery(user_id, portfolio_tool_id) {
    const results = await database.query({
      text: `
        delete from 
          portfolio_tool_ref
        where 
          user_id=$1
          and portfolio_tool_id = $2
        returning *
      `,
      values: [user_id, portfolio_tool_id],
    });
    return results.rows;
  }
}

const profile = {
  findByUsername,
  findPortfolioHistoricoByUserId,
  findPortfolioFormacaoByUserId,
  findPortfolioToolsByPortfolioId,
  findContactsByUserId,
  findRolesByUserId,

  saveHistorico,
  saveFormacao,
  saveContato,
  saveTools,
  saveRoles,
  saveImages,

  patchHistorico,
  patchContacts,
  patchTools,
  patchRoles,
  patchFormacoes,

  deleteHistoricoById,
  deleteContatoById,
  deleteToolByUserAndTool,
  deleteRoleByUserAndRole,
  deleteFormacaoByUserAndId,
};

export default profile;
