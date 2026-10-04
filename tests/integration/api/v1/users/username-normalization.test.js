import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";
import user from "models/user";

/**
 * O defeito que estes testes protegem:
 *
 * O `username` era gravado exatamente como digitado — com espaço nas pontas e
 * caractere invisível —, e a busca do perfil compara bytes
 * (`LOWER(username) = LOWER($1)`). Um nome gravado como `"Yuri d Ávila "` (com
 * espaço no fim) nunca casava com a URL que se digita ou compartilha,
 * `/perfil/Yuri%20d%20%C3%81vila`: o perfil respondia 404.
 *
 * Em produção isso atingia 5 dos 36 usuários. O caso mais extremo era um nome
 * formado por `B` + seis hífens suaves (U+00AD) + `...` — invisível na tela, e
 * impossível de reproduzir digitando.
 */

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("Normalização de username", () => {
  describe("na escrita (models/user.js)", () => {
    test("grava a forma canônica, sem espaço nas pontas", async () => {
      const created = await orchestrator.createUser({
        username: "Yuri d \u00c1vila ",
        email: "yuri.normalizado@curso.dev",
        cpf: 66123456701,
      });

      // O valor devolvido e o gravado são a forma canônica.
      expect(created.username).toBe("Yuri d \u00c1vila");
      const reread = await user.findOneByUsername("Yuri d \u00c1vila");
      expect(reread.username).toBe("Yuri d \u00c1vila");
    });

    test("remove caractere invisível (hífen suave) e o espaço do fim", async () => {
      const created = await orchestrator.createUser({
        username: "B" + "\u00ad".repeat(6) + "." + "\u00ad".repeat(3) + ".. ",
        email: "b.invisivel@curso.dev",
        cpf: 66123456702,
      });

      // Vira o que a pessoa enxergava: "B..."
      expect(created.username).toBe("B...");
    });

    test("normaliza acento decomposto (NFD) para NFC", async () => {
      const created = await orchestrator.createUser({
        username: "A\u0301vila NFD",
        email: "avila.nfd@curso.dev",
        cpf: 66123456703,
      });

      expect(created.username).toBe("\u00c1vila NFD");
      expect(created.username).toBe(created.username.normalize("NFC"));
    });

    test("recusa nome que fica vazio depois de normalizar", async () => {
      await expect(
        user.create({
          username: "  \u00ad  ",
          email: "vazio@curso.dev",
          password: "SenhaSegura123",
          cpf: 66123456704,
        }),
      ).rejects.toThrow("Informe um nome de usuário.");
    });

    test("recusa nome curto demais depois de aparar", async () => {
      await expect(
        user.create({
          username: "ab ",
          email: "curto@curso.dev",
          password: "SenhaSegura123",
          cpf: 66123456705,
        }),
      ).rejects.toThrow(/ao menos 3 caracteres/);
    });

    test("não deixa cadastrar o mesmo nome variando só o espaço", async () => {
      // Antes, "Henrique " e "Henrique" passavam como nomes diferentes e o
      // segundo virava um perfil inalcançável.
      await orchestrator.createUser({ username: "Henrique", email: "henrique.1@curso.dev", cpf: 66123456706 });

      await expect(
        user.create({
          username: "Henrique ",
          email: "henrique.2@curso.dev",
          password: "SenhaSegura123",
          cpf: 66123456707,
        }),
      ).rejects.toThrow(/já está sendo utilizado/);
    });
  });

  describe("na leitura (GET /api/v1/users/[username]/profile)", () => {
    test("encontra o perfil pela URL canônica", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/users/${encodeURIComponent("Yuri d \u00c1vila")}/profile`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.user.username).toBe("Yuri d \u00c1vila");
    });

    test("tolera espaço nas pontas na URL (link antigo continua abrindo)", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/users/${encodeURIComponent("Yuri d \u00c1vila ")}/profile`);
      expect(response.status).toBe(200);
    });

    test("tolera espaço exótico na URL (NBSP no lugar do espaço)", async () => {
      // Colar de um app que troca o espaço por NBSP não pode dar 404.
      const response = await fetch(`${webserver.origin}/api/v1/users/${encodeURIComponent("Yuri d\u00a0\u00c1vila")}/profile`);
      expect(response.status).toBe(200);
    });

    test("tolera acento decomposto na URL (NFD)", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/users/${encodeURIComponent("Yuri d A\u0301vila")}/profile`);
      expect(response.status).toBe(200);
    });

    test("ainda responde 404 para nome que não existe", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/users/NaoExisteMesmo/profile`);
      expect(response.status).toBe(404);
    });
  });
});
