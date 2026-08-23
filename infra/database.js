import { Client } from "pg";
import { ServiceError } from "./errors.js";
import fs from "fs";

async function query(queryObject) {
  let client;
  try {
    client = await getNewClient();
    const result = await client.query(queryObject);
    return result;
  } catch (error) {
    const serviceErrorObject = new ServiceError({
      message: "Erro na conexão com Banco ou na Query.",
      cause: error,
    });
    throw serviceErrorObject;
  } finally {
    await client?.end();
  }
}

async function getNewClient() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    ssl: getSSLValues(),
  });

  await client.connect();
  return client;
}

/**
 * Executa `callback` dentro de uma transação com um cliente dedicado.
 *
 * O callback recebe o cliente e pode executar múltiplas queries de forma
 * atômica. Erros lançados dentro do callback fazem ROLLBACK e são
 * propagados como o erro original (sem envolver em ServiceError), para que
 * controllers consigam tratar erros de domínio (ValidationError,
 * NotFoundError, ...) corretamente.
 */
async function transaction(callback) {
  const client = await getNewClient();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

const database = {
  query,
  getNewClient,
  transaction,
};

export default database;

function getSSLValues() {
  // PRODUÇÃO com CA explícita
  if (process.env.NODE_ENV === "production" && process.env.POSTGRES_CA_PATH) {
    return {
      ca: fs.readFileSync(process.env.POSTGRES_CA_PATH),
      rejectUnauthorized: true,
    };
  }

  // PRODUÇÃO sem CA (self-signed)
  if (process.env.NODE_ENV === "production") {
    return {
      rejectUnauthorized: false,
    };
  }

  // DEV e TESTES default
  return false;
}
