import { googlePlayPackageId, googlePlayUrl, storeAppTitle, storeCtaLabel } from "@/lib/storeLinks";

/**
 * Reconhecimento do link da Play Store.
 *
 * O ponto do módulo é não deixar a seção "Onde comprar" depender do HTML da
 * loja: o card abre sempre a ficha do app, e a única coisa que se extrai da URL
 * é o id do pacote. Um id malformado viraria destino para uma página inexistente
 * — ou pior, para outro app.
 */

describe("lib/storeLinks.js — googlePlayPackageId()", () => {
  test("ficha do app", () => {
    expect(googlePlayPackageId("https://play.google.com/store/apps/details?id=com.company.mergeisland")).toBe("com.company.mergeisland");
  });

  test("parâmetros de idioma e campanha são ignorados", () => {
    expect(googlePlayPackageId("https://play.google.com/store/apps/details?id=com.company.mergeisland&hl=pt_BR&gl=BR&utm_source=share")).toBe(
      "com.company.mergeisland",
    );
  });

  test("host com www e em caixa alta", () => {
    expect(googlePlayPackageId("https://WWW.Play.Google.com/store/apps/details?id=com.company.mergeisland")).toBe("com.company.mergeisland");
  });

  test("pacote com underscore e números", () => {
    expect(googlePlayPackageId("https://play.google.com/store/apps/details?id=br.com.studio_jogo2.app")).toBe("br.com.studio_jogo2.app");
  });

  test("busca e categoria não são ficha de app", () => {
    expect(googlePlayPackageId("https://play.google.com/store/search?q=merge%20island&c=apps")).toBeNull();
    expect(googlePlayPackageId("https://play.google.com/store/apps/category/GAME")).toBeNull();
  });

  test("id com um único segmento é recusado", () => {
    // `?id=abc` abriria uma página da Play que não existe.
    expect(googlePlayPackageId("https://play.google.com/store/apps/details?id=abc")).toBeNull();
  });

  test("id com hífen ou caractere inválido é recusado", () => {
    expect(googlePlayPackageId("https://play.google.com/store/apps/details?id=com.company.merge-island")).toBeNull();
    expect(googlePlayPackageId("https://play.google.com/store/apps/details?id=com.company.merge%20island")).toBeNull();
  });

  test("outras lojas devolvem null", () => {
    expect(googlePlayPackageId("https://store.steampowered.com/app/391540")).toBeNull();
    expect(googlePlayPackageId("https://empresa.itch.io/jogo")).toBeNull();
    expect(googlePlayPackageId("https://apps.apple.com/br/app/jogo/id123456789")).toBeNull();
  });

  test("URL inválida ou ausente devolve null em vez de lançar", () => {
    expect(googlePlayPackageId("not-a-url")).toBeNull();
    expect(googlePlayPackageId("")).toBeNull();
    expect(googlePlayPackageId(undefined)).toBeNull();
    expect(googlePlayPackageId(null)).toBeNull();
  });
});

describe("lib/storeLinks.js — googlePlayUrl()", () => {
  test("link canônico, sem parâmetros do compartilhamento", () => {
    expect(googlePlayUrl("https://play.google.com/store/apps/details?id=com.company.mergeisland&hl=pt_BR&gl=BR")).toBe(
      "https://play.google.com/store/apps/details?id=com.company.mergeisland",
    );
  });

  test("sem id de pacote não há destino", () => {
    expect(googlePlayUrl("https://play.google.com/store/search?q=jogo")).toBeNull();
  });
});

describe("lib/storeLinks.js — storeAppTitle()", () => {
  test("remove o sufixo que a Play põe no título", () => {
    expect(storeAppTitle("Minecraft: Jogue com amigos – Apps no Google Play")).toBe("Minecraft: Jogue com amigos");
    expect(storeAppTitle("Merge Island - Apps on Google Play")).toBe("Merge Island");
  });

  test("título sem sufixo passa intacto", () => {
    expect(storeAppTitle("Merge Island")).toBe("Merge Island");
  });

  test("sem título devolve null", () => {
    expect(storeAppTitle(null)).toBeNull();
    expect(storeAppTitle("")).toBeNull();
  });
});

describe("lib/storeLinks.js — storeCtaLabel()", () => {
  test("lojas conhecidas ganham chamada própria", () => {
    expect(storeCtaLabel("Google Play")).toBe("Ver no Google Play");
    expect(storeCtaLabel("App Store")).toBe("Ver na App Store");
    expect(storeCtaLabel("Epic Games Store")).toBe("Ver na Epic Games Store");
    expect(storeCtaLabel("GOG")).toBe("Ver na GOG");
  });

  test("espaços e caixa não importam", () => {
    expect(storeCtaLabel("  google play ")).toBe("Ver no Google Play");
    expect(storeCtaLabel("GOG")).toBe("Ver na GOG");
  });

  test("loja desconhecida mantém o rótulo genérico", () => {
    expect(storeCtaLabel("Nuuvem")).toBe("Visitar loja");
    expect(storeCtaLabel(null)).toBe("Visitar loja");
  });
});
