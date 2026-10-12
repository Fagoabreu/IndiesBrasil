import orchestrator from "tests/orchestrator";
import { version as uuidVersion } from "uuid";
import user from "models/user";
import password from "models/password";
import activation from "models/activation";
import database from "infra/database";
import TEST_CREDENTIALS from "tests/helpers/testCredentials.js";
import webserver from "@/infra/webserver";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/users", () => {
  describe("anonymous user", () => {
    test("With Unique and valid data", async () => {
      const testUser = {
        password: TEST_CREDENTIALS.userDefault,
        username: "fagoabreu",
        cpf: "11111111111",
      };

      const response = await fetch(`${webserver.origin}/api/v1/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: testUser.username,
          email: "fagoabreu@gmail.com",
          password: testUser.password,
          cpf: testUser.cpf,
        }),
      });

      expect(response.status).toBe(201);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        id: responseBody.id,
        username: testUser.username,
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
        avatar_image: null,
        background_image: null,
        bio: null,
        reputation: 0,
        resumo: null,
        visibility: "public",
      });
      // O requester é anônimo (não é o próprio recurso), então a lista de
      // permissões não é exposta na resposta de cadastro.
      expect(responseBody).not.toHaveProperty("features");
      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();

      const userInDatabase = await user.findOneByUsername(responseBody.username);

      const correctPasswordMatch = await password.compare(testUser.password, userInDatabase.password);
      const incorrectPasswordMatch = await password.compare(TEST_CREDENTIALS.wrongCheck, userInDatabase.password);
      expect(correctPasswordMatch).toBe(true);
      expect(incorrectPasswordMatch).toBe(false);
    });

    test("With duplicated `email`", async () => {
      const response1 = await fetch(`${webserver.origin}/api/v1/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "duplicado1",
          email: "duplicado@gmail.com",
          password: TEST_CREDENTIALS.userDefault,
          cpf: 22222222222,
        }),
      });

      expect(response1.status).toBe(201);

      const response2 = await fetch(`${webserver.origin}/api/v1/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "duplicado2",
          email: "Duplicado@gmail.com",
          password: TEST_CREDENTIALS.userDefault,
          cpf: 33333333333,
        }),
      });

      expect(response2.status).toBe(400);
      const responseBody = await response2.json();
      expect(responseBody).toEqual({
        name: "ValidationError",
        message: "O email informado já está sendo utilizado.",
        action: "Utilize outro email para esta operação.",
        status_code: 400,
      });
    });

    test("With duplicated `username`", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "Duplicado1",
          email: "duplicadouser@gmail.com",
          password: TEST_CREDENTIALS.userDefault,
          cpf: 44444444444,
        }),
      });

      expect(response.status).toBe(400);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ValidationError",
        message: "O usuario informado já está sendo utilizado.",
        action: "Utilize outro username para esta operação.",
        status_code: 400,
      });
    });

    test("With duplicated 'CPF'", async () => {
      const response1 = await fetch(`${webserver.origin}/api/v1/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "duplicadocpf2",
          email: "duplicadocpf2@gmail.com",
          password: TEST_CREDENTIALS.userDefault,
          cpf: 11111111111,
        }),
      });

      expect(response1.status).toBe(400);
      const responseBody = await response1.json();
      expect(responseBody).toEqual({
        name: "ValidationError",
        message: "O cpf informado já está sendo utilizado.",
        action: "Utilize outro cpf para esta operação.",
        status_code: 400,
      });
    });
  });

  describe("Default user", () => {
    test("With unique and valid data", async () => {
      const user1 = await orchestrator.createUser();
      await orchestrator.activateUser(user1);
      const user1SessionObject = await orchestrator.createSession(user1);

      const response = await fetch(`${webserver.origin}/api/v1/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${user1SessionObject.token}`,
        },
        body: JSON.stringify({
          username: "usuariologado",
          email: "usuariologado@curso.dev",
          password: TEST_CREDENTIALS.userAlt,
        }),
      });

      expect(response.status).toBe(403);
      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "ForbiddenError",
        message: "Você não possui permissão para executar esta ação",
        action: 'Verifique se o seu usuário possui a feature "create:user" para executar esta ação.',
        status_code: 403,
      });
    });
  });

  /**
   * Cadastro abandonado: quem nunca ativou e deixou o token vencer precisa poder
   * criar a conta de novo.
   *
   * O cadastro grava a linha em `users` **antes** da ativação, e as três chaves
   * são únicas. Sem uma saída, quem não ativa fica travado para sempre: o token
   * vence em 1 hora, a mensagem de erro manda "faça um novo cadastro", e é
   * exatamente isso que as validações recusam. Reenviar o e-mail não resolve o
   * caso mais provável (email digitado errado), e o CPF é único, então trocar de
   * email não contorna.
   *
   * A anulação só é segura sob DUAS condições, e os negativos abaixo são o que
   * garante que ela não vira "apagar conta de gente":
   *
   *  - token válido → a conta tem dono ativo, então conflito (400);
   *  - conta já ativada → pode ter conteúdo, então conflito (400).
   */
  describe("anonymous user — cadastro abandonado (nunca ativado)", () => {
    /** Envelhece os tokens de ativação do usuário, deixando-os vencidos. */
    async function expireActivationTokens(userId) {
      await database.query({
        text: `
        UPDATE user_activation_tokens
        SET created_at = now() - interval '2 hours',
            expires_at = now() - interval '1 hour'
        WHERE user_id = $1
        `,
        values: [userId],
      });
    }

    async function countUsersByCpf(cpf) {
      const result = await database.query({ text: `SELECT count(*)::int AS total FROM users WHERE cpf = $1`, values: [cpf] });
      return result.rows[0].total;
    }

    function register(body) {
      return fetch(`${webserver.origin}/api/v1/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    test("Mesmo email, CPF e username: o cadastro vencido é anulado e o novo entra", async () => {
      const primeiro = await register({
        username: "AbandonadoEmail",
        email: "abandonado.email@teste.dev",
        password: TEST_CREDENTIALS.userDefault,
        cpf: "529.982.247-25",
      });
      expect(primeiro.status).toBe(201);
      const primeiroId = (await primeiro.json()).id;

      const token = await activation.create(primeiroId);
      await expireActivationTokens(primeiroId);

      // Todos os três campos idênticos: é o caso de quem só quer recomeçar.
      const segundo = await register({
        username: "AbandonadoEmail",
        email: "abandonado.email@teste.dev",
        password: TEST_CREDENTIALS.userAlt,
        cpf: "529.982.247-25",
      });

      expect(segundo.status).toBe(201);
      const segundoBody = await segundo.json();
      expect(segundoBody.id).not.toBe(primeiroId);

      // Sobrou **um** registro — o antigo foi substituído, não duplicado.
      expect(await countUsersByCpf("52998224725")).toBe(1);

      // E o token antigo saiu junto (a tabela não tem FK para `users`, então a
      // limpeza é explícita; sem ela ficaria órfão).
      const tokenAntigo = await database.query({
        text: `SELECT count(*)::int AS total FROM user_activation_tokens WHERE id = $1`,
        values: [token.id],
      });
      expect(tokenAntigo.rows[0].total).toBe(0);
    });

    test("CPF e username iguais, email diferente (email foi digitado errado)", async () => {
      const primeiro = await register({
        username: "AbandonadoCpf",
        email: "email.errado@teste.dev",
        password: TEST_CREDENTIALS.userDefault,
        cpf: "111.444.777-35",
      });
      expect(primeiro.status).toBe(201);
      const primeiroId = (await primeiro.json()).id;

      await activation.create(primeiroId);
      await expireActivationTokens(primeiroId);

      // O caso que reenviar e-mail **não** resolve: o endereço não existe.
      const segundo = await register({
        username: "AbandonadoCpf",
        email: "email.certo@teste.dev",
        password: TEST_CREDENTIALS.userAlt,
        cpf: "11144477735",
      });

      expect(segundo.status).toBe(201);
      const segundoId = (await segundo.json()).id;

      // O email é conferido no banco, e não na resposta: para requester anônimo
      // o `filterOutput` de `read:user` não devolve `email` (ver o primeiro
      // teste deste arquivo).
      const novoRegistro = await user.findOneById(segundoId);
      expect(novoRegistro.email).toBe("email.certo@teste.dev");
      expect(await countUsersByCpf("11144477735")).toBe(1);
    });

    test("Token ainda VÁLIDO não é anulado — a conta tem dono ativo", async () => {
      const primeiro = await register({
        username: "TokenVivo",
        email: "token.vivo@teste.dev",
        password: TEST_CREDENTIALS.userDefault,
        cpf: "123.456.789-09",
      });
      expect(primeiro.status).toBe(201);
      const primeiroId = (await primeiro.json()).id;

      // Token recém-criado: 1 hora de validade, não vencido. Destruir aqui
      // roubaria a ativação de quem só está um pouco atrasado.
      await activation.create(primeiroId);

      const segundo = await register({
        username: "TokenVivo2",
        email: "token.vivo.2@teste.dev",
        password: TEST_CREDENTIALS.userAlt,
        cpf: "12345678909",
      });

      expect(segundo.status).toBe(400);
      expect((await segundo.json()).message).toBe("O cpf informado já está sendo utilizado.");

      const sobrevivente = await user.findOneById(primeiroId);
      expect(sobrevivente.username).toBe("TokenVivo");
    });

    test("Conta JÁ ATIVADA não pode ser recriada, mesmo com token vencido", async () => {
      const ativado = await register({
        username: "JaAtivado",
        email: "ja.ativado@teste.dev",
        password: TEST_CREDENTIALS.userDefault,
        cpf: "987.654.321-00",
      });
      expect(ativado.status).toBe(201);
      const ativadoId = (await ativado.json()).id;

      await orchestrator.activateUser(await user.findOneById(ativadoId));
      await activation.create(ativadoId);
      await expireActivationTokens(ativadoId);

      // `create:session` é o que a ativação concede; depois dela a conta pode ter
      // publicado conteúdo. Apagar isso seria destruir dados de alguém, não
      // anular um cadastro — a resposta correta é o conflito.
      const tentativa = await register({
        username: "QuerTomar",
        email: "quer.tomar@teste.dev",
        password: TEST_CREDENTIALS.userAlt,
        cpf: "98765432100",
      });

      expect(tentativa.status).toBe(400);
      expect((await tentativa.json()).message).toBe("O cpf informado já está sendo utilizado.");

      const aindaExiste = await user.findOneById(ativadoId);
      expect(aindaExiste.username).toBe("JaAtivado");
      expect(aindaExiste.features).toContain("create:session");
    });

    test("O cadastro abandonado ao lado continua intacto", async () => {
      const vizinho = await register({
        username: "VizinhoIntacto",
        email: "vizinho.intacto@teste.dev",
        password: TEST_CREDENTIALS.userDefault,
        cpf: "390.533.447-05",
      });
      expect(vizinho.status).toBe(201);
      const vizinhoId = (await vizinho.json()).id;
      await activation.create(vizinhoId);
      await expireActivationTokens(vizinhoId);

      // Nenhuma chave em comum com o cadastro seguinte.
      const outro = await register({
        username: "OutroNovato",
        email: "outro.novato@teste.dev",
        password: TEST_CREDENTIALS.userAlt,
        cpf: "012.345.678-90",
      });
      expect(outro.status).toBe(201);

      const vizinhoDepois = await user.findOneById(vizinhoId);
      expect(vizinhoDepois.username).toBe("VizinhoIntacto");
    });

    test("O token do cadastro novo sobrevive à limpeza", async () => {
      const abandonado = await register({
        username: "Reaberto",
        email: "reaberto@teste.dev",
        password: TEST_CREDENTIALS.userDefault,
        cpf: "918.273.645-00",
      });
      expect(abandonado.status).toBe(201);
      const abandonadoId = (await abandonado.json()).id;
      await activation.create(abandonadoId);
      await expireActivationTokens(abandonadoId);

      const novo = await register({
        username: "Reaberto",
        email: "reaberto@teste.dev",
        password: TEST_CREDENTIALS.userAlt,
        cpf: "91827364500",
      });
      expect(novo.status).toBe(201);
      const novoId = (await novo.json()).id;

      // A rota cria o token do novo cadastro logo depois. A limpeza usa
      // `user_id IN (SELECT ...)`: se o escopo vazasse, o token novo seria
      // apagado junto e a pessoa cairia no mesmo beco com outra roupagem.
      const tokenNovo = await database.query({
        text: `
        SELECT purpose, expires_at > now() AS valido
        FROM user_activation_tokens
        WHERE user_id = $1
        `,
        values: [novoId],
      });

      expect(tokenNovo.rowCount).toBe(1);
      expect(tokenNovo.rows[0].purpose).toBe("activation");
      expect(tokenNovo.rows[0].valido).toBe(true);
    });

    test("Token de RESET vencido mantém o cadastro", async () => {
      const usuario = await register({
        username: "ComReset",
        email: "com.reset@teste.dev",
        password: TEST_CREDENTIALS.userDefault,
        cpf: "111.222.333-96",
      });
      expect(usuario.status).toBe(201);
      const usuarioId = (await usuario.json()).id;

      // Pedido de redefinição de senha: só acontece com quem sabe **email e
      // CPF**, e o link chega por e-mail. É sinal de dono engajado, além do
      // cadastro — por isso o vencimento do token não libera o registro.
      await activation.create(usuarioId, activation.TOKEN_PURPOSE.RESET);
      await expireActivationTokens(usuarioId);

      const tentativa = await register({
        username: "TomandoOCpf",
        email: "tomando.o.cpf@teste.dev",
        password: TEST_CREDENTIALS.userAlt,
        cpf: "111.222.333-96",
      });

      expect(tentativa.status).toBe(400);
      expect((await tentativa.json()).message).toBe("O cpf informado já está sendo utilizado.");

      const sobrevivente = await user.findOneById(usuarioId);
      expect(sobrevivente.username).toBe("ComReset");
    });

    test("Token de RESET já USADO também mantém o cadastro", async () => {
      const usuario = await register({
        username: "ResetJaUsado",
        email: "reset.ja.usado@teste.dev",
        password: TEST_CREDENTIALS.userDefault,
        cpf: "852.963.741-00",
      });
      expect(usuario.status).toBe(201);
      const usuarioId = (await usuario.json()).id;

      const token = await activation.create(usuarioId, activation.TOKEN_PURPOSE.RESET);
      await activation.markTokenAsUsed(token.id);
      await expireActivationTokens(usuarioId);

      // O estado do token é irrelevante para a decisão: o que a mantém é ele ter
      // **existido**. Alguém redefiniu a senha desta conta; apagá-la agora seria
      // descartar trabalho de quem estava usando o cadastro.
      const tentativa = await register({
        username: "TomandoOCpf2",
        email: "tomando.o.cpf.2@teste.dev",
        password: TEST_CREDENTIALS.userAlt,
        cpf: "85296374100",
      });

      expect(tentativa.status).toBe(400);
      expect((await tentativa.json()).message).toBe("O cpf informado já está sendo utilizado.");

      const sobrevivente = await user.findOneById(usuarioId);
      expect(sobrevivente.username).toBe("ResetJaUsado");
    });
  });
});
