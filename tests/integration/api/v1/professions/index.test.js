import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import { createAdminUser } from "tests/helpers/testUtils";
import profession from "models/profession";

/**
 * Catálogo de profissões.
 *
 * ## O que mudou aqui, e por quê
 *
 * Este arquivo **documentava um defeito**: o teste "Admin POST fails because the
 * enum is exhausted (500)" fixava que criar profissão era impossível. A causa
 * era `portfolio_roles.name` ser um enum `developer_role` cujos valores já
 * estavam todos na tabela, então o INSERT colidia sempre com a primary key.
 *
 * A migration `1793750400000` converteu a coluna para texto. Agora o POST
 * funciona, e o teste passou a fixar o **comportamento correto** — manter o
 * anterior seria congelar o bug.
 *
 * O que este arquivo protege:
 *  - só admin escreve no catálogo;
 *  - duplicata é recusada por **nome normalizado** (o banco não garante mais por
 *    semântica, porque a coluna virou texto);
 *  - profissão em uso não é excluída, é desativada;
 *  - renomear chega ao perfil de quem declarou (FK `ON UPDATE CASCADE`).
 */

const origin = webserver.origin;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/professions", () => {
  test("Visitante não lista profissões", async () => {
    const response = await fetch(`${origin}/api/v1/professions`);
    expect(response.status).toBe(403);
  });

  test("Usuário ativado lista as profissões do seed", async () => {
    const ctx = await createActivatedUserWithSession({
      username: "ProfissaoLeitor",
      email: "profissao.leitor@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456707,
    });

    const response = await fetch(`${origin}/api/v1/professions`, { headers: authHeaders(ctx.sessionToken) });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body.some((role) => role.name === "Designer de Jogos")).toBe(true);
    expect(body.every((role) => "name" in role && "icon_img" in role)).toBe(true);
    // A tela de admin precisa destes três; sem eles não há como editar.
    expect(body.every((role) => "group_key" in role && "is_active" in role && "usage_count" in role)).toBe(true);
  });

  test("Filtro por grupo devolve só aquele grupo", async () => {
    const ctx = await createActivatedUserWithSession({
      username: "ProfissaoGrupo",
      email: "profissao.grupo@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456710,
    });

    const response = await fetch(`${origin}/api/v1/professions?group=arte`, { headers: authHeaders(ctx.sessionToken) });
    const body = await response.json();

    expect(body.length).toBeGreaterThan(0);
    expect(body.every((role) => role.group_key === "arte")).toBe(true);
  });

  test("Grupo desconhecido responde 400 em vez de devolver tudo", async () => {
    const ctx = await createActivatedUserWithSession({
      username: "ProfissaoGrupoErrado",
      email: "profissao.grupo.errado@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456711,
    });

    const response = await fetch(`${origin}/api/v1/professions?group=art`, { headers: authHeaders(ctx.sessionToken) });
    expect(response.status).toBe(400);
  });
});

