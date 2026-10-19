import { ASSET_GROUPS, ASSET_GROUP_KEYS, MAX_ASSET_CATEGORIES, isValidGroupKey, assetGroupLabel, groupAssetCategories } from "@/lib/assetGroups";

describe("Taxonomia de assets", () => {
  test("São seis grupos, com chaves únicas e ordem definida", () => {
    expect(ASSET_GROUPS).toHaveLength(6);
    expect(new Set(ASSET_GROUP_KEYS).size).toBe(ASSET_GROUPS.length);
    expect(ASSET_GROUPS.map((group) => group.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("Reconhece apenas as chaves declaradas", () => {
    expect(isValidGroupKey("arte-2d")).toBe(true);
    expect(isValidGroupKey("codigo")).toBe(true);
    expect(isValidGroupKey("arte")).toBe(false);
    expect(isValidGroupKey("")).toBe(false);
    expect(isValidGroupKey(undefined)).toBe(false);
  });

  test("Rótulo do grupo, com fallback para a própria chave", () => {
    expect(assetGroupLabel("audio")).toBe("Áudio");
    expect(assetGroupLabel("grupo-que-nao-existe")).toBe("grupo-que-nao-existe");
  });

  test("Agrupa na ordem dos grupos e ordena por display_order", () => {
    const categories = [
      { id: 1, slug: "shaders", name: "Shaders", group_key: "vfx", display_order: 1 },
      { id: 2, slug: "sprites", name: "Sprites", group_key: "arte-2d", display_order: 1 },
      { id: 3, slug: "tilesets", name: "Tilesets", group_key: "arte-2d", display_order: 0 },
    ];

    const grouped = groupAssetCategories(categories);

    expect(grouped.map((group) => group.key)).toEqual(["arte-2d", "vfx"]);
    expect(grouped[0].categories.map((category) => category.slug)).toEqual(["tilesets", "sprites"]);
  });

  test("Grupo sem categoria não aparece na lista agrupada", () => {
    const grouped = groupAssetCategories([{ id: 1, slug: "sprites", name: "Sprites", group_key: "arte-2d", display_order: 0 }]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].key).toBe("arte-2d");
  });

  test("O teto de categorias por asset é o mesmo que o formulário usa", () => {
    expect(MAX_ASSET_CATEGORIES).toBe(8);
  });
});
