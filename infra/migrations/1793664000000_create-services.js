/**
 * Serviços prestados por estúdios.
 *
 * Três tabelas, com papéis diferentes — misturá-las foi o que tornou a
 * taxonomia de assets difícil de evoluir:
 *
 *   `services`             — catálogo **curado pelo admin** (nome, grupo, ativo).
 *                            É a lista que o visitante percorre e o estúdio
 *                            escolhe. Muda por decisão editorial, não por uso.
 *   `organization_services` — **declaração**: este estúdio presta este serviço,
 *                            com um resumo de como faz e um valor de referência
 *                            opcional. Muda a cada salvamento do estúdio.
 *   `service_suggestions`  — **sugestão** de qualquer usuário autenticado,
 *                            esperando decisão do admin.
 *
 * ## Por que `RESTRICT` e não `CASCADE` em `organization_services`
 *
 * Cascata apagaria a declaração de todos os estúdios sem ninguém pedir — o
 * mesmo risco que `asset_category_links` já evita. Serviço em uso é
 * **desativado** (`is_active = false`), o que o tira do seletor e dos filtros
 * mas preserva os vínculos. Excluir de verdade só quando ninguém usa, e a API
 * responde 400 com a contagem.
 *
 * ## `price` é informativo
 *
 * Não há checkout: o negócio fecha por mensagem direta. O valor serve para o
 * visitante filtrar mentalmente ("cabe no orçamento?") e fica ao lado de
 * `price_note`, que cobre o caso mais comum de serviço — que não é preço fixo
 * ("por projeto", "a combinar").
 */

/** Serviços iniciais. O grupo é estrutura de apresentação (`lib/serviceGroups.js`). */
const SEED_SERVICES = [
  // Desenvolvimento
  ["desenvolvimento", "Desenvolvimento", "desenvolvimento", 0],
  ["portabilidade", "Portabilidade", "desenvolvimento", 1],
  ["advergames-jogos-corporativos", "Advergames e Jogos Corporativos", "desenvolvimento", 2],
  ["gaas", "GaaS (Gestão e Manutenção)", "desenvolvimento", 3],

  // Arte e Áudio
  ["producao-de-assets", "Produção de Assets (Arte/Áudio)", "arte-audio", 0],
  ["voice-acting", "Voice Acting", "arte-audio", 1],
  ["captura-de-movimentos", "Captura de Movimentos", "arte-audio", 2],

  // Produção e Publicação
  ["publicacao", "Serviços de Publicação (Publishing)", "producao", 0],
  ["marketing-rp", "Marketing e Relações Públicas", "producao", 1],

  // Qualidade e Idioma
  ["qa-testes", "QA e Testes de Bugs", "qualidade", 0],
  ["localizacao-traducao", "Localização e Tradução", "qualidade", 1],

  // Estratégia e Legal
  ["consultoria-tecnica-design", "Consultoria Técnica e de Design", "estrategia", 0],
  ["consultoria-juridica", "Consultoria Jurídica Especializada", "estrategia", 1],
];

exports.up = (pgm) => {
  /* ---------------------------------------------------------------
   * 1. services — catálogo curado
   * --------------------------------------------------------------- */
  pgm.createTable("services", {
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

  pgm.createIndex("services", "group_key");
  pgm.createIndex("services", "is_active");

  for (const [slug, name, groupKey, displayOrder] of SEED_SERVICES) {
    pgm.sql(
      `INSERT INTO services (slug, name, group_key, display_order)
       VALUES (${quote(slug)}, ${quote(name)}, ${quote(groupKey)}, ${displayOrder})`,
    );
  }

  /* ---------------------------------------------------------------
   * 2. organization_services — declaração do estúdio
   * --------------------------------------------------------------- */
  pgm.createTable("organization_services", {
    org_id: {
      type: "uuid",
      notNull: true,
      references: "organizations(id)",
      onDelete: "CASCADE",
    },
    service_id: {
      type: "integer",
      notNull: true,
      // RESTRICT: serviço em uso é desativado, não excluído (ver o cabeçalho).
      references: "services(id)",
      onDelete: "RESTRICT",
    },
    // Como o estúdio faz este serviço — é o que diferencia um diretório de uma
    // lista de tags.
    summary: { type: "varchar(200)" },
    // Valor de referência, informativo (não há checkout).
    price: { type: "numeric(10,2)" },
    // "por projeto", "a combinar", "por hora" — o preço de serviço raramente é fixo.
    price_note: { type: "varchar(60)" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.addConstraint("organization_services", "organization_services_pkey", {
    primaryKey: ["org_id", "service_id"],
  });

  pgm.createIndex("organization_services", "service_id");

  /* ---------------------------------------------------------------
   * 3. service_suggestions — fila de decisão do admin
   * --------------------------------------------------------------- */
  pgm.createTable("service_suggestions", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    suggested_by: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    name: { type: "varchar(80)", notNull: true },
    justification: { type: "varchar(500)" },
    status: { type: "varchar(12)", notNull: true, default: "pending" },
    reviewed_by: {
      type: "uuid",
      references: "users(id)",
      onDelete: "SET NULL",
    },
    reviewed_at: { type: "timestamptz" },
    // Preenchido quando a sugestão virou serviço do catálogo.
    service_id: {
      type: "integer",
      references: "services(id)",
      onDelete: "SET NULL",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.addConstraint("service_suggestions", "service_suggestions_status_check", {
    check: "status IN ('pending', 'approved', 'rejected')",
  });

  pgm.createIndex("service_suggestions", "status");
};

exports.down = (pgm) => {
  pgm.dropTable("service_suggestions");
  pgm.dropTable("organization_services");
  pgm.dropTable("services");
};

/** Escapa aspas simples para os literais do seed (valores fixos, sem entrada). */
function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
