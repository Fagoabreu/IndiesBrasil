/**
 * Profissões deixam de ser enum e passam a ser **dados**.
 *
 * ## Por que isto existe
 *
 * `portfolio_roles.name` era `developer_role` (enum) e a migration de seed
 * inseriu **todos** os valores do enum na tabela. Com isso, qualquer
 * `POST /api/v1/professions` colidia com a primary key e o endpoint respondia
 * 500 — a tela `/admin/professions` nunca conseguiu cadastrar nada, e o teste
 * de integração documentava o defeito em vez de corrigi-lo.
 *
 * Enum também não serve para catálogo editável: o Postgres **não remove** valor
 * de tipo, e cada `ADD VALUE` precisa rodar fora de transação (`noTransaction`).
 * O tipo vira lixo permanente e excluir uma profissão fica impossível.
 *
 * ## O que a conversão preserva
 *
 * `USING name::text` mantém os dados e a FK continua válida, agora apontando
 * para `varchar(80)`. `ON UPDATE CASCADE` é o que permite **renomear** uma
 * profissão em uso ("Escritor" → "Roteirista") e a mudança chegar ao perfil de
 * quem a declarou, em vez de responder 400.
 *
 * `ON DELETE RESTRICT` pelo mesmo motivo de `organization_services`: profissão
 * em uso é **desativada**, não excluída — cascata removeria a especialidade do
 * perfil de todos os usuários sem ninguém pedir.
 *
 * ## Por que o tipo é removido
 *
 * Deixar `developer_role` vivo convidaria alguém a fazer cast de volta, e a
 * fonte da verdade passaria a ter dois donos. O `down` recria o tipo a partir
 * das linhas existentes — e **falha** se alguma profissão criada em produção não
 * couber na lista original, o que é intencional: reverter perderia a
 * classificação de quem a usa.
 *
 * ## Grupos
 *
 * `lib/professionGroups.js` é a estrutura de apresentação (Arte, Programação,
 * Produção, Áudio, Conteúdo, Negócios) — vive em código, como `SERVICE_GROUPS`,
 * porque só o código sabe renderizá-la. A coluna `group_key` é validada contra
 * ela em toda escrita.
 */

/** Distribuição inicial nos grupos (as 25 profissões do enum original). */
const GROUP_OF = {
  "Artista 2D": "arte",
  "Artista 3D": "arte",
  Animador: "arte",
  "Artista Técnico": "arte",
  "Designer de Jogos": "design",
  "Designer de Nivel": "design",
  "Desenvolvedor de Sistema": "design",
  "Desenvolvedor de Narrativa": "design",
  "Designer Tecnico": "design",
  "Designer de UI UX": "design",
  "Programador de Jogos": "programacao",
  "Programador de Motor": "programacao",
  "Prgramador Grafico": "programacao",
  "Programador de Jogabilidade": "programacao",
  "Desenvolvedor de Audio": "audio",
  Compositor: "audio",
  Produtor: "producao",
  Socio: "producao",
  "Diretor Tecnico": "producao",
  "Analista QA": "producao",
  Escritor: "conteudo",
  Educador: "conteudo",
  Jornalista: "conteudo",
  "Gestor de Comunidade": "negocios",
  "Produtor Digital": "negocios",
};

exports.up = (pgm) => {
  /* ---------------------------------------------------------------
   * 1. Solta as amarras do enum
   * --------------------------------------------------------------- */
  pgm.dropConstraint("portfolio_role_ref", "portfolio_role_ref_portfolio_role_name_fkey");
  pgm.dropConstraint("portfolio_roles", "portfolio_roles_pkey");

  // 2. As duas colunas viram texto (o `USING` preserva os valores).
  pgm.alterColumn("portfolio_roles", "name", { type: "varchar(80)", using: "name::text" });
  pgm.alterColumn("portfolio_role_ref", "portfolio_role_name", { type: "varchar(80)", using: "portfolio_role_name::text" });

  // 3. Chave e FK de volta, agora com cascata no rename e recusa na exclusão.
  pgm.addConstraint("portfolio_roles", "portfolio_roles_pkey", { primaryKey: ["name"] });
  pgm.addConstraint("portfolio_role_ref", "portfolio_role_ref_portfolio_role_name_fkey", {
    foreignKeys: {
      columns: "portfolio_role_name",
      references: "portfolio_roles(name)",
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
  });

  /* ---------------------------------------------------------------
   * 4. Catálogo editável (mesmas colunas de `services`, sem slug)
   * --------------------------------------------------------------- */
  pgm.addColumns("portfolio_roles", {
    description: { type: "varchar(255)" },
    group_key: { type: "varchar(30)" },
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

  for (const [name, groupKey] of Object.entries(GROUP_OF)) {
    pgm.sql(`UPDATE portfolio_roles SET group_key = ${quote(groupKey)} WHERE name = ${quote(name)}`);
  }

  // Profissão criada fora da lista (não deve existir, mas o deploy não pode
  // quebrar por causa de uma linha antiga) cai em "outros", que a tela agrupa.
  pgm.sql(`UPDATE portfolio_roles SET group_key = 'outros' WHERE group_key IS NULL`);

  pgm.alterColumn("portfolio_roles", "group_key", { notNull: true });

  pgm.createIndex("portfolio_roles", "group_key");
  pgm.createIndex("portfolio_roles", "is_active");

  /* ---------------------------------------------------------------
   * 5. O tipo deixa de existir
   * --------------------------------------------------------------- */
  pgm.dropType("developer_role");

  /* ---------------------------------------------------------------
   * 6. Fila de sugestões (espelho de `service_suggestions`)
   * --------------------------------------------------------------- */
  pgm.createTable("profession_suggestions", {
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
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.addConstraint("profession_suggestions", "profession_suggestions_status_check", {
    check: "status IN ('pending', 'approved', 'rejected')",
  });

  pgm.createIndex("profession_suggestions", "status");
};

exports.down = (pgm) => {
  pgm.dropTable("profession_suggestions");

  pgm.dropConstraint("portfolio_role_ref", "portfolio_role_ref_portfolio_role_name_fkey");
  pgm.dropConstraint("portfolio_roles", "portfolio_roles_pkey");

  // Recria o enum com o que existe hoje. Se alguma profissão criada em runtime
  // não estiver na lista original, o cast abaixo falha — comportamento
  // intencional (ver o cabeçalho).
  pgm.sql(`
    DO $$
    DECLARE values text;
    BEGIN
      SELECT string_agg(quote_literal(name), ', ' ORDER BY name) INTO values FROM portfolio_roles;
      EXECUTE 'CREATE TYPE developer_role AS ENUM (' || values || ')';
    END $$;
  `);

  pgm.alterColumn("portfolio_roles", "name", { type: "developer_role", using: "name::developer_role" });
  pgm.alterColumn("portfolio_role_ref", "portfolio_role_name", {
    type: "developer_role",
    using: "portfolio_role_name::developer_role",
  });

  pgm.addConstraint("portfolio_roles", "portfolio_roles_pkey", { primaryKey: ["name"] });
  pgm.addConstraint("portfolio_role_ref", "portfolio_role_ref_portfolio_role_name_fkey", {
    foreignKeys: { columns: "portfolio_role_name", references: "portfolio_roles(name)" },
  });

  pgm.dropIndex("portfolio_roles", "group_key");
  pgm.dropIndex("portfolio_roles", "is_active");
  pgm.dropColumns("portfolio_roles", ["description", "group_key", "display_order", "is_active", "created_at", "updated_at"]);
};

/** Escapa aspas simples para os literais do seed (valores fixos, sem entrada). */
function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