describe("POST /api/v1/professions", () => {
  test("Visitante não cria profissão", async () => {
    const response = await fetch(`${origin}/api/v1/professions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Nova Profissao", icon_img: "Writer", group_key: "conteudo" }),
    });
    expect(response.status).toBe(403);
  });

  test("Usuário sem read:admin não cria profissão", async () => {
    const ctx = await createActivatedUserWithSession({
      username: "ProfissaoComum",
      email: "profissao.comum@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456708,
    });

    const response = await fetch(`${origin}/api/v1/professions`, {
      method: "POST",
      headers: { ...authHeaders(ctx.sessionToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "Nova Profissao", icon_img: "Writer", group_key: "conteudo" }),
    });
    expect(response.status).toBe(403);
  });

  test("Admin cria profissão — o que era impossível com o enum", async () => {
    const admin = await createAdminUser({
      username: "ProfissaoAdmin",
      email: "profissao.admin@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456709,
    });

    const response = await fetch(`${origin}/api/v1/professions`, {
      method: "POST",
      headers: { ...authHeaders(admin.sessionToken), "content-type": "application/json" },
      body: JSON.stringify({
        name: "Roteirista de Missões",
        icon_img: "Writer",
        description: "Escreve missões e diálogos.",
        group_key: "conteudo",
      }),
    });

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.name).toBe("Roteirista de Missões");
    expect(body.group_key).toBe("conteudo");
    expect(body.is_active).toBe(true);
  });

  test("Duplicata por nome normalizado responde 400", async () => {
    // Enquanto a coluna era enum, o banco garantia a unicidade por semântica.
    // Agora é texto: a checagem é da aplicação e precisa ignorar acento e caixa.
    const created = await profession.create({ name: "Level Designer Sênior", icon_img: "LevelDesigner", group_key: "design" });
    expect(created.name).toBe("Level Designer Sênior");

    const admin = await createAdminUser({
      username: "ProfissaoAdmin2",
      email: "profissao.admin2@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456712,
    });

    const response = await fetch(`${origin}/api/v1/professions`, {
      method: "POST",
      headers: { ...authHeaders(admin.sessionToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "level designer senior", icon_img: "LevelDesigner", group_key: "design" }),
    });

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.message).toContain("Level Designer Sênior");
  });

  test("Ícone fora da lista responde 400", async () => {
    const admin = await createAdminUser({
      username: "ProfissaoAdmin3",
      email: "profissao.admin3@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456713,
    });

    const response = await fetch(`${origin}/api/v1/professions`, {
      method: "POST",
      headers: { ...authHeaders(admin.sessionToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "Profissão Com Ícone Inventado", icon_img: "nao-existe", group_key: "outros" }),
    });

    expect(response.status).toBe(400);
  });

  test("Grupo inválido responde 400", async () => {
    const admin = await createAdminUser({
      username: "ProfissaoAdmin4",
      email: "profissao.admin4@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456714,
    });

    const response = await fetch(`${origin}/api/v1/professions`, {
      method: "POST",
      headers: { ...authHeaders(admin.sessionToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "Profissão Sem Grupo", icon_img: "Writer", group_key: "inexistente" }),
    });

    expect(response.status).toBe(400);
  });
});

describe("PATCH e DELETE /api/v1/professions/[name]", () => {
  test("PATCH desativa uma profissão", async () => {
    const admin = await createAdminUser({
      username: "ProfissaoDesativa",
      email: "profissao.desativa@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456715,
    });

    await profession.create({ name: "Profissão A Desativar", icon_img: "Writer", group_key: "conteudo" });

    const response = await fetch(`${origin}/api/v1/professions/${encodeURIComponent("Profissão A Desativar")}`, {
      method: "PATCH",
      headers: { ...authHeaders(admin.sessionToken), "content-type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.is_active).toBe(false);
  });

  test("Desativada some da lista padrão e aparece com include_inactive", async () => {
    const admin = await createAdminUser({
      username: "ProfissaoListaInativa",
      email: "profissao.lista.inativa@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456716,
    });

    const created = await profession.create({ name: "Profissão Inativa Lista", icon_img: "Writer", group_key: "conteudo" });
    await profession.update(created.name, { is_active: false });

    const publicList = await fetch(`${origin}/api/v1/professions`, { headers: authHeaders(admin.sessionToken) });
    const publicBody = await publicList.json();
    expect(publicBody.find((item) => item.name === "Profissão Inativa Lista")).toBeFalsy();

    const adminList = await fetch(`${origin}/api/v1/professions?include_inactive=true`, { headers: authHeaders(admin.sessionToken) });
    const adminBody = await adminList.json();
    expect(adminBody.find((item) => item.name === "Profissão Inativa Lista")).toBeTruthy();
  });

  test("Usuário comum não pede a lista com inativas", async () => {
    const ctx = await createActivatedUserWithSession({
      username: "ProfissaoNaoAdmin",
      email: "profissao.nao.admin@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456717,
    });

    const response = await fetch(`${origin}/api/v1/professions?include_inactive=true`, { headers: authHeaders(ctx.sessionToken) });
    expect(response.status).toBe(403);
  });

  test("Renomear propaga para o perfil de quem declarou (ON UPDATE CASCADE)", async () => {
    // O vínculo entre catálogo e perfil é por **nome** (`portfolio_role_ref`),
    // então sem `ON UPDATE CASCADE` a alteração deixaria os perfis existentes
    // apontando para um nome que não existe mais.
    const admin = await createAdminUser({
      username: "ProfissaoRenomeia",
      email: "profissao.renomeia@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456718,
    });

    const created = await profession.create({ name: "Escritor Provisório", icon_img: "Writer", group_key: "conteudo" });

    const database = (await import("@/infra/database")).default;
    await database.query({
      text: `INSERT INTO portfolio_role_ref (user_id, portfolio_role_name, experience) VALUES ($1, $2, 'Estudante')`,
      values: [admin.user.id, created.name],
    });

    const response = await fetch(`${origin}/api/v1/professions/${encodeURIComponent("Escritor Provisório")}`, {
      method: "PATCH",
      headers: { ...authHeaders(admin.sessionToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "Escritor Definitivo" }),
    });

    expect(response.status).toBe(200);

    const linked = await database.query({
      text: `SELECT portfolio_role_name FROM portfolio_role_ref WHERE user_id = $1`,
      values: [admin.user.id],
    });

    expect(linked.rows[0].portfolio_role_name).toBe("Escritor Definitivo");
  });

  test("Excluir profissão em uso responde 400 com a contagem", async () => {
    const admin = await createAdminUser({
      username: "ProfissaoEmUso",
      email: "profissao.em.uso@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456719,
    });

    const created = await profession.create({ name: "Profissão Em Uso", icon_img: "Writer", group_key: "conteudo" });

    const database = (await import("@/infra/database")).default;
    await database.query({
      text: `INSERT INTO portfolio_role_ref (user_id, portfolio_role_name, experience) VALUES ($1, $2, 'Estudante')`,
      values: [admin.user.id, created.name],
    });

    const response = await fetch(`${origin}/api/v1/professions/${encodeURIComponent("Profissão Em Uso")}`, {
      method: "DELETE",
      headers: authHeaders(admin.sessionToken),
    });

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.message).toContain("em uso por 1 perfil");
    expect(body.action).toContain("Desative");
  });

  test("Excluir profissão sem uso funciona", async () => {
    const admin = await createAdminUser({
      username: "ProfissaoSemUso",
      email: "profissao.sem.uso@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 92123456720,
    });

    const created = await profession.create({ name: "Profissão Descartável", icon_img: "Writer", group_key: "conteudo" });

    const response = await fetch(`${origin}/api/v1/professions/${encodeURIComponent(created.name)}`, {
      method: "DELETE",
      headers: authHeaders(admin.sessionToken),
    });

    expect(response.status).toBe(204);

    const found = await profession.findByName(created.name);
    expect(found).toBeNull();
  });
});
