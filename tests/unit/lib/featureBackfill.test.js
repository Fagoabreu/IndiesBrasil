import fs from "node:fs";
import path from "node:path";

/**
 * Feature nova exige **backfill**.
 *
 * `models/activation.js` só vale para quem se ativa depois do release. Quem já
 * tinha `create:session` continua com o array antigo no banco — e as rotas
 * passam a responder 403 para essa pessoa.
 *
 * Foi o que aconteceu com serviços, profissões e gêneros de jogo: entraram sem
 * migration de backfill, e o editor de serviços do estúdio não carregava o
 * catálogo (`GET /api/v1/services` → 403). O sintoma parecia "a página quebrou",
 * porque o 403 era invisível para a tela.
 *
 * Este teste lê os arquivos e falha quando uma dessas features não aparece em
 * nenhuma migration. É a trava que faltou nos três releases.
 */
const REPO_ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(REPO_ROOT, "infra", "migrations");

function allMigrationSource() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".js"))
    .map((file) => fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"))
    .join("\n");
}

function activationSource() {
  return fs.readFileSync(path.join(REPO_ROOT, "models", "activation.js"), "utf8");
}

/**
 * Features que só existem na concessão de ativação por serem anteriores ao
 * sistema de backfill (contas antigas já as tinham na criação), ou porque são
 * de leitura pública e não precisam de vínculo em `users.features`.
 */
const BASELINE = new Set([
  "create:session",
  "read:session",
  "create:user",
  "read:user",
  "update:user",
  "read:activation_token",
  "read:post",
  "create:post",
  "create:game:like",
  "create:game:comment",
  "create:boardgame:like",
  "create:boardgame:comment",
  "create:book:like",
  "create:book:comment",
  "read:course",
  "create:course",
  "update:course",
  "delete:course",
  "read:course:lesson",
  "create:course:lesson",
  "update:course:lesson",
  "delete:course:lesson",
  "create:course:rating",
  "read:course:rating",
  "create:course:progress",
  "read:course:progress",
  "read:course:comment",
  "create:course:comment",
  "create:course:enrollment",
  "read:course:enrollment",
  "create:report",
  "read:store",
  "create:store:product",
  "update:store:product",
  "delete:store:product",
  "create:store:order",
  "read:store:order",
  "update:store:order",
  "create:address",
  "read:address",
  "update:address",
  "delete:address",
]);

function featuresFromActivation() {
  const source = activationSource();
  const setFeatures = source.slice(source.indexOf("setFeatures"));
  return [...new Set([...setFeatures.matchAll(/"([a-z_]+:[a-z_:]+)"/g)].map((match) => match[1]))];
}

describe("Backfill de features", () => {
  const migrations = allMigrationSource();
  const features = featuresFromActivation();

  test("toda feature de ativação aparece em alguma migration ou no baseline", () => {
    const missing = features.filter((feature) => !BASELINE.has(feature) && !migrations.includes(`'${feature}'`));

    expect(missing).toEqual([]);
  });

  test("as features de serviços, profissões e gêneros têm backfill", () => {
    // O grupo que entrou sem migration. Listado à parte para a falha dizer qual
    // seção ficou de fora, em vez de só "faltou X".
    const required = [
      "read:service",
      "read:service:all",
      "create:service_suggestion",
      "create:profession_suggestion",
      "read:game_genre",
      "read:game_genre:all",
      "create:game_genre_suggestion",
      "create:game_tag",
    ];

    const missing = required.filter((feature) => !migrations.includes(`'${feature}'`));

    expect(missing).toEqual([]);
  });

  test("a ativação lista as mesmas features que as migrations concedem", () => {
    // Nome digitado errado numa das pontas deixaria a feature sem concessão em
    // um dos caminhos (novo usuário x conta antiga).
    for (const feature of ["read:service:all", "create:profession_suggestion", "read:game_genre:all"]) {
      expect(features).toContain(feature);
      expect(migrations).toContain(`'${feature}'`);
    }
  });
});
