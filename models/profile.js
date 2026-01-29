import database from "infra/database";
import user from "./user";
import { NotFoundError } from "@/infra/errors";

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

  return {
    user: currentUser,
    historico: profile_history,
    formacoes: profile_formacoes,
    tools: profile_tools,
    contacts: profile_contacts,
    roles: [],
  };
}

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
          pt.name
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

async function patchHistorico(userInputValues) {
  const currentHistory = await selectHistoricoById(userInputValues.id);
  const historyWithNewValues = {
    ...currentHistory,
    ...userInputValues,
  };
  const updatedHistory = await updateHistoricoById(historyWithNewValues);
  return updatedHistory;
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
      `,
      values: [contact_id],
    });
    return results.rows;
  }
}

const profile = {
  findByUsername,
  findPortfolioHistoricoByUserId,
  saveHistorico,
  patchHistorico,
  deleteHistoricoById,
  findPortfolioFormacaoByUserId,
  saveFormacao,
  saveContato,
  patchContacts,
  deleteContatoById,
};

export default profile;
