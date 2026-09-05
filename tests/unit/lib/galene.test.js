import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import galene from "@/lib/galene";
import { ValidationError } from "@/infra/errors";

/**
 * Testes unitários do provisionamento Galene (Fase 3).
 * Não dependem de servidor/banco: validam escrita de grupo, emissão de JWT
 * (claims aceitas pelo Galene 1.1) e montagem da URL de entrada.
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

  describe("ensureRoomProvisioned()", () => {
    test("grava groups/<room>.json com authKeys e allow-anonymous false", async () => {
      process.env.GALENE_GROUPS_DIR = groupsDir;
      process.env.MEET_URL = "wss://meet.example.com";

      const roomId = "aa11bb22cc33dd44";
      const written = await galene.ensureRoomProvisioned(roomId);

      expect(written).toBe(true);

      const filePath = path.join(groupsDir, `${roomId}.json`);
      const group = JSON.parse(await readFile(filePath, "utf8"));

      expect(group["allow-anonymous"]).toBe(false);
      expect(group.authKeys).toHaveLength(1);
      expect(group.authKeys[0]).toMatchObject({ kty: "oct", alg: "HS256" });
      expect(group.authKeys[0].k).toBe(galene.getAuthSecret().encoded);
    });

    test("é idempotente: não reescreve quando o conteúdo é igual", async () => {
      process.env.GALENE_GROUPS_DIR = groupsDir;

      const roomId = "idempotentroom01";
      const first = await galene.ensureRoomProvisioned(roomId);
      const filePath = path.join(groupsDir, `${roomId}.json`);
      const contentBefore = await readFile(filePath, "utf8");

      const second = await galene.ensureRoomProvisioned(roomId);
      const contentAfter = await readFile(filePath, "utf8");

      expect(first).toBe(true);
      expect(second).toBe(false);
      expect(contentAfter).toBe(contentBefore);
    });

    test("rejeita room_id com path traversal", async () => {
      process.env.GALENE_GROUPS_DIR = groupsDir;

      await expect(galene.ensureRoomProvisioned("../../etc/passwd")).rejects.toBeInstanceOf(ValidationError);
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
        roomId,
        username: "Maria Silva",
        permissions: galene.GALENE_PERMISSIONS.member,
        endsAt,
      });

      const [, payloadB64] = token.split(".");
      const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));

      expect(payload.aud).toBe("https://meet.example.com/group/cafe0000cafe0000/");
      expect(payload.sub).toBe("Maria Silva");
      expect(payload.permissions).toEqual(galene.GALENE_PERMISSIONS.member);
      expect(payload.exp - payload.iat).toBeGreaterThan(7000);
      expect(payload.exp - payload.iat).toBeLessThanOrEqual(7300);

      const expiryMs = new Date(expiresAt).getTime();
      expect(expiryMs).toBeGreaterThan(nowMs);
      expect(expiryMs).toBeLessThanOrEqual(new Date(endsAt).getTime());

      expect(joinUrl).toBe(`https://meet.example.com/group/${roomId}/?username=${encodeURIComponent("Maria Silva")}&token=${token}`);
    });

    test("expira no código do convidado quando ele termina antes da reunião", async () => {
      process.env.GALENE_GROUPS_DIR = groupsDir;
      process.env.MEET_URL = "wss://meet.example.com";

      const nowMs = Date.now();
      const endsAt = new Date(nowMs + 5 * 60 * 60 * 1000).toISOString();
      const codeExpiresAt = new Date(nowMs + 60 * 60 * 1000).toISOString();

      const { expiresAt } = await galene.createJoinTokenAndUrl({
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

    test("usa fallback determinístico fora de produção", () => {
      process.env.NODE_ENV = "test";
      delete process.env.GALENE_AUTH_SECRET;

      const { keyBytes, encoded } = galene.getAuthSecret();
      expect(keyBytes.length).toBeGreaterThanOrEqual(32);
      expect(encoded).toBeTruthy();
    });
  });
});
