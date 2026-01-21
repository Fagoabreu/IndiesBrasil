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
const profile = {
  findByUsername,
};

export default profile;
