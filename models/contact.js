import database from "infra/database";

async function createType(userInputValues) {
  const createdContactType = await runInsertQuery(userInputValues);
  return createdContactType;

  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
      Insert into 
        contact_type (icon_key,icon_img) 
      values
        ($1,$2)
      returning
        *`,
      values: [userInputValues.icon_key, userInputValues.icon_img],
    });
    return results.rows[0];
  }
}

async function findAllType() {
  const contactType = await runSelectQuery();
  return contactType;

  async function runSelectQuery() {
    const results = await database.query({
      text: `
      select
        id, 
        icon_key,
        icon_img
      from 
        contact_type
        `,
    });
    return results.rows;
  }
}

async function deleteType(id) {
  const deletedContactType = await runDeleteQuery(id);
  return deletedContactType;

  async function runDeleteQuery(id) {
    const results = await database.query({
      text: `
      delete from
        contact_type
      where id=$1
      returning
        *`,
      values: [id],
    });
    return results.rows[0];
  }
}

const contact = {
  createType,
  findAllType,
  deleteType,
};

export default contact;
