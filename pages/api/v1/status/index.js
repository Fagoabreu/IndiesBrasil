import authorization from "@/models/authorization";
import controller from "infra/controller";
import database from "infra/database.js";
import { createRouter } from "next-connect";

export default createRouter()
  .use(controller.injectAnonymousOrUser)
  .get(getHandler)
  .handler(controller.errorHandlers);

async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const updatedAt = new Date().toISOString();

  const databaseVersionResult = await database.query("SHOW server_version;");
  const databaseVersionValue = databaseVersionResult.rows[0].server_version;

  const databaseMaxConnResult = await database.query("SHOW max_connections;");
  const databaseMaxConnValue = databaseMaxConnResult.rows[0].max_connections;

  const databaseName = process.env.POSTGRES_DB;
  const databaseOpenConnResult = await database.query({
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

  const secureOutputValues = authorization.filterOutput(
    userTryingToGet,
    "read:status",
    statusObject,
  );

  return response.status(200).json(secureOutputValues);
}
