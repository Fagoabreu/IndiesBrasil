import authorization from "@/models/authorization";
import controller from "infra/controller";
import database from "infra/database.js";
import { createRouter } from "next-connect";

export default createRouter().use(controller.injectAnonymousOrUser).get(getHandler).handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const updatedAt = new Date().toISOString();

  // Uma única conexão para todas as consultas: se cada query abrisse e fechasse
  // um Client próprio, a última consulta (count de pg_stat_activity) poderia
  // enxergar o backend da query anterior deste mesmo request ainda em
  // encerramento (teardown assíncrono do Postgres), tornando o valor de
  // opened_connections instável (2 em vez de 1) sob carga.
  const client = await database.getNewClient();
  try {
    const databaseVersionResult = await client.query("SHOW server_version;");
    const databaseVersionValue = databaseVersionResult.rows[0].server_version;

    const databaseMaxConnResult = await client.query("SHOW max_connections;");
    const databaseMaxConnValue = databaseMaxConnResult.rows[0].max_connections;

    const databaseName = process.env.POSTGRES_DB;
    const databaseOpenConnResult = await client.query({
      text: "Select count(*)::int from pg_stat_activity where datname=$1;",
      values: [databaseName],
    });
    const databaseOpenConnValue = databaseOpenConnResult.rows[0].count;

    const statusObject = {
      updated_at: updatedAt,
      dependencies: {
        database: {
          version: databaseVersionValue,
          max_connections: parseInt(databaseMaxConnValue),
          opened_connections: databaseOpenConnValue,
        },
      },
    };

    const secureOutputValues = authorization.filterOutput(userTryingToGet, "read:status", statusObject);

    return response.status(200).json(secureOutputValues);
  } finally {
    await client.end();
  }
}
