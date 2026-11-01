import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import game from "models/game";
import boardgame from "models/boardgame";
import book from "models/book";
import asset from "models/asset";
import assetCategory from "models/assetCategory";

/**
 * Declaração de uso de IA e filtros de classificação nas listagens.
 *
 * O que este arquivo fixa:
 *  - **quem** pode declarar é quem pode editar o produto (não basta estar
 *    logado) — é a diferença entre "declaração do criador" e "qualquer um
 *    reescrevendo a ficha dos outros";
 *  - **`0` e `null` não se confundem** — o nível 0 é declaração explícita e
 *    precisa sobreviver ao `CHECK` do banco, ao `UPDATE` e ao filtro;
 *  - **valor inválido de filtro é 400** — devolver a lista inteira faria o
 *    filtro parecer aplicado.
 *
 * Os testes de filtro dependem das declarações feitas acima deles no mesmo
 * bloco: é o mesmo padrão de `games/index.test.js` (que segue um jogo dentro do
 * teste), e a ordem dentro do arquivo é o que dá o estado esperado.
 */

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("Uso de IA — declaração e filtros", () => {
  let owner;
  let ownerToken;
  let otherToken;
  let studio;
  let createdGame;
  let createdBoardgame;
  let createdBook;
  let createdAsset;

  beforeAll(async () => {
    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoUsoIA",
      email: "dono.uso.ia@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 65123456701,
    });
    owner = ownerCtx.user;
    ownerToken = ownerCtx.sessionToken;

    const otherCtx = await createActivatedUserWithSession({
      username: "OutroUsoIA",
      email: "outro.uso.ia@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 65123456702,
    });
    otherToken = otherCtx.sessionToken;

    studio = await organization.create(owner, { name: "Estúdio Uso de IA" });

    createdGame = await game.create(studio.id, owner.id, {
      name: "Jogo com IA",
      stage: "released",
    });

    createdBoardgame = await boardgame.create(owner.id, studio.id, {
      name: "Mesa sem IA",
      category: "board_game",
      stage: "released",
    });

    createdBook = await book.create(owner.id, studio.id, { title: "Livro Sintético" });

    const sprites = await assetCategory.findBySlug("sprites");
    createdAsset = await asset.create(owner.id, studio.id, {
      name: "Pacote Híbrido",
      external_url: "https://exemplo.itch.io/pacote-hibrido",
      category_ids: [sprites.id],
    });
  });

  async function declare(token, payload) {
    return fetch(`${webserver.origin}/api/v1/ai-usage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(payload),
    });
  }

  test("Visitante não declara uso de IA", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/ai-usage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "game", slug: createdGame.slug, level: 2 }),
    });

    expect(response.status).toBe(401);
  });

  test("Usuário sem vínculo não declara uso de IA", async () => {
    const response = await declare(otherToken, { type: "game", slug: createdGame.slug, level: 2 });

    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.name).toBe("ForbiddenError");
  });

  test("Nível fora de 0..5 responde 400", async () => {
    for (const level of [6, -1, 2.5, "alto"]) {
      const response = await declare(ownerToken, { type: "game", slug: createdGame.slug, level });
      expect(response.status).toBe(400);
    }
  });

  test("Tipo desconhecido responde 400", async () => {
    const response = await declare(ownerToken, { type: "filme", slug: createdGame.slug, level: 1 });
    expect(response.status).toBe(400);
  });

  test("Produto inexistente responde 404", async () => {
    const response = await declare(ownerToken, { type: "game", slug: "jogo-inexistente-ia", level: 1 });

    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.name).toBe("NotFoundError");
  });

  test("Notas acima do limite respondem 400", async () => {
    const response = await declare(ownerToken, { type: "game", slug: createdGame.slug, level: 1, notes: "a".repeat(501) });
    expect(response.status).toBe(400);
  });

  test("Dono declara nível do jogo e a leitura devolve o valor", async () => {
    const response = await declare(ownerToken, {
      type: "game",
      slug: createdGame.slug,
      level: 3,
      notes: "Cenários gerados por IA; roteiro e sistemas feitos à mão.",
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({ type: "game", slug: createdGame.slug, level: 3 });
    expect(body.name).toBe("IA Co-Criativa");

    const detail = await fetch(`${webserver.origin}/api/v1/games/${createdGame.slug}`);
    const gameData = await detail.json();
    expect(gameData.ai_level).toBe(3);
    expect(gameData.ai_level_notes).toBe("Cenários gerados por IA; roteiro e sistemas feitos à mão.");
  });

  test("Nível 0 é declaração explícita, não ausência", async () => {
    const response = await declare(ownerToken, { type: "boardgame", slug: createdBoardgame.slug, level: 0 });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.level).toBe(0);
    expect(body.name).toBe("Sem Uso de IA");

    const detail = await fetch(`${webserver.origin}/api/v1/boardgames/${createdBoardgame.slug}`);
    const boardgameData = await detail.json();
    expect(boardgameData.ai_level).toBe(0);
  });

  test("Livro aceita o nível mais alto", async () => {
    const response = await declare(ownerToken, { type: "book", slug: createdBook.slug, level: 5 });

    expect(response.status).toBe(200);
  });

  test("Asset aceita nível e aparece no detalhe", async () => {
    const response = await declare(ownerToken, { type: "asset", slug: createdAsset.slug, level: 2 });
    expect(response.status).toBe(200);

    const detail = await fetch(`${webserver.origin}/api/v1/assets/${createdAsset.slug}`);
    const assetData = await detail.json();
    expect(assetData.ai_level).toBe(2);
  });

  test("Jogos filtram por nível de IA", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games?ai_level=3`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Jogo com IA");
  });

  test("Nível 0 é filtrável — não vira 'sem filtro'", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/boardgames?ai_level=0`);
    const body = await response.json();

    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Mesa sem IA");
  });

  test("Livros filtram pelo nível mais alto", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/books?ai_level=5`);
    const body = await response.json();

    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("Livro Sintético");
  });

  test("Assets filtram por nível de IA", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/assets?ai_level=2`);
    const body = await response.json();

    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Pacote Híbrido");
  });

  test("Filtro 'none' devolve só o que não foi declarado", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/games?ai_level=none`);
    const body = await response.json();

    expect(body).toEqual([]);
  });

  test("Nível inválido responde 400 em vez de devolver a lista inteira", async () => {
    for (const endpoint of ["games", "boardgames", "books", "assets"]) {
      const response = await fetch(`${webserver.origin}/api/v1/${endpoint}?ai_level=9`);
      expect(response.status).toBe(400);
    }
  });

  test("Classificação indicativa aceita 'none' e recusa valor fora da faixa", async () => {
    const none = await fetch(`${webserver.origin}/api/v1/games?content_rating=none`);
    expect(none.status).toBe(200);

    const noneBody = await none.json();
    expect(noneBody).toHaveLength(1);

    const invalid = await fetch(`${webserver.origin}/api/v1/books?content_rating=19`);
    expect(invalid.status).toBe(400);
  });
});
