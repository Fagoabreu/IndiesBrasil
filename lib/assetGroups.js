/**
 * Grupos de categorias de asset — a hierarquia fixa da taxonomia.
 *
 * As **categorias** são dados: vivem em `asset_categories` e são cadastradas
 * pelo administrador em `/admin/asset-categories` (Sprites, Tilesets, SFX…).
 * Os **grupos** são estrutura de apresentação e não mudam com o conteúdo: são
 * eles que agrupam o seletor do estúdio, os filtros da listagem e a tela de
 * administração.
 *
 * Manter os grupos em código (e não numa tabela) é o que evita uma segunda
 * camada de cadastro para algo que só o código sabe renderizar — a lista de
 * chaves é a mesma para o formulário e para o servidor, que revalida
 * `group_key` contra ela a cada escrita.
 */
export const ASSET_GROUPS = [
  { key: "arte-2d", label: "Arte 2D", order: 1 },
  { key: "arte-3d", label: "Arte 3D", order: 2 },
  { key: "audio", label: "Áudio", order: 3 },
  { key: "ui", label: "Interface e Tipografia", order: 4 },
  { key: "vfx", label: "VFX e Shaders", order: 5 },
  { key: "codigo", label: "Código e Engenharia", order: 6 },
];

export const ASSET_GROUP_KEYS = ASSET_GROUPS.map((group) => group.key);

/**
 * Teto de categorias por asset.
 *
 * Vive aqui (e não no model) porque o formulário também precisa dele: importar
 * `models/asset.js` num componente traria o pool do Postgres para o bundle do
 * cliente. O model lê a MESMA constante.
 */
export const MAX_ASSET_CATEGORIES = 8;

/** Verdadeiro quando a chave é um dos grupos conhecidos. */
export function isValidGroupKey(key) {
  return ASSET_GROUP_KEYS.includes(key);
}

/** Rótulo do grupo, ou a própria chave quando ela não existe (dado legado). */
export function assetGroupLabel(key) {
  return ASSET_GROUPS.find((group) => group.key === key)?.label ?? key;
}

/**
 * Ordena grupos pela posição declarada em `ASSET_GROUPS`.
 *
 * A ordenação não pode vir do banco: `display_order` é a posição da categoria
 * DENTRO do grupo, então ordenar por ele misturaria os grupos.
 */
export function compareAssetGroups(a, b) {
  const orderA = ASSET_GROUPS.find((group) => group.key === a)?.order ?? Number.MAX_SAFE_INTEGER;
  const orderB = ASSET_GROUPS.find((group) => group.key === b)?.order ?? Number.MAX_SAFE_INTEGER;
  return orderA - orderB;
}

/** Agrupa categorias por `group_key`, na ordem dos grupos fixos. */
export function groupAssetCategories(categories = []) {
  return [...ASSET_GROUPS]
    .sort((a, b) => a.order - b.order)
    .map((group) => ({
      ...group,
      categories: categories
        .filter((category) => category.group_key === group.key)
        .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "pt-BR")),
    }))
    .filter((group) => group.categories.length > 0);
}
