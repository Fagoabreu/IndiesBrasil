import orchestrator from "tests/orchestrator";
import { version as uuidVersion } from "uuid";
import user from "models/user";
import password from "models/password";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/users", () => {
  describe("anonymous user", () => {
    test("With Unique and valid data", async () => {
      const testUser = {
        password: "password",
        username: "fagoabreu",
        cpf: "11111111111",
      };

      const response = await fetch("http://localhost:3000/api/v1/users", {
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
        email: "fagoabreu@gmail.com",
        password: responseBody.password,
        cpf: testUser.cpf,
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
        features: ["read:activation_token"],
      });
      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();

      const userInDatabase = await user.findOneByUsername(
        responseBody.username,
      );

      const correctPasswordMatch = await password.compare(
        testUser.password,
        userInDatabase.password,
      );
      const incorrectPasswordMatch = await password.compare(
        "Senha Errada",
        userInDatabase.password,
      );
      expect(correctPasswordMatch).toBe(true);
      expect(incorrectPasswordMatch).toBe(false);
    });

    test("With duplicated 'Email'", async () => {
      const response1 = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "duplicado1",
          email: "duplicado@gmail.com",
          password: "password",
          cpf: 22222222222,
        }),
      });

      expect(response1.status).toBe(201);

      const response2 = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "duplicado2",
          email: "Duplicado@gmail.com",
          password: "password",
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

    test("With duplicated 'Username'", async () => {
      const response = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "Duplicado1",
          email: "duplicadouser@gmail.com",
          password: "password",
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
      const response1 = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "duplicadocpf2",
          email: "duplicadocpf2@gmail.com",
          password: "password",
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
});
