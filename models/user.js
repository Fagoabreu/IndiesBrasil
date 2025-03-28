import database from "infra/database";
import { ValidationError, NotFoundError } from "infra/errors.js";

async function create(userInputValues) {
  await validateUniqueEmail(userInputValues.email);
  await validateUniqueUsename(userInputValues.username);
  await validateUniqueCPF(userInputValues.cpf);

  const newUser = await runInserQuery(userInputValues);
  return newUser;
}

async function findOneByUsername(username) {
  const userFound = await runSelectQuery(username);
  return userFound;
}

async function runSelectQuery(username) {
  const results = await database.query({
    text: `
      select 
        * 
      from 
        users u 
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
      action: "Utilize outro email para realizar o cadastro.",
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
      action: "Utilize outro usuario para realizar o cadastro.",
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
      action: "Utilize outro cpf para realizar o cadastro.",
    });
  }
}

async function runInserQuery(userInputValues) {
  const results = await database.query({
    text: `
      Insert into 
        users (username,email,password,cpf) 
      values
        ($1,$2,$3,$4)
      returning
        *`,
    values: [
      userInputValues.username,
      userInputValues.email,
      userInputValues.password,
      userInputValues.cpf,
    ],
  });
  return results.rows[0];
}

const user = {
  create,
  findOneByUsername,
};

export default user;
