import { normalizeUsername, usernameProblem, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/lib/username";

/**
 * Testes unitários da forma canônica do username.
 *
 * O que está sendo protegido aqui é a razão de o perfil responder 404: o
 * username era gravado exatamente como digitado — com espaço nas pontas e
 * caractere invisível —, e a busca compara bytes. Todo caso abaixo é um valor
 * que existia em produção e deixava o perfil inalcançável pela URL.
 */

describe("lib/username.js", () => {
  describe("normalizeUsername()", () => {
    test("apara espaço nas pontas", () => {
      // "Yuri d Ávila " (13 chars) estava gravado assim em produção.
      expect(normalizeUsername("Yuri d \u00c1vila ")).toBe("Yuri d \u00c1vila");
      expect(normalizeUsername("  Henrique  ")).toBe("Henrique");
      expect(normalizeUsername("  Marcos Saory ")).toBe("Marcos Saory");
    });

    test("remove hífen suave e outros caracteres invisíveis", () => {
      // O nome real era "B" + 6 hífens suaves + "." + 3 hífens + ".." + espaço.
      // O hífen suave não aparece na tela, então ninguém reproduz o nome.
      const real = "B" + "\u00ad".repeat(6) + "." + "\u00ad".repeat(3) + ".. ";
      expect(normalizeUsername(real)).toBe("B...");

      // Zero-width space, zero-width non-joiner/joiner, word joiner e BOM.
      expect(normalizeUsername("a\u200bb")).toBe("ab");
      expect(normalizeUsername("a\u200cb")).toBe("ab");
      expect(normalizeUsername("a\u200db")).toBe("ab");
      expect(normalizeUsername("a\u2060b")).toBe("ab");
      expect(normalizeUsername("a\ufeffb")).toBe("ab");
      expect(normalizeUsername("a\u180eb")).toBe("ab");
    });

    test("normaliza o acento para NFC (a forma que a URL carrega)", () => {
      // `A` + acento combinante (NFD) contra `Á` composto (NFC): são strings
      // diferentes byte a byte e não casavam na busca.
      const nfd = "A\u0301vila";
      expect(nfd === nfd.normalize("NFC")).toBe(false);
      expect(normalizeUsername(nfd)).toBe("\u00c1vila");
      expect(normalizeUsername(nfd)).toBe(normalizeUsername("\u00c1vila"));
    });

    test("troca espaços exóticos pelo espaço comum da URL", () => {
      // A URL sempre manda %20 (U+0020); qualquer outro espaço não casa.
      expect(normalizeUsername("Yuri d\u00a0\u00c1vila")).toBe("Yuri d \u00c1vila"); // NBSP
      expect(normalizeUsername("a\u2007b")).toBe("a b");
      expect(normalizeUsername("a\u202fb")).toBe("a b");
      expect(normalizeUsername("a\u3000b")).toBe("a b");
      expect(normalizeUsername("a\tb")).toBe("a b");
      expect(normalizeUsername("a\nb")).toBe("a b");
    });

    test("colapsa espaços repetidos", () => {
      expect(normalizeUsername("Thiago  dos   Santos")).toBe("Thiago dos Santos");
      expect(normalizeUsername("a \u00a0 b")).toBe("a b");
    });

    test("não muda nome que já está na forma canônica", () => {
      for (const name of ["Kak\u00e1Carioca", "Thiago dos Santos", "camilatias", "Ian de Oliveira Fernandes"]) {
        expect(normalizeUsername(name)).toBe(name);
      }
    });

    test("combina os casos: invisível + espaço exótico + acento decomposto", () => {
      const sujo = "  B\u00adruno\u00a0A\u0301vila  ";
      expect(normalizeUsername(sujo)).toBe("Bruno \u00c1vila");
    });

    test("tolera entrada ausente ou não-string", () => {
      expect(normalizeUsername(undefined)).toBe("");
      expect(normalizeUsername(null)).toBe("");
      expect(normalizeUsername("")).toBe("");
    });
  });

  describe("usernameProblem()", () => {
    test("recusa vazio", () => {
      expect(usernameProblem("")).toBe("Informe um nome de usuário.");
      // Nome feito só de espaços/invisíveis vira vazio depois de normalizar.
      expect(usernameProblem(normalizeUsername("  \u00ad  "))).toBe("Informe um nome de usuário.");
    });

    test("recusa abaixo do mínimo", () => {
      expect(usernameProblem("ab")).toContain(String(USERNAME_MIN_LENGTH));
      expect(usernameProblem("abc")).toBeNull();
    });

    test("recusa acima do máximo", () => {
      const noLimite = "a".repeat(USERNAME_MAX_LENGTH);
      expect(usernameProblem(noLimite)).toBeNull();
      expect(usernameProblem(`${noLimite}a`)).toContain(String(USERNAME_MAX_LENGTH));
    });

    test("aceita espaço interno e acento (são nomes legítimos da base)", () => {
      expect(usernameProblem("Thiago dos Santos")).toBeNull();
      expect(usernameProblem("Kak\u00e1Carioca")).toBeNull();
    });
  });
});
