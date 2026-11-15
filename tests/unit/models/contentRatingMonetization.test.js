import { calculateGameRating } from "@/models/content-rating";

/**
 * Motivos de monetização do questionário de jogo.
 *
 * ## O defeito que originou este arquivo
 *
 * Em produção, um jogo classificado como 10 anos mostrava o motivo:
 *
 *     Monetização (Lei Felca): classificação 10 — microtransações
 *
 * para quem havia respondido **"apenas expansões ou DLCs"**. A frase vinha das
 * *flags de selo* (`hasInGamePurchases` etc.) com um fallback fixo em
 * "microtransações" — e o valor `10` de `m_purchases` não acende nenhuma flag,
 * de propósito. O rótulo afirmava uma coisa que o formulário tinha negado.
 * O mesmo acontecia com "anúncios no menu" (valor `10`, sem
 * `hasExcessiveAds`).
 *
 * A regra que estes testes fixam: **o motivo descreve o que foi respondido**;
 * a flag de selo é outra pergunta ("tem selo?"), e as duas não podem ser
 * confundidas.
 */
describe("models/content-rating — motivo de monetização", () => {
  function monetizationReasons(answers) {
    return calculateGameRating(answers).reasons.filter((reason) => reason.startsWith("Monetização"));
  }

  test("DLC e expansão são descritas como tal, não como microtransação", () => {
    const reasons = monetizationReasons({ m_purchases: "10" });

    expect(reasons).toEqual(["Monetização (ECA Digital): classificação 10 anos — expansões e DLCs"]);
    expect(reasons[0]).not.toContain("microtransações");
  });

  test("anúncio em menu não é chamado de microtransação", () => {
    const reasons = monetizationReasons({ m_ads: "10" });

    expect(reasons[0]).toContain("anúncios em menus e telas de carregamento");
    expect(reasons[0]).not.toContain("microtransações");
  });

  test("cada resposta de lootbox tem sua própria descrição", () => {
    expect(monetizationReasons({ m_lootboxes: "16" })[0]).toContain("lootboxes pagas com probabilidades divulgadas");
    expect(monetizationReasons({ m_lootboxes: "18" })[0]).toContain("lootboxes pagas que afetam a jogabilidade");
  });

  test("o motivo usa a unidade da faixa, não o valor cru", () => {
    // "classificação 10" não diz de que unidade se trata; o selo diz "10 anos".
    expect(monetizationReasons({ m_purchases: "16" })[0]).toContain("classificação 16 anos");
    expect(monetizationReasons({ m_purchases: "16" })[0]).not.toMatch(/classificação 16 —/);
  });

  test("respostas neutras em todas as perguntas não geram motivo", () => {
    const reasons = monetizationReasons({ m_lootboxes: "L", m_purchases: "L", m_ads: "L" });

    expect(reasons).toEqual([]);
  });

  test("respostas combinadas aparecem na ordem do questionário", () => {
    const reasons = monetizationReasons({ m_lootboxes: "18", m_purchases: "18", m_ads: "14" });

    expect(reasons[0]).toContain("lootboxes pagas que afetam a jogabilidade, compras predatórias, anúncios frequentes");
  });

  test("a classificação final sobe para a maior faixa respondida", () => {
    // **Decisão de produto mantida**: monetização é um eixo que conta para a
    // faixa etária, não só um selo informativo. A alternativa (faixa só por
    // violência/sexo/drogas) foi considerada e descartada — ver o comentário no
    // bloco de monetização de `calculateGameRating`.
    expect(calculateGameRating({ m_purchases: "10" }).rating).toBe("10");
    expect(calculateGameRating({ m_lootboxes: "18" }).rating).toBe("18");
  });

  test("jogo só com DLC sai como 10 anos, sem qualquer conteúdo sensível", () => {
    // Consequência direta da decisão acima, fixada para não surpreender quem
    // mexer no cálculo: nada de violência, sexo ou drogas foi respondido.
    const result = calculateGameRating({ m_purchases: "10" });

    expect(result.rating).toBe("10");
    expect(result.reasons.some((reason) => reason.startsWith("Violência"))).toBe(false);
    expect(result.reasons.some((reason) => reason.startsWith("Drogas"))).toBe(false);
  });

  test("o selo continua sendo decidido pelas flags, não pelo texto", () => {
    // DLC (10) não acende "compras no jogo"; cosmético pago (12) acende.
    expect(calculateGameRating({ m_purchases: "10" }).monetizationFlags.hasInGamePurchases).toBe(false);
    expect(calculateGameRating({ m_purchases: "12" }).monetizationFlags.hasInGamePurchases).toBe(true);
    expect(calculateGameRating({ m_ads: "10" }).monetizationFlags.hasExcessiveAds).toBe(false);
    expect(calculateGameRating({ m_ads: "14" }).monetizationFlags.hasExcessiveAds).toBe(true);
  });

  test("o nome da norma é o ECA Digital, não a alcunha antiga", () => {
    const reason = monetizationReasons({ m_purchases: "12" })[0];

    expect(reason).toContain("ECA Digital");
    expect(reason).not.toContain("Felca");
    expect(reason).not.toContain("PL 412");
  });
});
