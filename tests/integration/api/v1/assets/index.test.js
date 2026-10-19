import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession } from "tests/helpers/storeTestUtils";
import organization from "models/organization";
import asset from "models/asset";
import assetCategory from "models/assetCategory";
import moderation from "models/moderation";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/assets", () => {
  let studio;
  let sprites;
  let audio;

  beforeAll(async () => {
    const owner = await createActivatedUserWithSession({
      username: "DonoAssetLista",
      email: "dono.asset.lista@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 63123456701,
    });

    studio = await organization.create(owner.user, { name: "Estúdio Assets Lista" });

    sprites = await assetCategory.findBySlug("sprites");
    audio = await assetCategory.findBySlug("trilha-sonora");

    await asset.create(owner.user.id, studio.id, {
      name: "Pacote de Sprites",
      short_description: "Sprites de plataforma em pixel art",
      external_url: "https://exemplo.itch.io/pacote-sprites",
      category_ids: [sprites.id],
      is_free: true,
    });

    await asset.create(owner.user.id, studio.id, {
      name: "Trilha Épica",
      external_url: "https://exemplo.itch.io/trilha-epica",
      category_ids: [audio.id],
      is_free: false,
      price: 49.9,
    });

    const blocked = await asset.create(owner.user.id, studio.id, {
      name: "Asset Bloqueado",
      external_url: "https://exemplo.itch.io/bloqueado",
      category_ids: [sprites.id],
    });
    await moderation.createBlock({
      targetType: "asset",
      targetId: blocked.id,
      reason: "violacao_termos",
      moderatorId: owner.user.id,
    });

    // Estúdio bloqueado: os assets dele somem junto, mesmo sem bloqueio próprio.
    const blockedOwner = await createActivatedUserWithSession({
      username: "DonoAssetBloqueado",
      email: "dono.asset.bloqueado@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 63123456702,
    });
    const blockedStudio = await organization.create(blockedOwner.user, { name: "Estúdio Asset Bloqueado" });
    await moderation.createBlock({
      targetType: "studio",
      targetId: blockedStudio.id,
      reason: "violacao_termos",
      moderatorId: owner.user.id,
    });
    await asset.create(blockedOwner.user.id, blockedStudio.id, {
      name: "Asset de Estúdio Bloqueado",
      external_url: "https://exemplo.itch.io/estudio-bloqueado",
      category_ids: [sprites.id],
    });
  });

  test("Visitante lista apenas assets publicados e visíveis", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/assets`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.map((item) => item.name).sort()).toEqual(["Pacote de Sprites", "Trilha Épica"]);
  });

  test("Resposta traz categorias e dados do estúdio", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/assets?search=Sprites`);
    const body = await response.json();

    expect(body).toHaveLength(1);
    expect(body[0].categories).toEqual([
      { id: sprites.id, slug: "sprites", name: "Sprites", group_key: "arte-2d", is_active: true },
    ]);
    expect(body[0].studio_name).toBe("Estúdio Assets Lista");
    expect(body[0].studio_slug).toBe(studio.slug);
  });

  test("Filtro por busca textual", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/assets?search=plataforma`);
    const body = await response.json();

    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Pacote de Sprites");
  });

  test("Filtro por categoria", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/assets?category=trilha-sonora`);
    const body = await response.json();

    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Trilha Épica");
  });

  test("Filtro por grupo usa a hierarquia fixa", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/assets?group=audio`);
    const body = await response.json();

    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Trilha Épica");
  });

  test("Filtro de gratuitos", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/assets?free=true`);
    const body = await response.json();

    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Pacote de Sprites");
  });

  test("Categoria desconhecida responde 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/assets?category=nao-existe`);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.message).toBe("Categoria de asset não encontrada.");
  });

  test("Grupo desconhecido responde 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/assets?group=arte`);
    expect(response.status).toBe(400);
  });

  test("Valor inválido de free responde 400", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/assets?free=talvez`);
    expect(response.status).toBe(400);
  });

  test("Paginação por limit", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/assets?limit=1`);
    const body = await response.json();

    expect(body).toHaveLength(1);
  });
});
