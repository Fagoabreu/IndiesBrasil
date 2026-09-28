import { formatBrPhone, parseBrPhone, toDigits, toE164Br } from "@/lib/phone";

/**
 * Testes unitários da validação de telefone brasileiro.
 *
 * O que está sendo protegido aqui é a diferença entre "parece um telefone" e
 * "é um telefone": DDD inexistente e celular com 8 dígitos passam por qualquer
 * checagem de tamanho e são exatamente os erros que chegam no cadastro.
 */

describe("lib/phone.js", () => {
  describe("toDigits()", () => {
    test("remove máscara e mantém só dígitos", () => {
      expect(toDigits("(11) 99999-9999")).toBe("11999999999");
      expect(toDigits("11 3333-4444")).toBe("1133334444");
    });

    test("remove o código do país quando há número nacional completo", () => {
      expect(toDigits("+55 (11) 99999-9999")).toBe("11999999999");
      expect(toDigits("5511999999999")).toBe("11999999999");
      expect(toDigits("551133334444")).toBe("1133334444");
    });

    test("NÃO remove o 55 quando ele é o DDD (Rio Grande do Sul)", () => {
      // "55 99999-9999" é um celular de Porto Alegre, não código de país.
      expect(toDigits("55 99999-9999")).toBe("55999999999");
      expect(toDigits("5533334444")).toBe("5533334444");
    });

    test("ignora entrada não-string ou longa demais", () => {
      expect(toDigits(null)).toBe("");
      expect(toDigits(42)).toBe("");
      expect(toDigits("9".repeat(41))).toBe("");
    });
  });

  describe("parseBrPhone()", () => {
    test("aceita celular: 11 dígitos com DDD válido", () => {
      expect(parseBrPhone("(11) 99999-9999")).toMatchObject({
        digits: "11999999999",
        areaCode: 11,
        kind: "mobile",
      });
    });

    test("aceita fixo: 10 dígitos com DDD válido", () => {
      expect(parseBrPhone("(21) 3333-4444")).toMatchObject({
        digits: "2133334444",
        areaCode: 21,
        kind: "fixed",
      });
    });

    test("aceita com e sem máscara, e com +55", () => {
      expect(parseBrPhone("11999999999")?.digits).toBe("11999999999");
      expect(parseBrPhone("+55 11 99999 9999")?.digits).toBe("11999999999");
    });

    test("recusa DDD que não existe", () => {
      // 20, 26 e 36 parecem plausíveis e não são DDD nenhum: é o erro de
      // digitar dois dígitos trocados.
      expect(parseBrPhone("(20) 99999-9999")).toBeNull();
      expect(parseBrPhone("(26) 99999-9999")).toBeNull();
      expect(parseBrPhone("(36) 99999-9999")).toBeNull();
      expect(parseBrPhone("(00) 99999-9999")).toBeNull();
    });

    test("recusa comprimento errado", () => {
      expect(parseBrPhone("119999999")).toBeNull(); // 9 dígitos
      expect(parseBrPhone("119999999999")).toBeNull(); // 12 dígitos
      expect(parseBrPhone("")).toBeNull();
      expect(parseBrPhone(null)).toBeNull();
    });

    test("celular com 8 dígitos é recusado (número anterior ao nono dígito)", () => {
      expect(parseBrPhone("(11) 9999-9999")).toBeNull();
    });

    test("celular precisa começar com 9", () => {
      // 11 dígitos cujo nono dígito não é 9 não é celular.
      expect(parseBrPhone("(11) 89999-9999")).toBeNull();
    });

    test("fixo precisa começar entre 2 e 5", () => {
      expect(parseBrPhone("(11) 1111-1111")).toBeNull();
      expect(parseBrPhone("(11) 6111-1111")).toBeNull();
      expect(parseBrPhone("(11) 7111-1111")).toBeNull();
      expect(parseBrPhone("(11) 8111-1111")).toBeNull();
    });

    test("10 dígitos começando em 9 é celular ANTIGO, sem o nono dígito", () => {
      // Era um número válido antes de 2016; hoje o formato certo tem 11 dígitos.
      expect(parseBrPhone("(11) 9111-1111")).toBeNull();
    });
  });

  describe("formatBrPhone()", () => {
    test("formata celular e fixo", () => {
      expect(formatBrPhone("11999999999")).toBe("(11) 99999-9999");
      expect(formatBrPhone("2133334444")).toBe("(21) 3333-4444");
    });

    test("normaliza formatos diferentes para a mesma saída", () => {
      const esperado = "(11) 99999-9999";
      expect(formatBrPhone("+55 11 99999 9999")).toBe(esperado);
      expect(formatBrPhone("11999999999")).toBe(esperado);
      expect(formatBrPhone("(11) 9 9999-9999")).toBe(esperado);
    });

    test("devolve vazio para número inválido", () => {
      expect(formatBrPhone("(20) 99999-9999")).toBe("");
      expect(formatBrPhone("qualquer coisa")).toBe("");
    });
  });

  describe("toE164Br()", () => {
    test("devolve 55 + número nacional", () => {
      expect(toE164Br("(11) 99999-9999")).toBe("5511999999999");
      expect(toE164Br("2133334444")).toBe("552133334444");
    });

    test("idempotente: um número já normalizado não ganha outro 55", () => {
      const uma = toE164Br("11999999999");
      expect(toE164Br(uma)).toBe(uma);
    });

    test("devolve vazio para número inválido", () => {
      expect(toE164Br("(20) 99999-9999")).toBe("");
      expect(toE164Br("abc")).toBe("");
    });
  });
});
