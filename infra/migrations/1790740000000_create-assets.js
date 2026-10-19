/**
 * Migration: Assets referenciados externamente
 *
 * O site **não hospeda** o arquivo do asset: guarda o endereço público onde ele
 * está (itch.io, Kenney, OpenGameArt, Unity Asset Store, GitHub, site do
 * estúdio…) e os metadados que a página precisa para apresentá-lo. A única
 * imagem enviada ao nosso storage é a **capa opcional** (`cover_image_id`),
 * exatamente como em jogos, jogos de mesa e livros.
 *
 * Tabelas criadas:
 *   asset_categories      — taxonomia cadastrada pelo administrador
 *                           (`/admin/asset-categories`), com seed inicial
 *   assets                — tabela principal, sempre ligada a um estúdio
 *   asset_category_links  — N:N assets × categorias (um asset pode ter várias)
 *
 * Decisões que a estrutura fixa:
 *  - `assets.owner_org_id` é NOT NULL: asset só existe dentro de um estúdio.
 *    Não há asset pessoal, e assim a exclusão do estúdio (ou da conta titular)
 *    nunca deixa asset órfão.
 *  - `asset_category_links.category_id` usa RESTRICT de propósito: excluir uma
 *    categoria **em uso** é recusado com a contagem de assets, e o admin a
 *    desativa (`is_active`) em vez de apagar. Cascata aqui sumiria categoria de
 *    assets em silêncio, que é o tipo de perda que ninguém percebe depois.
 *  - `group_key` é validado contra a lista fixa de `lib/assetGroups.js`; os
 *    grupos são estrutura de apresentação e não vivem no banco.
 */

/** Categorias iniciais — a taxonomia da lista de referência de game assets. */
const SEED_CATEGORIES = [
  // Arte 2D
  ["sprites", "Sprites", "Imagens estáticas ou quadros de animação de personagens, inimigos, itens e projéteis.", "arte-2d", 0],
  ["tilesets", "Tilesets", "Blocos modulares repetíveis usados para construir cenários e mapas.", "arte-2d", 1],
  ["planos-de-fundo", "Planos de Fundo", "Imagens de fundo, muitas vezes em camadas para criar paralaxe.", "arte-2d", 2],
  ["texturas", "Texturas", "Imagens 2D aplicadas sobre modelos 3D para dar cor, relevo e brilho.", "arte-2d", 3],
  ["concept-art", "Concept Art", "Artes de referência e telas de carregamento.", "arte-2d", 4],
  ["ilustracoes", "Ilustrações", "Ilustrações prontas para capas, menus e divulgação.", "arte-2d", 5],

  // Arte 3D
  ["modelos-3d", "Modelos 3D", "Malhas de personagens, criaturas, veículos e objetos.", "arte-3d", 0],
  ["props", "Props", "Objetos de cenário estáticos ou interativos: cadeiras, caixas, pontes.", "arte-3d", 1],
  ["rigs", "Rigs", "Esqueletos inseridos no modelo para permitir animação.", "arte-3d", 2],
  ["animacoes-3d", "Animações 3D", "Sequências de movimento aplicadas ao esqueleto do modelo.", "arte-3d", 3],

  // Áudio
  ["trilha-sonora", "Trilha Sonora (BGM)", "Músicas completas de fases, menus e batalhas de chefe.", "audio", 0],
  ["efeitos-sonoros", "Efeitos Sonoros (SFX)", "Sons curtos provocados por ações: passos, impactos, cliques.", "audio", 1],
  ["ambiencia", "Ambience", "Áudios contínuos de atmosfera: vento, chuva, pássaros, taverna.", "audio", 2],
  ["dublagem", "Dublagem", "Falas de personagens e narradores.", "audio", 3],

  // Interface e tipografia
  ["fontes", "Fontes", "Tipografias (TTF/OTF) para menus, diálogos, pontuação e legendas.", "ui", 0],
  ["hud", "HUD", "Barras de vida, medidores de energia, minimapas e contadores.", "ui", 1],
  ["elementos-de-menu", "Elementos de Menu", "Botões, caixas de diálogo, inventário, cursores e ícones.", "ui", 2],

  // VFX e shaders
  ["particulas", "Partículas", "Fogo, fumaça, faíscas, magia, sangue e poeira.", "vfx", 0],
  ["shaders", "Shaders", "Efeitos de luz e superfície: água, cel-shading, reflexos.", "vfx", 1],

  // Código e engenharia
  ["plugins", "Plugins e Extensões", "Ferramentas que adicionam funções ao editor da engine.", "codigo", 0],
  ["sistemas-de-mecanicas", "Sistemas de Mecânicas", "Scripts prontos de câmera, IA de inimigos, inventário, tweening.", "codigo", 1],
  ["modulos-de-fisica", "Módulos de Física", "Simulação de gravidade, colisões, tecidos e fluidos.", "codigo", 2],
];

