/**
 * Vínculo entre evento de agenda e estúdio/produto.
 *
 * O evento já existia com os tipos `studio` e `game_launch`, mas **sem dono**:
 * não havia como dizer a que estúdio ele pertence nem a que obra se refere.
 * Sem isso, "lançamento do jogo X" era um evento solto no calendário, e o
 * estúdio não tinha onde gerenciar a própria agenda.
 *
 * ## Por que colunas com FK, e não `(product_type, product_id)`
 *
 * O projeto usa o par polimórfico em `reports`, `moderation_actions` e
 * `conversations`, mas ali a limpeza é explícita em cada `delete*`. Aqui o alvo
 * é sempre um produto do próprio estúdio e precisa sumir junto: com quatro FKs
 * `ON DELETE CASCADE` o banco resolve, e nenhum dos quatro models de produto
 * ganha código de limpeza que alguém esqueceria de replicar no quinto.
 *
 * O `CHECK` fixa no banco o que a API já valida: no máximo **um** produto por
 * evento. Um lançamento é de uma obra; permitir dois faria a página do evento
 * escolher um deles em silêncio.
 *
 * `ON DELETE CASCADE` também no produto: excluir o jogo apaga os eventos de
 * lançamento dele. Evento órfão de obra excluída não teria para onde linkar, e
 * `SET NULL` deixaria na agenda um "lançamento" sem lançamento.
 *
 * ## As colunas `studio_id` e `game_id` legadas
 *
 * Nasceram em `1778803200000_events-calendar` como `int`, sem FK e sem uso —
 * `organizations.id` e `games.id` são `uuid`, então não havia como preenchê-las.
 * São removidas aqui antes de as versões corretas entrarem com o mesmo nome, em
 * vez de deixar duas colunas com o mesmo propósito (`game_id` int e uuid) para
 * alguém confundir depois.
 */

const PRODUCT_COLUMNS = [
  ["game_id", "games"],
  ["boardgame_id", "boardgames"],
  ["book_id", "books"],
  ["asset_id", "assets"],
];

exports.up = (pgm) => {
  // Legado sem uso (ver o cabeçalho).
  pgm.dropColumns("events", ["studio_id", "game_id"]);

  pgm.addColumn("events", {
    organization_id: {
      type: "uuid",
      references: "organizations(id)",
      onDelete: "CASCADE",
    },
  });

  for (const [column, table] of PRODUCT_COLUMNS) {
    pgm.addColumn("events", {
      [column]: {
        type: "uuid",
        references: `${table}(id)`,
        onDelete: "CASCADE",
      },
    });
  }

  // No máximo um produto por evento (ver o cabeçalho).
  const atMostOne = PRODUCT_COLUMNS.map(([column]) => `(${column} IS NOT NULL)::int`).join(" + ");
  pgm.addConstraint("events", "events_single_product_check", {
    check: `${atMostOne} <= 1`,
  });

  pgm.createIndex("events", "organization_id");
};

exports.down = (pgm) => {
  pgm.dropIndex("events", "organization_id");
  pgm.dropConstraint("events", "events_single_product_check");
  pgm.dropColumns("events", ["organization_id", ...PRODUCT_COLUMNS.map(([column]) => column)]);

  // As colunas legadas voltam como `int`, que é como estavam.
  pgm.addColumns("events", {
    studio_id: { type: "int" },
    game_id: { type: "int" },
  });
};
