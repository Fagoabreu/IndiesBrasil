import database from "infra/database";
import user from "./user";
import { NotFoundError } from "@/infra/errors";

async function findByUsername(username) {
  const currentUser = await user.findOneByUsernameSecured(username);

  if (currentUser.visibility !== "public") {
    return {
      user: currentUser,
    };
  }
  const profile_history = await findPortfolioHistoricoByUserId(currentUser.id);
  const profile_study = await findPortfolioFormacaoByPortfolioId(currentUser.id);
  const profile_tools = await findPortfolioToolsByPortfolioId(currentUser.id);
  const profile_contacts = await findContactsByUserId(currentUser.id);

  return {
    user: currentUser,
    historico: profile_history,
    study: profile_study,
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

async function findPortfolioFormacaoByPortfolioId(user_id) {
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

async function patchHistorico(userInputValues) {
  const currentHistory = await selectHistoricoById(userInputValues.id);
  const historyWithNewValues = {
    ...currentHistory,
    ...userInputValues,
  };
  const updatedHistory = await updateHistoricoById(historyWithNewValues);
  return updatedHistory;
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

const profile = {
  findByUsername,
  saveHistorico,
  patchHistorico,
  findPortfolioHistoricoByUserId,
};

export default profile;
