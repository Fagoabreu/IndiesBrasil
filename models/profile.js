import database from "infra/database";
import user from "./user";

async function findByUsername(username) {
  const currentUser = await user.findOneByUsernameSecured(username);

  if (!profile || profile.private) {
    return {
      user: currentUser,
    };
  }
  const profile_history = await findPortfolioHistoricoByPortfolioId(profile.id);
  const profile_study = await findPortfolioFormacaoByPortfolioId(profile.id);
  const profile_tools = await findPortfolioToolsByPortfolioId(profile.id);

  return {
    user: currentUser,
    profile: profile,
    history: profile_history,
    study: profile_study,
    tools: profile_tools,
  };
}

async function findPortfolioHistoricoByPortfolioId(user_id) {
  const userFound = await runSelectQuery(user_id);
  return userFound;

  async function runSelectQuery(user_id) {
    const results = await database.query({
      text: `
        select
          ph.id,
          ph.portfolio_id
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
          portfolio_id,
          ordem,
          nome,
          init_date,
          end_date,
          instituicao
        from 
          portfolio_formacao
        where p.user_id=$1
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
          ptf.portfolio_id,
          ptf.portfolio_tool_id,
          ptf.experience
          pt.name,
        from 
          portfolio_tool_ref ptf
          inner join portfolio_tool pt
            on pt.id=ptf.portfolio_tool_id
        where p.user_id=$1
          `,
      values: [user_id],
    });
    return results.rows;
  }
}

async function update(username, profileInputValues) {
  const updatedUser = await user.update(username, profileInputValues.user);

  return {
    user: updatedUser,
  };
}

const profile = {
  findByUsername,
  update,
};

export default profile;
