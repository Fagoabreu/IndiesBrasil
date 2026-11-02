import {
  MAX_STUDIO_SERVICES,
  SERVICE_GROUPS,
  SERVICE_GROUP_KEYS,
  formatServicePrice,
  groupServices,
  isValidServiceGroup,
  serviceGroupLabel,
} from "@/lib/serviceGroups";
import { normalizePrice } from "@/lib/price";

/**
 * Registro dos grupos de serviço.
 *
 * O que este teste protege:
 *
 * 1. **A ordem dos grupos é fixa e única** — os chips de `/servicos`, o seletor
 *    do estúdio e a tela de admin leem daqui; um grupo repetido faria a mesma
 *    seção aparecer duas vezes na listagem.
 * 2. **Agrupar não perde nem duplica serviço** — um `group_key` que não exista
 *    em `SERVICE_GROUPS` desapareceria em silêncio, e o estúdio acharia que
 *    desmarcou o serviço.
 * 3. **O valor é informativo e a nota pode vir sozinha** — "A combinar" é o caso
 *    mais comum de serviço, e sem preço a nota precisa continuar aparecendo.
 */
describe("lib/serviceGroups.js", () => {
  test("os cinco grupos existem, em ordem e sem repetição", () => {
    expect(SERVICE_GROUPS).toHaveLength(5);
    expect(new Set(SERVICE_GROUP_KEYS).size).toBe(SERVICE_GROUPS.length);

    const orders = SERVICE_GROUPS.map((group) => group.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });

  test("cada grupo tem chave e rótulo legíveis", () => {
    for (const group of SERVICE_GROUPS) {
      expect(group.key).toMatch(/^[a-z-]+$/);
      expect(group.label.length).toBeGreaterThan(0);
    }
  });

  test("isValidServiceGroup aceita só as chaves declaradas", () => {
    expect(isValidServiceGroup("qualidade")).toBe(true);
    expect(isValidServiceGroup("arte")).toBe(false);
    expect(isValidServiceGroup("")).toBe(false);
    expect(isValidServiceGroup(null)).toBe(false);
  });

  test("rótulo de grupo desconhecido volta cru em vez de sumir", () => {
    expect(serviceGroupLabel("qualidade")).toBe("Qualidade e Idioma");
    expect(serviceGroupLabel("inexistente")).toBe("inexistente");
  });

  test("agrupar ordena pelos grupos fixos e não perde serviço", () => {
    const services = [
      { id: 1, name: "QA", group_key: "qualidade", display_order: 0 },
      { id: 2, name: "Desenvolvimento", group_key: "desenvolvimento", display_order: 0 },
      { id: 3, name: "Portabilidade", group_key: "desenvolvimento", display_order: 1 },
    ];

    const grouped = groupServices(services);

    expect(grouped.map((group) => group.key)).toEqual(["desenvolvimento", "qualidade"]);
    expect(grouped[0].services.map((service) => service.name)).toEqual(["Desenvolvimento", "Portabilidade"]);
  });

  test("grupo sem serviço não vira seção vazia", () => {
    const grouped = groupServices([{ id: 1, name: "QA", group_key: "qualidade", display_order: 0 }]);
    expect(grouped).toHaveLength(1);
    expect(grouped.flatMap((group) => group.services)).toHaveLength(1);
  });

  test("o teto de serviços por estúdio é positivo e coerente com o catálogo", () => {
    expect(MAX_STUDIO_SERVICES).toBeGreaterThan(0);
    expect(MAX_STUDIO_SERVICES).toBeLessThanOrEqual(13);
  });

  test("valor com nota vira um texto só", () => {
    // `Intl` usa espaço não separável (U+00A0) entre "R$" e o número — comparar
    // com espaço comum falharia por um caractere invisível.
    const normalized = (text) => text.replace(/\u00A0/g, " ");

    expect(normalized(formatServicePrice(1500, "por projeto"))).toBe("R$ 1.500,00 por projeto");
    expect(normalized(formatServicePrice(1500, null))).toBe("R$ 1.500,00");
  });

  test("sem valor, a nota aparece sozinha", () => {
    expect(formatServicePrice(null, "A combinar")).toBe("A combinar");
    expect(formatServicePrice(null, null)).toBeNull();
    expect(formatServicePrice(null, "   ")).toBeNull();
  });
});

describe("lib/price.js", () => {
  const makeError = (message) => new Error(message);

  test("vazio é ausência de preço, não erro", () => {
    expect(normalizePrice(undefined, makeError)).toBeNull();
    expect(normalizePrice(null, makeError)).toBeNull();
    expect(normalizePrice("", makeError)).toBeNull();
  });

  test("arredonda para duas casas", () => {
    expect(normalizePrice("1500.556", makeError)).toBe(1500.56);
    expect(normalizePrice(0, makeError)).toBe(0);
  });

  test("valor inválido ou negativo é erro do chamador", () => {
    expect(() => normalizePrice("abc", makeError)).toThrow(/valor numérico/);
    expect(() => normalizePrice(-1, makeError)).toThrow(/valor numérico/);
    expect(() => normalizePrice(Infinity, makeError)).toThrow(/valor numérico/);
  });
});
