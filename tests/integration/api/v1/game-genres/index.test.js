import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import { createAdminUser } from "tests/helpers/testUtils";
import organization from "models/organization";
import game from "models/game";

/**
 * Catálogo de gêneros de jogo (gênero › subgênero).
 *
 * O que este arquivo fixa, e por quê:
 *
 *  - **O filtro é hierárquico**: filtrar por "Ação" acha o jogo marcado só com
 *    "Shooter". Era o defeito original — o filtro comparava a frase inteira de
 *    texto livre (`g.genre = $1`) e não achava nada.
 *  - **Gênero em uso não é excluído, é desativado**: `DELETE` responde 400 com a
 *    contagem. Cascata apagaria a classificação de jogos existentes.
 *  - **Renomear alcança os jogos** (`ON UPDATE CASCADE`): sem isso a alteração
 *    valeria só para cadastros novos e os vínculos antigos apontariam para um
 *    nome inexistente.
 *  - **`?tag=` é exato e `?q=` casa trecho**: o clique no chip e a busca livre são
 *    perguntas diferentes, como `?profession=` em `/membros`.
 */
const origin = webserver.origin;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("Gêneros de jogo", () => {
  let ownerToken;
  let adminToken;
  let studio;
  let owner;
  let actionGame;
  let casualGame;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoGeneros",
      email: "dono.generos@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 94123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const adminCtx = await createAdminUser({
      username: "AdminGeneros",
      email: "admin.generos@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 94123456702,
    });
    adminToken = adminCtx.sessionToken;

    studio = await organization.create(owner, { name: "Estúdio Gêneros" });

    actionGame = await game.create(studio.id, owner.id, {
      name: "Jogo de Tiro",
      genre_names: ["Shooter"],
      tag_names: ["2D Topdown", "Multiplayer"],
      stage: "concept",
    });

    casualGame = await game.create(studio.id, owner.id, {
      name: "Jogo Tranquilo",
      genre_names: ["Casual e Party"],
      tag_names: ["Cozy"],
      stage: "concept",
    });
  });

  describe("GET /api/v1/game-genres", () => {
    test("Visitante lê o catálogo em árvore", async () => {
      const response = await fetch(`${origin}/api/v1/game-genres`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);

      // Todo item de primeiro nível é gênero: nada vem com `parent_name`.
      expect(body.every((node) => node.parent_name === null)).toBe(true);
      expect(body.every((node) => Array.isArray(node.children))).toBe(true);

      const action = body.find((node) => node.name === "Ação");
      expect(action).toBeDefined();

      // "Ação" é gênero E tem subgêneros: os dois são linkáveis, por isso o pai
      // não é um agrupamento invisível.
      expect(action.children.map((child) => child.name)).toContain("Shooter");
      expect(action.children.every((child) => child.parent_name === "Ação")).toBe(true);
    });

    test("`?flat=true` devolve a lista plana com `parent_name`", async () => {
      const response = await fetch(`${origin}/api/v1/game-genres?flat=true`);
      expect(response.status).toBe(200);

      const body = await response.json();
      const shooter = body.find((node) => node.name === "Shooter");

      expect(shooter.parent_name).toBe("Ação");
      expect(shooter).not.toHaveProperty("children");
    });

    test("`usage_count` conta só os jogos vinculados", async () => {
      const response = await fetch(`${origin}/api/v1/game-genres?flat=true`);
      const body = await response.json();

      expect(body.find((node) => node.name === "Shooter").usage_count).toBe(1);
      expect(body.find((node) => node.name === "Ação").usage_count).toBe(0);
    });

    test("Visitante não vê gêneros desativados", async () => {
      const response = await fetch(`${origin}/api/v1/game-genres?include_inactive=true`);
      // 403 porque `include_inactive` é pedido explícito, não um filtro qualquer.
      expect(response.status).toBe(403);
    });

    test("Admin vê gêneros desativados com `include_inactive`", async () => {
      await fetch(`${origin}/api/v1/game-genres/${encodeURIComponent("Stealth")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
        body: JSON.stringify({ is_active: false }),
      });

      const anonymous = await fetch(`${origin}/api/v1/game-genres?flat=true`);
      const anonymousBody = await anonymous.json();
      expect(anonymousBody.some((node) => node.name === "Stealth")).toBe(false);

      const admin = await fetch(`${origin}/api/v1/game-genres?flat=true&include_inactive=true`, {
        headers: authHeaders(adminToken),
      });
      const adminBody = await admin.json();
      const stealth = adminBody.find((node) => node.name === "Stealth");
      expect(stealth).toBeDefined();
      expect(stealth.is_active).toBe(false);

      // Reativa para não contaminar os testes seguintes.
      await fetch(`${origin}/api/v1/game-genres/${encodeURIComponent("Stealth")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
        body: JSON.stringify({ is_active: true }),
      });
    });
  });

  describe("Filtro da listagem", () => {
    test("Filtrar pelo gênero pai acha o jogo marcado com o subgênero", async () => {
      const response = await fetch(`${origin}/api/v1/games?genre=${encodeURIComponent("Ação")}`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.map((item) => item.slug)).toContain(actionGame.slug);
      // O jogo de outro gênero não entra: o filtro não pode virar "todos".
      expect(body.map((item) => item.slug)).not.toContain(casualGame.slug);
    });

    test("Filtrar pelo subgênero também acha", async () => {
      const response = await fetch(`${origin}/api/v1/games?genre=${encodeURIComponent("Shooter")}`);
      const body = await response.json();

      expect(body.map((item) => item.slug)).toContain(actionGame.slug);
    });

    test("A listagem devolve `genre` (pai) e `tags`", async () => {
      const response = await fetch(`${origin}/api/v1/games?search=Tiro`);
      const body = await response.json();

      expect(body[0].genre).toBe("Ação");
      expect(body[0].tags).toEqual(["2d topdown", "multiplayer"]);
    });

    test("`?tag=` é valor exato", async () => {
      const exact = await fetch(`${origin}/api/v1/games?tag=${encodeURIComponent("multiplayer")}`);
      const exactBody = await exact.json();
      expect(exactBody.map((item) => item.slug)).toEqual([actionGame.slug]);

      // "multi" não é tag: o filtro do chip compara o nome inteiro.
      const partial = await fetch(`${origin}/api/v1/games?tag=multi`);
      const partialBody = await partial.json();
      expect(partialBody).toHaveLength(0);
    });

    test("`?q=` casa trecho de tag", async () => {
      const response = await fetch(`${origin}/api/v1/games?search=multiplay`);
      const body = await response.json();

      expect(body.map((item) => item.slug)).toContain(actionGame.slug);
    });
  });

  describe("Escrita no catálogo (admin)", () => {
    test("Visitante não cria gênero", async () => {
      const response = await fetch(`${origin}/api/v1/game-genres`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Gênero de Visitante" }),
      });
      expect(response.status).toBe(403);
    });

    test("Admin cria gênero de primeiro nível", async () => {
      const response = await fetch(`${origin}/api/v1/game-genres`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
        body: JSON.stringify({ name: "Gênero Novo", description: "Só para o teste", display_order: 999 }),
      });
      expect(response.status).toBe(201);

      const body = await response.json();
      expect(body.name).toBe("Gênero Novo");
      expect(body.parent_name).toBeNull();
      expect(body.usage_count).toBe(0);
    });

    test("Admin cria subgênero", async () => {
      const response = await fetch(`${origin}/api/v1/game-genres`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
        body: JSON.stringify({ name: "Subgênero Novo", parent_name: "Gênero Novo" }),
      });
      expect(response.status).toBe(201);
      expect((await response.json()).parent_name).toBe("Gênero Novo");
    });

    test("Nome repetido (sem caixa/acento) responde 400 dizendo qual", async () => {
      const response = await fetch(`${origin}/api/v1/game-genres`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
        body: JSON.stringify({ name: "acao" }),
      });
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.message).toContain("Ação");
    });

    test("Hierarquia tem dois níveis: filho de subgênero é recusado", async () => {
      const response = await fetch(`${origin}/api/v1/game-genres`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
        body: JSON.stringify({ name: "Neto", parent_name: "Subgênero Novo" }),
      });
      expect(response.status).toBe(400);
      expect((await response.json()).message).toContain("já é um subgênero");
    });

    test("Pai inexistente é recusado", async () => {
      const response = await fetch(`${origin}/api/v1/game-genres`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
        body: JSON.stringify({ name: "Órfão", parent_name: "Não Existe" }),
      });
      expect(response.status).toBe(400);
    });

    test("Renomear leva a mudança aos jogos vinculados", async () => {
      const create = await fetch(`${origin}/api/v1/game-genres`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
        body: JSON.stringify({ name: "Roguelike de Teste", parent_name: "RPG" }),
      });
      expect(create.status).toBe(201);

      const linked = await game.create(studio.id, owner.id, {
        name: "Jogo Renomeado",
        genre_names: ["Roguelike de Teste"],
        stage: "concept",
      });

      const rename = await fetch(`${origin}/api/v1/game-genres/${encodeURIComponent("Roguelike de Teste")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(adminToken) },
        body: JSON.stringify({ name: "Roguelike Renomeado" }),
      });
      expect(rename.status).toBe(200);

      const detail = await fetch(`${origin}/api/v1/games/${linked.slug}`);
      const detailBody = await detail.json();

      // Sem `ON UPDATE CASCADE` o vínculo antigo continuaria apontando para um
      // nome que não existe mais no catálogo.
      expect(detailBody.genres.map((node) => node.name)).toEqual(["Roguelike Renomeado"]);
    });

    test("Excluir gênero em uso responde 400 com a contagem", async () => {
      const response = await fetch(`${origin}/api/v1/game-genres/${encodeURIComponent("Shooter")}`, {
        method: "DELETE",
        headers: authHeaders(adminToken),
      });
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.message).toContain("1 jogo");
    });

    test("Excluir gênero com subgêneros responde 400", async () => {
      const response = await fetch(`${origin}/api/v1/game-genres/${encodeURIComponent("Gênero Novo")}`, {
        method: "DELETE",
        headers: authHeaders(adminToken),
      });
      expect(response.status).toBe(400);
      expect((await response.json()).message).toContain("subgênero");
    });

    test("Excluir gênero sem uso responde 200", async () => {
      const response = await fetch(`${origin}/api/v1/game-genres/${encodeURIComponent("Subgênero Novo")}`, {
        method: "DELETE",
        headers: authHeaders(adminToken),
      });
      expect(response.status).toBe(200);
      expect((await response.json()).name).toBe("Subgênero Novo");
    });

    test("Excluir gênero inexistente responde 404", async () => {
      const response = await fetch(`${origin}/api/v1/game-genres/NaoExiste`, {
        method: "DELETE",
        headers: authHeaders(adminToken),
      });
      expect(response.status).toBe(404);
    });
  });

  describe("Limites do vínculo", () => {
    test("Jogo aceita no máximo 5 gêneros", async () => {
      const response = await fetch(`${origin}/api/v1/games/${actionGame.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(ownerToken) },
        body: JSON.stringify({
          genre_names: ["Shooter", "Plataforma", "Luta", "Stealth", "Battle Royale", "Extraction Shooter"],
        }),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).message).toContain("5 gêneros");
    });

    test("Gênero fora do catálogo é recusado em vez de virar texto livre", async () => {
      const response = await fetch(`${origin}/api/v1/games/${actionGame.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(ownerToken) },
        body: JSON.stringify({ genre_names: ["Gênero Inventado"] }),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).message).toContain("não está no catálogo");
    });

    test("O pai é removido quando um filho está selecionado", async () => {
      const response = await fetch(`${origin}/api/v1/games/${actionGame.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(ownerToken) },
        body: JSON.stringify({ genre_names: ["Ação", "Shooter", "Plataforma"] }),
      });
      expect(response.status).toBe(200);

      const body = await response.json();
      // "Ação" sai: o filtro por "Ação" já alcança o jogo pelos filhos, e os
      // cinco slots são poucos para gastar dois dizendo a mesma coisa.
      expect(body.genres.map((node) => node.name)).toEqual(["Shooter", "Plataforma"]);
      expect(body.genre).toBe("Ação");
    });
  });
});