exports.up = (pgm) => {
  /* ---------------------------------------------------------------
   * 1. asset_categories — taxonomia administrável
   * --------------------------------------------------------------- */
  pgm.createTable("asset_categories", {
    id: { type: "serial", primaryKey: true },
    slug: { type: "varchar(60)", notNull: true, unique: true },
    name: { type: "varchar(80)", notNull: true },
    description: { type: "varchar(255)" },
    group_key: { type: "varchar(30)", notNull: true },
    display_order: { type: "integer", notNull: true, default: 0 },
    is_active: { type: "boolean", notNull: true, default: true },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("asset_categories", "group_key");
  pgm.createIndex("asset_categories", "is_active");

  for (const [slug, name, description, groupKey, displayOrder] of SEED_CATEGORIES) {
    pgm.sql(
      `INSERT INTO asset_categories (slug, name, description, group_key, display_order)
       VALUES (${quote(slug)}, ${quote(name)}, ${quote(description)}, ${quote(groupKey)}, ${displayOrder})`,
    );
  }

  /* ---------------------------------------------------------------
   * 2. assets — metadados + endereço externo
   * --------------------------------------------------------------- */
  pgm.createTable("assets", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    slug: { type: "varchar(140)", notNull: true, unique: true },
    name: { type: "varchar(255)", notNull: true },
    short_description: { type: "varchar(255)" },
    description: { type: "text" },
    // Onde o asset está de fato. O site referencia, não hospeda.
    external_url: { type: "varchar(1024)", notNull: true },
    // Origem legível: itch.io, Kenney, OpenGameArt, site próprio...
    source_name: { type: "varchar(60)" },
    // Autor/origem para atribuição.
    credit: { type: "varchar(255)" },
    license: { type: "varchar(40)", notNull: true, default: "unknown" },
    is_free: { type: "boolean", notNull: true, default: true },
    // Informativo: não há checkout nesta fase.
    price: { type: "numeric(10,2)" },
    file_format: { type: "varchar(120)" },
    cover_image_id: {
      type: "varchar(256)",
      references: "uploaded_images(id)",
      onDelete: "SET NULL",
    },
    // NOT NULL: asset só existe dentro de um estúdio.
    owner_org_id: {
      type: "uuid",
      notNull: true,
      references: "organizations(id)",
      onDelete: "CASCADE",
    },
    owner_id: {
      type: "uuid",
      references: "users(id)",
      onDelete: "SET NULL",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("assets", "owner_org_id");
  pgm.createIndex("assets", "created_at");
  pgm.createIndex("assets", "is_free");

  /* ---------------------------------------------------------------
   * 3. asset_category_links — N:N
   * --------------------------------------------------------------- */
  pgm.createTable("asset_category_links", {
    asset_id: {
      type: "uuid",
      notNull: true,
      references: "assets(id)",
      onDelete: "CASCADE",
    },
    category_id: {
      type: "integer",
      notNull: true,
      // RESTRICT: categoria em uso não pode ser excluída (ver o cabeçalho).
      references: "asset_categories(id)",
      onDelete: "RESTRICT",
    },
  });

  pgm.addConstraint("asset_category_links", "asset_category_links_pkey", {
    primaryKey: ["asset_id", "category_id"],
  });

  pgm.createIndex("asset_category_links", "category_id");
};

exports.down = (pgm) => {
  pgm.dropTable("asset_category_links");
  pgm.dropTable("assets");
  pgm.dropTable("asset_categories");
};

/** Escapa aspas simples para os literais do seed (valores fixos, sem entrada). */
function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
