const { buildDescription, fixReason, normalizeRatingLabel } = require("../../../scripts/fix-monetization-reasons");

/**
 * `scripts/fix-monetization-reasons.js` conserta o motivo de monetização já
 * gravado em `games.content_rating_reasons`.
 *
 * O caso real: um jogo cuja resposta foi "apenas expansões ou DLCs" ficou com
 *
 *     Monetização (Lei Felca): classificação 10 — microtransações
 *
 * no banco. A correção do model vale para novos cálculos; esta é a passada de
 * dados, e por isso é testada separadamente — rodar errado aqui reescreve
 * motivo de classificação de jogo, que tem valor legal.
 */
describe("scripts/fix-monetization-reasons", () => {
  const noFlags = { hasLootboxes: false, hasInGamePurchases: false, hasExcessiveAds: false };

  test("o caso de produção: DLC vira descrição neutra, não 'microtransações'", () => {
    const before = "Monetização (Lei Felca): classificação 10 — microtransações";
    const after = fixReason(before, noFlags);

    expect(after).toBe("Monetização (ECA Digital): classificação 10 anos — compras ou publicidade declaradas");
    expect(after).not.toContain("microtransações");
    expect(after).not.toContain("Felca");
  });

  test("descrição sai das flags quando alguma está ligada", () => {
    expect(fixReason("Monetização (Lei Felca): classificação 18 — microtransações", { ...noFlags, hasLootboxes: true })).toBe(
      "Monetização (ECA Digital): classificação 18 anos — lootboxes pagas",
    );

    expect(
      fixReason("Monetização (Lei Felca): classificação 16 — microtransações", {
        ...noFlags,
        hasLootboxes: true,
        hasInGamePurchases: true,
        hasExcessiveAds: true,
      }),
    ).toBe("Monetização (ECA Digital): classificação 16 anos — lootboxes pagas, compras no jogo, anúncios excessivos");
  });

  test("descrição já detalhada é preservada — só a norma e a unidade mudam", () => {
    const before = "Monetização (Lei Felca): classificação 18 — lootboxes pagas com probabilidades divulgadas";
    const after = fixReason(before, { ...noFlags, hasLootboxes: true });

    expect(after).toBe("Monetização (ECA Digital): classificação 18 anos — lootboxes pagas com probabilidades divulgadas");
  });

  test("motivo que não é de monetização fica intacto", () => {
    const violent = "Violência: classificação 18 — violência extrema";
    expect(fixReason(violent, noFlags)).toBe(violent);
  });

  test("motivo já corrigido não muda (idempotência)", () => {
    const fixed = "Monetização (ECA Digital): classificação 10 anos — expansões e DLCs";
    expect(fixReason(fixed, noFlags)).toBe(fixed);
  });

  test("texto fora do formato reconhecido não é reescrito às cegas", () => {
    const weird = "Monetização (algo): texto que não segue o padrão";
    expect(fixReason(weird, noFlags)).toBe(weird);
  });

  test("faixa vira rótulo com unidade, e 'L' não vira 'L anos'", () => {
    expect(normalizeRatingLabel("10")).toBe("10 anos");
    expect(normalizeRatingLabel("10 anos")).toBe("10 anos");
    expect(normalizeRatingLabel(" 14 ")).toBe("14 anos");
    expect(normalizeRatingLabel("L")).toBe("L");
    expect(normalizeRatingLabel("")).toBe("");
  });

  test("descrição neutra é o último recurso, sem inventar detalhe", () => {
    expect(buildDescription(noFlags)).toBe("compras ou publicidade declaradas");
  });
});
