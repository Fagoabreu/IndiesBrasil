import database from "infra/database";

async function createRoles(userInputValues) {
  const createdProfession = await runInsertQuery(userInputValues);
  return createdProfession;

  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
      Insert into 
        portfolio_roles (name,icon_img) 
      values
        ($1,$2)
      returning
        *`,
      values: [userInputValues.name, userInputValues.icon_img],
    });
    return results.rows[0];
  }
}

async function findAllRoles() {
  const portfolioRoles = await runSelectQuery();
  return portfolioRoles;

  async function runSelectQuery() {
    const results = await database.query({
      text: `
      select
        name,
        icon_img
      from 
        portfolio_roles
        `,
    });
    return results.rows;
  }
}

async function deleteRole(name) {
  const deletedPortfolioRole = await runDeleteQuery(name);
  return deletedPortfolioRole;

  async function runDeleteQuery(name) {
    const results = await database.query({
      text: `
      delete from
        portfolio_roles
      where name=$1
      returning
        *`,
      values: [name],
    });
    return results.rows[0];
  }
}

const profession = {
  createRoles,
  findAllRoles,
  deleteRole,
};

export default profession;
