import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import galene from "@/lib/galene";
import { ValidationError } from "@/infra/errors";

/**
 * Testes unitários do provisionamento Galene (Fase 3).
 * Não dependem de servidor/banco: validam escrita de grupo, emissão de JWT
 * (claims aceitas pelo Galene 1.2.1 — ver galene/token/jwt.go) e montagem da
 * URL de entrada.
 */

let groupsDir;

beforeAll(async () => {
  groupsDir = await mkdtemp(path.join(tmpdir(), "galene-test-"));
});

afterAll(async () => {
  await rm(groupsDir, { recursive: true, force: true });
});

describe("lib/galene.js", () => {
  describe("sanitizeDisplayName()", () => {
    test("retorna nome padrão quando ausente", () => {
      expect(galene.sanitizeDisplayName()).toBe("Convidado");
      expect(galene.sanitizeDisplayName("   ")).toBe("Convidado");
      expect(galene.sanitizeDisplayName(42)).toBe("Convidado");
    });

    test("remove caracteres de controle e limita a 40 caracteres", () => {
      expect(galene.sanitizeDisplayName("Z\u0000é\n")).toBe("Zé");
      expect(galene.sanitizeDisplayName("x".repeat(80))).toHaveLength(40);
    });
  });

  describe("ensureStudioGroup()", () => {
    test("grava groups/<estudio>.json com authKeys, auto-subgroups e sem campos obsoletos", async () => {
      process.env.GALENE_GROUPS_DIR = groupsDir;
      process.env.MEET_URL = "wss://meet.example.com";

      const written = await galene.ensureStudioGroup("aurora-games");

      expect(written).toBe(true);

      const filePath = path.join(groupsDir, "aurora-games.json");
      const group = JSON.parse(await readFile(filePath, "utf8"));

      // O servidor lê o grupo com `DisallowUnknownFields`
      // (galene/group/description.go): qualquer campo que não exista na struct
      // `Description` derruba o carregamento da sala. Travar a forma exata do
      // JSON aqui impede introduzir um campo que só falharia em runtime —
      // `allow-anonymous`, por exemplo, está obsoleto desde o Galene 0.9.
      expect(Object.keys(group).sort()).toEqual(["authKeys", "auto-subgroups", "comment"]);
      // Sem auto-subgroups o Galene não resolve `<estudio>/<sala>` e TODAS as
      // salas do estúdio param de abrir (galene/group/description.go).
      expect(group["auto-subgroups"]).toBe(true);
      expect(group.authKeys).toHaveLength(1);
      expect(group.authKeys[0]).toMatchObject({ kty: "oct", alg: "HS256" });
      expect(group.authKeys[0].k).toBe(galene.getAuthSecret().encoded);
      expect(group.displayName).toBeUndefined();
    });

    test("grava authKeys k em base64url SEM padding (RawURLEncoding do Galene)", async () => {
      process.env.GALENE_GROUPS_DIR = groupsDir;
      // Entrada com padding: o Galene decodifica `k` com base64url sem padding
      // (Go base64.RawURLEncoding) e rejeita "=" (token unverifiable). A chave
      // precisa ter exatamente 32 bytes (HS256 do Galene).
      const rawKey = Buffer.from("0123456789abcdef0123456789abcdef", "utf8"); // 32 bytes
      const padded = rawKey.toString("base64");
      const unpadded = rawKey.toString("base64url");
      expect(padded).toMatch(/=$/);
      process.env.GALENE_AUTH_SECRET = padded;
      try {
        await galene.ensureStudioGroup("padded-secret-studio");

        const group = JSON.parse(await readFile(path.join(groupsDir, "padded-secret-studio.json"), "utf8"));
        const k = group.authKeys[0].k;

        expect(k).toBe(unpadded);
        expect(k).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(k).not.toMatch(/=/);
        expect(galene.getAuthSecret().encoded).toBe(k);
      } finally {
        delete process.env.GALENE_AUTH_SECRET;
      }
    });

    test("grava displayName do estúdio quando informado", async () => {
      process.env.GALENE_GROUPS_DIR = groupsDir;
      process.env.MEET_URL = "wss://meet.example.com";

      const written = await galene.ensureStudioGroup("estudio-aurora", "Estúdio Aurora Games");

      expect(written).toBe(true);

      const group = JSON.parse(await readFile(path.join(groupsDir, "estudio-aurora.json"), "utf8"));

      expect(group.displayName).toBe("Estúdio Aurora Games");
    });

    test("sanitiza displayName: remove controles e limita a 80 caracteres", async () => {
      process.env.GALENE_GROUPS_DIR = groupsDir;
      process.env.MEET_URL = "wss://meet.example.com";

      await galene.ensureStudioGroup("estudio-eco", "Bad\u0000Name\n");
      const group1 = JSON.parse(await readFile(path.join(groupsDir, "estudio-eco.json"), "utf8"));
      expect(group1.displayName).toBe("BadName");

      await galene.ensureStudioGroup("estudio-longo", "X".repeat(90));
      const group2 = JSON.parse(await readFile(path.join(groupsDir, "estudio-longo.json"), "utf8"));
      expect(group2.displayName).toHaveLength(80);
    });

    test("é idempotente: não reescreve quando o conteúdo é igual", async () => {
      process.env.GALENE_GROUPS_DIR = groupsDir;

      const first = await galene.ensureStudioGroup("estudio-idem");
      const filePath = path.join(groupsDir, "estudio-idem.json");
      const contentBefore = await readFile(filePath, "utf8");

      const second = await galene.ensureStudioGroup("estudio-idem");
      const contentAfter = await readFile(filePath, "utf8");

      expect(first).toBe(true);
      expect(second).toBe(false);
      expect(contentAfter).toBe(contentBefore);
    });

    test("rejeita slug com path traversal", async () => {
      process.env.GALENE_GROUPS_DIR = groupsDir;

      await expect(galene.ensureStudioGroup("../../etc/passwd")).rejects.toBeInstanceOf(ValidationError);
      await expect(galene.ensureStudioGroup("estudio/com-barra")).rejects.toBeInstanceOf(ValidationError);
      await expect(galene.ensureStudioGroup("ComMaiuscula")).rejects.toBeInstanceOf(ValidationError);
      await expect(galene.ensureStudioGroup("")).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("roomGroupName()", () => {
    test("monta <estudio>/<reuniao> e valida as duas partes", () => {
      expect(galene.roomGroupName("aurora-games", "aa11bb22cc33dd44")).toBe("aurora-games/aa11bb22cc33dd44");

      expect(() => galene.roomGroupName("Aurora", "aa11bb22cc33dd44")).toThrow(ValidationError);
      expect(() => galene.roomGroupName("aurora-games", "../../etc/passwd")).toThrow(ValidationError);
    });
  });

  describe("createJoinTokenAndUrl()", () => {
    test("emite JWT com claims do Galene e URL de entrada", async () => {
      process.env.GALENE_GROUPS_DIR = groupsDir;
      process.env.MEET_URL = "wss://meet.example.com";

      const roomId = "cafe0000cafe0000";
      const nowMs = Date.now();
      const endsAt = new Date(nowMs + 2 * 60 * 60 * 1000).toISOString();

      const { joinUrl, token, expiresAt } = await galene.createJoinTokenAndUrl({
        studio: "aurora-games",
        roomId,
        username: "Maria Silva",
        permissions: galene.GALENE_PERMISSIONS.member,
        endsAt,
      });

      const [, payloadB64] = token.split(".");
      const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));

      // A audiência é o ESTÚDIO (não a sala): com `include-subgroups` o Galene
      // casa por prefixo (galene/token/jwt.go → matchGroup), então o token
      // vale para qualquer sala do estúdio e para nenhuma de outro.
      expect(payload.aud).toBe("https://meet.example.com/group/aurora-games/");
      expect(payload["include-subgroups"]).toBe(true);
      expect(payload.sub).toBe("Maria Silva");
      expect(payload.permissions).toEqual(galene.GALENE_PERMISSIONS.member);
      expect(payload.exp - payload.iat).toBeGreaterThan(7000);
      expect(payload.exp - payload.iat).toBeLessThanOrEqual(7300);

      const expiryMs = new Date(expiresAt).getTime();
      expect(expiryMs).toBeGreaterThan(nowMs);
      expect(expiryMs).toBeLessThanOrEqual(new Date(endsAt).getTime());

      // A URL aponta para a SALA (subgrupo), não para o escopo do token.
      expect(joinUrl).toBe(`https://meet.example.com/group/aurora-games/${roomId}/?username=${encodeURIComponent("Maria Silva")}&token=${token}`);
    });

    test("expira no código do convidado quando ele termina antes da reunião", async () => {
      process.env.GALENE_GROUPS_DIR = groupsDir;
      process.env.MEET_URL = "wss://meet.example.com";

      const nowMs = Date.now();
      const endsAt = new Date(nowMs + 5 * 60 * 60 * 1000).toISOString();
      const codeExpiresAt = new Date(nowMs + 60 * 60 * 1000).toISOString();

      const { expiresAt } = await galene.createJoinTokenAndUrl({
        studio: "aurora-games",
        roomId: "guestroom00001",
        username: "Visitante",
        permissions: galene.GALENE_PERMISSIONS.guest,
        endsAt,
        codeExpiresAt,
      });

      expect(new Date(expiresAt).getTime()).toBeLessThanOrEqual(new Date(codeExpiresAt).getTime());
      expect(new Date(expiresAt).getTime()).toBeGreaterThan(nowMs);
    });

    test("usa nome padrão quando username não é informado", async () => {
      process.env.GALENE_GROUPS_DIR = groupsDir;
      process.env.MEET_URL = "wss://meet.example.com";

      const { joinUrl } = await galene.createJoinTokenAndUrl({
        studio: "aurora-games",
        roomId: "nousername0001",
        permissions: galene.GALENE_PERMISSIONS.guest,
        endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });

      const token = new URL(joinUrl).searchParams.get("token");
      const [, payloadB64] = token.split(".");
      const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));

      expect(payload.sub).toBe("Convidado");
      expect(joinUrl).toContain(`username=${encodeURIComponent("Convidado")}`);
    });
  });

  describe("getAuthSecret()", () => {
    const originalEnv = { ...process.env };

    test("exige GALENE_AUTH_SECRET em produção", () => {
      process.env.NODE_ENV = "production";
      delete process.env.GALENE_AUTH_SECRET;

      try {
        expect(() => galene.getAuthSecret()).toThrow(/GALENE_AUTH_SECRET/);
      } finally {
        process.env.NODE_ENV = originalEnv.NODE_ENV;
        if (originalEnv.GALENE_AUTH_SECRET === undefined) {
          delete process.env.GALENE_AUTH_SECRET;
        } else {
          process.env.GALENE_AUTH_SECRET = originalEnv.GALENE_AUTH_SECRET;
        }
      }
    });

    test("usa fallback determinístico de 32 bytes fora de produção", () => {
      process.env.NODE_ENV = "test";
      delete process.env.GALENE_AUTH_SECRET;

      const { keyBytes, encoded } = galene.getAuthSecret();
      expect(keyBytes).toHaveLength(32);
      expect(Buffer.from(encoded, "base64url")).toHaveLength(32);
    });

    test("rejeita chave com menos de 32 bytes (HS256 exige exatamente 32)", () => {
      process.env.NODE_ENV = "test";
      process.env.GALENE_AUTH_SECRET = "q4NU-U5Nx5I5FkttMVMVIg"; // 16 bytes

      try {
        expect(() => galene.getAuthSecret()).toThrow(/exatamente 32 bytes/);
      } finally {
        delete process.env.GALENE_AUTH_SECRET;
      }
    });

    test("rejeita chave com mais de 32 bytes (HS256 exige exatamente 32)", () => {
      process.env.NODE_ENV = "test";
      // 38 bytes: era o antigo fallback de desenvolvimento.
      process.env.GALENE_AUTH_SECRET = "aW5kaWVzYnJhbC1kZXYtZ2FsZW5lLXNlY3JldC0zMi1ieXRlcyE";

      try {
        expect(() => galene.getAuthSecret()).toThrow(/exatamente 32 bytes/);
      } finally {
        delete process.env.GALENE_AUTH_SECRET;
      }
    });
  });
});
