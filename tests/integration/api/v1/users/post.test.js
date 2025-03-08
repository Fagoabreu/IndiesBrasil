import orchestrator from "tests/orchestrator";
import { version as uuidVersion } from "uuid";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/users", () => {
  describe("anonymous user", () => {
    test("With Unique and valid data", async () => {
      const response = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "fagoabreu",
          email: "fagoabreu@gmail.com",
          password: "password",
          cpf: 11111111111,
        }),
      });

      expect(response.status).toBe(201);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        id: responseBody.id,
        username: "fagoabreu",
        email: "fagoabreu@gmail.com",
        password: "password",
        cpf: "11111111111",
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });
      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();
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
        action: "Utilize outro email para realizar o cadastro.",
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
        action: "Utilize outro usuario para realizar o cadastro.",
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
        action: "Utilize outro cpf para realizar o cadastro.",
        status_code: 400,
      });
    });
  });
});
