import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import database from "infra/database";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import { createActivatedUserWithSession, authHeaders } from "tests/helpers/storeTestUtils";
import { createAdminUser } from "tests/helpers/testUtils";
import organization from "models/organization";
import post from "models/post";
import comment from "models/comment";
import game from "models/game";
import boardgame from "models/boardgame";
import book from "models/book";
import user from "models/user";

/**
 * Exclusão definitiva de conta pelo email (`/admin/users`).
 *
 * O que estes testes fixam é a parte que não dá para conferir olhando a tela:
 * que a rota exige `read:admin`, que a confirmação é conferida **no servidor**
 * (não só pelo botão desabilitado) e que a exclusão leva junto o que apontaria
 * para um `id` inexistente — deixando intacto o que pertence a outra pessoa.
 */

const origin = webserver.origin;

async function countRows(sql, values = []) {
  const result = await database.query({ text: sql, values });
  return Number.parseInt(result.rows[0].count, 10);
}

function purge(body, headers) {
  return fetch(`${origin}/api/v1/admin/users/purge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/admin/users", () => {
  test("Anônimo recebe 403", async () => {
    const response = await fetch(`${origin}/api/v1/admin/users?email=qualquer@teste.dev`);

    expect(response.status).toBe(403);
  });

  test("Usuário comum recebe 403", async () => {
    const ctx = await createActivatedUserWithSession({
      username: "ComumBuscaConta",
      email: "comum.busca.conta@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456701,
    });

    const response = await fetch(`${origin}/api/v1/admin/users?email=comum.busca.conta@teste.dev`, {
      headers: authHeaders(ctx.sessionToken),
    });

    expect(response.status).toBe(403);
  });

  test("Admin consulta a conta sem receber dados sensíveis", async () => {
    const admin = await createAdminUser({
      username: "AdminBuscaConta",
      email: "admin.busca.conta@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456702,
    });

    const alvo = await createActivatedUserWithSession({
      username: "ContaConsultada",
      email: "conta.consultada@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456703,
    });

    const response = await fetch(`${origin}/api/v1/admin/users?email=conta.consultada@teste.dev`, {
      headers: authHeaders(admin.sessionToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      id: alvo.user.id,
      username: "ContaConsultada",
      email: "conta.consultada@teste.dev",
      activated: true,
      is_admin: false,
    });

    // `findOneByEmail` seleciona `*`: um spread na resposta publicaria o hash
    // da senha e o CPF para o navegador.
    expect(body).not.toHaveProperty("password");
    expect(body).not.toHaveProperty("cpf");
  });

  test("Email desconhecido responde 404", async () => {
    const admin = await createAdminUser({
      username: "AdminBuscaInexistente",
      email: "admin.busca.inexistente@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456704,
    });

    const response = await fetch(`${origin}/api/v1/admin/users?email=nao.existe@teste.dev`, {
      headers: authHeaders(admin.sessionToken),
    });

    expect(response.status).toBe(404);
  });
});

describe("POST /api/v1/admin/users/purge", () => {
  test("Anônimo recebe 403", async () => {
    const response = await purge({ email: "alvo@teste.dev", confirm_email: "alvo@teste.dev" });

    expect(response.status).toBe(403);
  });

  test("Usuário comum recebe 403", async () => {
    const ctx = await createActivatedUserWithSession({
      username: "ComumPurge",
      email: "comum.purge@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456705,
    });

    const response = await purge({ email: "comum.purge@teste.dev", confirm_email: "comum.purge@teste.dev" }, authHeaders(ctx.sessionToken));

    expect(response.status).toBe(403);

    // O 403 acontece antes de qualquer escrita.
    const stillThere = await user.findOneByEmail("comum.purge@teste.dev");
    expect(stillThere.id).toBe(ctx.user.id);
  });

  test("Confirmação ausente ou diferente não apaga nada", async () => {
    const admin = await createAdminUser({
      username: "AdminPurgeConfirma",
      email: "admin.purge.confirma@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456706,
    });

    await createActivatedUserWithSession({
      username: "AlvoConfirmacao",
      email: "alvo.confirmacao@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456707,
    });

    const semConfirmacao = await purge({ email: "alvo.confirmacao@teste.dev" }, authHeaders(admin.sessionToken));
    expect(semConfirmacao.status).toBe(400);

    const outraConta = await purge(
      { email: "alvo.confirmacao@teste.dev", confirm_email: "alvo.confirmacao@teste.com" },
      authHeaders(admin.sessionToken),
    );
    expect(outraConta.status).toBe(400);

    const stillThere = await user.findOneByEmail("alvo.confirmacao@teste.dev");
    expect(stillThere.username).toBe("AlvoConfirmacao");
  });

  test("Email inexistente responde 404", async () => {
    const admin = await createAdminUser({
      username: "AdminPurgeInexistente",
      email: "admin.purge.inexistente@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456708,
    });

    const response = await purge({ email: "fantasma@teste.dev", confirm_email: "fantasma@teste.dev" }, authHeaders(admin.sessionToken));

    expect(response.status).toBe(404);
  });

  test("O admin não exclui a própria conta", async () => {
    const admin = await createAdminUser({
      username: "AdminPurgeSelf",
      email: "admin.purge.self@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456709,
    });

    const response = await purge(
      { email: "admin.purge.self@teste.dev", confirm_email: "admin.purge.self@teste.dev" },
      authHeaders(admin.sessionToken),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).name).toBe("ValidationError");
  });

  test("Outra conta de administrador não é excluída", async () => {
    const admin = await createAdminUser({
      username: "AdminPurgeCaller",
      email: "admin.purge.caller@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456710,
    });

    await createAdminUser({
      username: "AdminPurgeTarget",
      email: "admin.purge.target@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456711,
    });

    const response = await purge(
      { email: "admin.purge.target@teste.dev", confirm_email: "admin.purge.target@teste.dev" },
      authHeaders(admin.sessionToken),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("administrador");
  });

  test("Titular de estúdio sem decidir o que fazer com ele é recusado", async () => {
    const admin = await createAdminUser({
      username: "AdminPurgeDono",
      email: "admin.purge.dono@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456712,
    });

    const owner = await createActivatedUserWithSession({
      username: "DonoPurge",
      email: "dono.purge@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456713,
    });
    await organization.create(owner.user, { name: "Estúdio do Dono" });

    const response = await purge({ email: "dono.purge@teste.dev", confirm_email: "dono.purge@teste.dev" }, authHeaders(admin.sessionToken));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("titular");
    // A mensagem precisa apontar as duas saídas: sem isso o operador fica sem
    // saber que existe um caminho (era o caso de "transfira a titularidade"
    // quando não havia rota de transferência).
    expect(body.action).toContain("studio_action: delete");
    expect(body.action).toContain("studio_action: transfer");

    const stillThere = await user.findOneByEmail("dono.purge@teste.dev");
    expect(stillThere.id).toBe(owner.user.id);

    // Nada foi apagado no estúdio.
    expect(await countRows("SELECT count(*) FROM organizations WHERE owner_id = $1", [owner.user.id])).toBe(1);
  });

  test("Exclui a conta e tudo o que apontaria para ela", async () => {
    const admin = await createAdminUser({
      username: "AdminPurgeOk",
      email: "admin.purge.ok@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456714,
    });

    const alvo = await createActivatedUserWithSession({
      username: "ContaDescartavel",
      email: "conta.descartavel@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456715,
    });

    const postRow = await post.create({ author_id: alvo.user.id, content: "Post da conta descartável" });
    await comment.create({ post_id: postRow.id, author_id: admin.user.id, content: "Comentário de outra pessoa" });

    const response = await purge(
      { email: "conta.descartavel@teste.dev", confirm_email: "CONTA.DESCARTAVEL@teste.dev" },
      authHeaders(admin.sessionToken),
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.user).toMatchObject({ username: "ContaDescartavel", email: "conta.descartavel@teste.dev" });
    expect(body.removed.posts).toBe(1);
    // O comentário é de outra pessoa, mas estava no post que deixou de existir.
    expect(body.removed.comments).toBe(1);

    expect(await countRows("SELECT count(*) FROM users WHERE email = $1", ["conta.descartavel@teste.dev"])).toBe(0);
    expect(await countRows("SELECT count(*) FROM posts WHERE id = $1", [postRow.id])).toBe(0);
    expect(await countRows("SELECT count(*) FROM sessions WHERE user_id = $1", [alvo.user.id])).toBe(0);
    // A conta do admin continua inteira.
    expect(await countRows("SELECT count(*) FROM users WHERE id = $1", [admin.user.id])).toBe(1);
  });

  test("Excluir o estúdio leva junto as obras e os posts dele", async () => {
    const admin = await createAdminUser({
      username: "AdminPurgeEstudioDel",
      email: "admin.purge.estudio.del@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456720,
    });

    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoEstudioDel",
      email: "dono.estudio.del@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456721,
    });

    const studio = await organization.create(ownerCtx.user, { name: "Estúdio Descartável" });
    const gameRow = await game.create(studio.id, ownerCtx.user.id, { name: "Jogo Descartável", genre: "Aventura", stage: "released" });
    const boardgameRow = await boardgame.create(ownerCtx.user.id, studio.id, { name: "Mesa Descartável", stage: "released" });
    const bookRow = await book.create(ownerCtx.user.id, studio.id, { title: "Livro Descartável" });

    // Post em nome do estúdio, com uma resposta de outra pessoa: ela sai junto,
    // porque `parent_post_id` é NO ACTION e ficaria órfã.
    const orgPost = await post.create({ author_id: ownerCtx.user.id, organization_id: studio.id, content: "Post do estúdio" });
    await comment.create({ post_id: orgPost.id, author_id: admin.user.id, content: "Resposta de outra pessoa" });

    const response = await purge(
      {
        email: "dono.estudio.del@teste.dev",
        confirm_email: "dono.estudio.del@teste.dev",
        studio_action: "delete",
        confirm_studio_slug: studio.slug,
      },
      authHeaders(admin.sessionToken),
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.studio).toMatchObject({ action: "delete" });
    expect(body.studio.removed).toMatchObject({ games: 1, boardgames: 1, books: 1 });
    expect(body.studio.removed.posts).toBe(1);

    expect(await countRows("SELECT count(*) FROM users WHERE email = $1", ["dono.estudio.del@teste.dev"])).toBe(0);
    expect(await countRows("SELECT count(*) FROM organizations WHERE id = $1", [studio.id])).toBe(0);
    expect(await countRows("SELECT count(*) FROM games WHERE id = $1", [gameRow.id])).toBe(0);
    expect(await countRows("SELECT count(*) FROM boardgames WHERE id = $1", [boardgameRow.id])).toBe(0);
    expect(await countRows("SELECT count(*) FROM books WHERE id = $1", [bookRow.id])).toBe(0);
    expect(await countRows("SELECT count(*) FROM posts WHERE id = $1", [orgPost.id])).toBe(0);
  });

  test("Slug do estúdio errado não apaga nada", async () => {
    const admin = await createAdminUser({
      username: "AdminPurgeEstudioSlug",
      email: "admin.purge.estudio.slug@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456722,
    });

    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoEstudioSlug",
      email: "dono.estudio.slug@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456723,
    });
    const studio = await organization.create(ownerCtx.user, { name: "Estúdio Slug" });
    const gameRow = await game.create(studio.id, ownerCtx.user.id, { name: "Jogo Slug", genre: "Aventura", stage: "released" });

    const response = await purge(
      {
        email: "dono.estudio.slug@teste.dev",
        confirm_email: "dono.estudio.slug@teste.dev",
        studio_action: "delete",
        confirm_studio_slug: "outro-estudio",
      },
      authHeaders(admin.sessionToken),
    );
    expect(response.status).toBe(400);

    // Nada saiu: a transação não chegou a excluir o estúdio nem a conta.
    expect(await countRows("SELECT count(*) FROM organizations WHERE id = $1", [studio.id])).toBe(1);
    expect(await countRows("SELECT count(*) FROM games WHERE id = $1", [gameRow.id])).toBe(1);
    expect(await countRows("SELECT count(*) FROM users WHERE email = $1", ["dono.estudio.slug@teste.dev"])).toBe(1);
  });

  test("Transferir a responsabilidade mantém o estúdio e as obras", async () => {
    const admin = await createAdminUser({
      username: "AdminPurgeTransfer",
      email: "admin.purge.transfer@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456724,
    });

    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoQueVaiSair",
      email: "dono.que.vai.sair@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456725,
    });

    const successorCtx = await createActivatedUserWithSession({
      username: "NovoResponsavel",
      email: "novo.responsavel@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456726,
    });

    const studio = await organization.create(ownerCtx.user, { name: "Estúdio Que Continua" });
    const invitation = await organization.createInvitation(studio.id, successorCtx.user.id, ownerCtx.user.id, { role: "member" });
    await organization.respondToInvitation(invitation.id, successorCtx.user.id, true);

    const gameRow = await game.create(studio.id, ownerCtx.user.id, { name: "Jogo Que Continua", genre: "Aventura", stage: "released" });

    const response = await purge(
      {
        email: "dono.que.vai.sair@teste.dev",
        confirm_email: "dono.que.vai.sair@teste.dev",
        studio_action: "transfer",
        transfer_to_user_id: successorCtx.user.id,
      },
      authHeaders(admin.sessionToken),
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.studio).toMatchObject({ action: "transfer", to_user_id: successorCtx.user.id });

    // A conta saiu; o estúdio e a obra ficaram, agora com outro responsável.
    expect(await countRows("SELECT count(*) FROM users WHERE email = $1", ["dono.que.vai.sair@teste.dev"])).toBe(0);

    const orgAfter = await organization.findBySlug(studio.slug);
    expect(orgAfter.owner_id).toBe(successorCtx.user.id);

    expect(await countRows("SELECT count(*) FROM games WHERE id = $1", [gameRow.id])).toBe(1);
    // O antigo dono não é mais membro nem tem papel no estúdio.
    expect(await countRows("SELECT count(*) FROM org_members WHERE org_id = $1 AND member_id = $2", [studio.id, ownerCtx.user.id])).toBe(0);
    expect(await countRows("SELECT count(*) FROM org_roles WHERE org_id = $1 AND member_id = $2", [studio.id, ownerCtx.user.id])).toBe(0);
    // O novo responsável recebeu a role de admin.
    expect(
      await countRows("SELECT count(*) FROM org_roles WHERE org_id = $1 AND member_id = $2 AND role = 'admin'", [studio.id, successorCtx.user.id]),
    ).toBe(1);
  });

  test("Transferir para quem não é membro é recusado", async () => {
    const admin = await createAdminUser({
      username: "AdminPurgeTransferNaoMembro",
      email: "admin.purge.transfer.nao.membro@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456727,
    });

    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoTransferNaoMembro",
      email: "dono.transfer.nao.membro@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456728,
    });

    const outsider = await createActivatedUserWithSession({
      username: "ForaDoEstudio",
      email: "fora.do.estudio@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456729,
    });

    const studio = await organization.create(ownerCtx.user, { name: "Estúdio Fechado" });

    const response = await purge(
      {
        email: "dono.transfer.nao.membro@teste.dev",
        confirm_email: "dono.transfer.nao.membro@teste.dev",
        studio_action: "transfer",
        transfer_to_user_id: outsider.user.id,
      },
      authHeaders(admin.sessionToken),
    );

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.message).toContain("membro ativo");

    // Nem a conta nem o estúdio mudaram.
    expect(await countRows("SELECT count(*) FROM users WHERE email = $1", ["dono.transfer.nao.membro@teste.dev"])).toBe(1);
    const orgAfter = await organization.findBySlug(studio.slug);
    expect(orgAfter.owner_id).toBe(ownerCtx.user.id);
  });

  test("A consulta de conta devolve o estúdio com os membros e papéis", async () => {
    const admin = await createAdminUser({
      username: "AdminLookupEstudio",
      email: "admin.lookup.estudio@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456730,
    });

    const ownerCtx = await createActivatedUserWithSession({
      username: "DonoLookupEstudio",
      email: "dono.lookup.estudio@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456731,
    });

    const memberCtx = await createActivatedUserWithSession({
      username: "MembroLookupEstudio",
      email: "membro.lookup.estudio@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456732,
    });

    const studio = await organization.create(ownerCtx.user, { name: "Estúdio Lookup" });
    const invitation = await organization.createInvitation(studio.id, memberCtx.user.id, ownerCtx.user.id, { role: "member" });
    await organization.respondToInvitation(invitation.id, memberCtx.user.id, true);

    const response = await fetch(`${origin}/api/v1/admin/users?email=dono.lookup.estudio@teste.dev`, {
      headers: authHeaders(admin.sessionToken),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.studio).toMatchObject({ slug: studio.slug, name: "Estúdio Lookup" });

    // A tela precisa saber quem pode receber a titularidade — e marcar quem é o
    // responsável atual, que não pode transferir para si mesmo.
    const ownerEntry = body.studio.members.find((member) => member.username === "DonoLookupEstudio");
    const memberEntry = body.studio.members.find((member) => member.username === "MembroLookupEstudio");

    expect(ownerEntry).toMatchObject({ is_owner: true });
    expect(ownerEntry.roles).toContain("admin");
    expect(memberEntry).toMatchObject({ is_owner: false, roles: ["member"] });
  });

  test("Email, username e CPF ficam livres para um novo cadastro", async () => {
    const admin = await createAdminUser({
      username: "AdminPurgeLivre",
      email: "admin.purge.livre@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456716,
    });

    await createActivatedUserWithSession({
      username: "ContaReciclavel",
      email: "conta.reciclavel@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456717,
    });

    const purgeResponse = await purge(
      { email: "conta.reciclavel@teste.dev", confirm_email: "conta.reciclavel@teste.dev" },
      authHeaders(admin.sessionToken),
    );
    expect(purgeResponse.status).toBe(200);

    // É o efeito que a tela promete: sem ele, a exclusão não resolveria o caso
    // que a motivou (conta de teste que ocupa um endereço/CPF em produção).
    const recreated = await user.create({
      username: "ContaReciclavel",
      email: "conta.reciclavel@teste.dev",
      password: TEST_CREDENTIALS.userDefault,
      cpf: 93123456717,
    });

    expect(recreated.id).toBeDefined();
  });
});
