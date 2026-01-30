import database from "infra/database";

async function createTool(userInputValues) {
  const createdTool = await runInsertQuery(userInputValues);
  return createdTool;

  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
      Insert into  
        portfolio_tools (name,icon_img) 
      values
        ($1,$2)
      returning
        *`,
      values: [userInputValues.name, userInputValues.icon_img],
    });
    return results.rows[0];
  }
}

async function findAllTool() {
  const selectedTools = await runSelectQuery();
  return selectedTools;

  async function runSelectQuery() {
    const results = await database.query({
      text: `
      select
        id, 
        name,
        icon_img
      from 
        portfolio_tools
        `,
    });
    return results.rows;
  }
}

async function deleteTool(id) {
  const deletedTool = await runDeleteQuery(id);
  return deletedTool;

  async function runDeleteQuery(id) {
    const results = await database.query({
      text: `
      delete from
        portfolio_tools
      where id=$1
      returning
        *`,
      values: [id],
    });
    return results.rows[0];
  }
}

const tool = {
  createTool,
  findAllTool,
  deleteTool,
};

export default tool;
