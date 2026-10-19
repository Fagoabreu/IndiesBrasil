import { isValidAssetUrl, normalizeAssetUrl } from "@/lib/assetUrl";

/**
 * A URL do asset é publicada numa página aberta: o que ela aceita define quais
 * links o site pode exibir. Estes casos fixam as duas pontas — os esquemas que
 * servem como link e os que são vetor (`javascript:`, `data:`) ou vazam
 * credencial.
 */
describe("URL externa de asset", () => {
  test("Aceita http e https e devolve a forma canônica", () => {
    expect(normalizeAssetUrl("https://exemplo.itch.io/pacote")).toBe("https://exemplo.itch.io/pacote");
    expect(normalizeAssetUrl("  http://exemplo.com  ")).toBe("http://exemplo.com/");
  });

  test("Recusa esquemas que não são link", () => {
    expect(normalizeAssetUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeAssetUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(normalizeAssetUrl("ftp://exemplo.com/arquivo.zip")).toBeNull();
    expect(normalizeAssetUrl("file:///etc/passwd")).toBeNull();
  });

  test("Recusa credenciais embutidas", () => {
    expect(normalizeAssetUrl("https://usuario:senha@exemplo.com/pacote")).toBeNull();
    expect(normalizeAssetUrl("https://usuario@exemplo.com/pacote")).toBeNull();
  });

  test("Recusa valor vazio, inválido ou que não é string", () => {
    expect(normalizeAssetUrl("")).toBeNull();
    expect(normalizeAssetUrl("   ")).toBeNull();
    expect(normalizeAssetUrl("nao-e-uma-url")).toBeNull();
    expect(normalizeAssetUrl(null)).toBeNull();
    expect(normalizeAssetUrl(42)).toBeNull();
  });

  test("isValidAssetUrl acompanha a normalização", () => {
    expect(isValidAssetUrl("https://kenney.nl/assets")).toBe(true);
    expect(isValidAssetUrl("javascript:alert(1)")).toBe(false);
  });
});
