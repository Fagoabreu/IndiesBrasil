import controller from "infra/controller";
import database from "infra/database.js";
import { createRouter } from "next-connect";

const router = createRouter();

router.get(getHandler);
export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
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

  response.status(200).json({
    updated_at: updatedAt,
    dependencies: {
      database: {
        version: databaseVersionValue,
        max_connections: parseInt(databaseMaxConnValue),
        opened_connections: databaseOpenConnValue,
      },
    },
  });
}
