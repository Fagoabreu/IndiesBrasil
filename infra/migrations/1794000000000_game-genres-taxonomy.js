/**
 * Gêneros viram catálogo hierárquico (gênero › subgênero) e tags passam a ser
 * usadas em jogos.
 *
 * ## O que a migration preserva
 *
 * Nada é apagado.
 *
 *  - Token que casa com um nó (ou com um alias) → vínculo em `game_genre_links`.
 *    "Shoot 'Em Up" → Ação › Shoot 'em up (Shmup).
 *  - Token **fora** da taxonomia ("2D Topdown", "Emocional", "Multiplayer") →
 *    **tag** em `tags` + vínculo em `game_tags`. É o uso que faltava para
 *    `game_tags`, que existe desde `1779840000000` e nunca recebeu INSERT.
 *    Perspectiva, modo e tom não são gênero — são vocabulário livre.
 *  - "Indefinido" não vira nada: é o valor histórico de "não informado".
 *  - `games.genre` **continua no banco** com o texto original. A leitura passa a
 *    derivá-lo dos vínculos; a coluna fica como último recurso para jogo que a
 *    migration não conseguiu interpretar.
 *
 * Criar um pai "Outros" resolveria a migração e criaria uma caixa-preta
 * permanente — ninguém saberia quem deveria reclassificar.
 *
 * ## Estrutura
 *
 * `game_genres.parent_name` é auto-referência: `NULL` = gênero, preenchido =
 * subgênero. `ON UPDATE CASCADE` faz renomear "Ação" alcançar filhos e jogos;
 * `ON DELETE RESTRICT` recusa excluir nó em uso (desative em vez disso).
 *
 * Nenhum nome de nó contém `/`, `,`, `|`, `;` ou `\`: são os separadores que
 * `splitGenreNames` usa, e um nome com `/` se partiria em dois ao reprocessar.
 * Por isso "Beat 'em up" e "Hack and Slash" são nós separados — e por isso o
 * grupo "Casual, Party e Tabuleiro" se chama **"Casual e Party"** aqui: com a
 * vírgula, o próprio nome voltaria partido em dois ao passar pelo campo legado
 * `games.genre`. "Jogos de Tabuleiro e Cassino" continua como subgênero dele,
 * então nada ficou inalcançável pelo filtro.
 *
 * ## Por que a conversão é SQL puro
 *
 * `pgm.createTable` e companhia **não executam na hora**: entram numa fila que o
 * runner só roda depois que `exports.up` retorna. Um `pgm.db.query` no meio do
 * `up` roda imediatamente, antes das tabelas existirem — foi exatamente o
 * `relation "game_genres" does not exist` da primeira versão. Por isso a
 * conversão do texto livre é uma sequência de `pgm.sql` (que preserva a ordem da
 * fila) e não um laço em JS lendo `games`.
 *
 * Consequência: a normalização (`genreKey`) precisa existir em SQL. `translate`
 * cobre o conjunto de acentos do português — e a mesma transformação é usada nos
 * dois lados da comparação, então basta ser consistente, não completa.
 */

const TAXONOMY = {
  Ação: ["Shooter", "Plataforma", "Luta", "Beat 'em up", "Hack and Slash", "Shoot 'em up (Shmup)", "Stealth", "Battle Royale", "Extraction Shooter"],
  "Ação e Aventura": ["Mundo Aberto", "Metroidvania", "Survival Horror", "Ação-Aventura Furtiva"],
  "Aventura e Narrativa": ["Point-and-Click", "Visual Novel", "Filme Interativo", "Walking Simulator", "Ficção Interativa"],
  RPG: ["Action RPG", "JRPG", "CRPG", "RPG Tático", "MMORPG", "Soulslike", "Roguelike", "Roguelite", "Dungeon Crawler", "Monster Tamer"],
  Estratégia: ["RTS", "TBS", "4X", "Grand Strategy", "MOBA", "Tower Defense", "Auto Battler", "RTT"],
  Simulação: [
    "Simulação de Vida",
    "Simulação de Fazenda",
    "Cozy Game",
    "Construção e Gestão",
    "Simulação de Veículos e Voo",
    "God Game",
    "Simulação de Emprego",
    "Simulação de Física",
  ],
  "Esportes e Corrida": ["Esportes Tradicionais", "Gestão Esportiva", "Corrida Arcade", "Sim Racing", "Esportes Radicais"],
  "Sandbox e Sobrevivência": ["Sandbox Puro", "Sobrevivência", "Crafting e Automação"],
  Puzzle: ["Puzzle de Física", "Match-3", "Escape Room", "Sokoban", "Lógica Espacial", "Objetos Escondidos"],
  "Ritmo e Música": ["Simulador de Instrumentos", "Dança e Movimento", "Rhythm Action"],
  "Casual e Party": ["Party Games", "Dedução Social", "Card Game (TCG e CCG)", "Jogos de Tabuleiro e Cassino", "Idle e Clicker"],
};

/**
 * Grafias reais que já estão no banco e o nó canônico correspondente.
 * A chave é `genreKey` (minúsculo, sem acento).
 *
 * Sem este mapa, "Shoot 'Em Up" e "Shoot 'em up (Shmup)" seriam dois nós e o
 * filtro continuaria partido — o problema que a migration existe para resolver.
 * Valor `null` significa "não é gênero": vira tag.
 */
const ALIASES = {
  "shoot em up": "Shoot 'em up (Shmup)",
  "shoot 'em up": "Shoot 'em up (Shmup)",
  shmup: "Shoot 'em up (Shmup)",
  "fighting game": "Luta",
  fighter: "Luta",
  "beat them up": "Beat 'em up",
  "beat em up": "Beat 'em up",
  "beat 'em up": "Beat 'em up",
  "hack and slash": "Hack and Slash",
  "point'n'click investigativo": "Point-and-Click",
  "point n click investigativo": "Point-and-Click",
  "point and click": "Point-and-Click",
  "plataforma 2d": "Plataforma",
  platformer: "Plataforma",
  party: "Party Games",
  // "Casual" sozinho é o nome do grupo, não de um subgênero — mapear para o pai
  // preserva a classificação em vez de rebaixá-la a tag.
  casual: "Casual e Party",
  cartas: "Card Game (TCG e CCG)",
  colecionavel: "Card Game (TCG e CCG)",
  esportes: "Esportes Tradicionais",
  narrativo: "Aventura e Narrativa",
  aventura: "Aventura e Narrativa",
  strategy: "Estratégia",
  simulation: "Simulação",
  "role-playing game": "RPG",
  "tower defense": "Tower Defense",
  // Não são gênero — perspectiva, tom e modo. Viram tag.
  "2d topdown": null,
  topdown: null,
  "top-down": null,
  emocional: null,
  multiplayer: null,
  "multi-player": null,
  coop: null,
  "co-op": null,
};

/** Cópia de `lib/gameGenres.js`: migration não importa ESM. */
function genreKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

/**
 * `translate` do Postgres: troca cada caractere acentuado pelo equivalente sem
 * acento. As duas strings precisam ter o mesmo comprimento.
 */
const ACCENTS_FROM = "áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ";
const ACCENTS_TO = "aaaaaaeeeeiiiiooooouuuucnAAAAAAEEEEIIIIOOOOOUUUUCN";

/** Equivalente SQL de `genreKey` aplicado a uma expressão. */
function sqlKey(expr) {
  return `btrim(regexp_replace(lower(translate(${expr}, ${quote(ACCENTS_FROM)}, ${quote(ACCENTS_TO)})), '\\s+', ' ', 'g'))`;
}

/** Equivalente SQL de `normalizeTagName` (cópia de `lib/gameTags.js`). */
function sqlTagName(expr) {
  return `regexp_replace(btrim(lower(regexp_replace(${expr}, '^#+', ''))), '\\s+', ' ', 'g')`;
}

exports.up = (pgm) => {
  /* ---------------- 1. Catálogo de gêneros ---------------- */
  pgm.createTable("game_genres", {
    name: { type: "varchar(60)", primaryKey: true, notNull: true },
    parent_name: { type: "varchar(60)" },
    description: { type: "varchar(255)" },
    display_order: { type: "integer", notNull: true, default: 0 },
    is_active: { type: "boolean", notNull: true, default: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  // Auto-referência: `NULL` = gênero, preenchido = subgênero. Cascata no rename
  // (renomear "Ação" move os filhos) e recusa na exclusão (nó em uso é
  // desativado, nunca apagado).
  pgm.addConstraint("game_genres", "game_genres_parent_name_fkey", {
    foreignKeys: { columns: "parent_name", references: "game_genres(name)", onDelete: "RESTRICT", onUpdate: "CASCADE" },
  });
  pgm.createIndex("game_genres", "parent_name");
  pgm.createIndex("game_genres", "is_active");

  // Pais primeiro: a FK de `parent_name` é checada linha a linha, então um único
  // INSERT com pais e filhos misturados pode falhar por ordem.
  const parents = Object.keys(TAXONOMY);
  pgm.sql(
    `INSERT INTO game_genres (name, display_order) VALUES\n` + parents.map((name, i) => `  (${quote(name)}, ${(i + 1) * 10})`).join(",\n") + `;`,
  );

  let order = parents.length * 10;
  const childRows = [];
  const nodes = parents.map((name) => ({ name, parent_name: null }));

  for (const [parent, children] of Object.entries(TAXONOMY)) {
    for (const child of children) {
      order += 10;
      childRows.push(`  (${quote(child)}, ${quote(parent)}, ${order})`);
      nodes.push({ name: child, parent_name: parent });
    }
  }

  pgm.sql(`INSERT INTO game_genres (name, parent_name, display_order) VALUES\n${childRows.join(",\n")};`);

  /* ---------------- 2. Vínculos de gênero ---------------- */
  pgm.createTable("game_genre_links", {
    game_id: { type: "uuid", notNull: true, references: "games", onDelete: "CASCADE" },
    genre_name: { type: "varchar(60)", notNull: true },
  });

  pgm.addConstraint("game_genre_links", "game_genre_links_pkey", "PRIMARY KEY (game_id, genre_name)");
  pgm.addConstraint("game_genre_links", "game_genre_links_genre_name_fkey", {
    foreignKeys: { columns: "genre_name", references: "game_genres(name)", onDelete: "RESTRICT", onUpdate: "CASCADE" },
  });
  pgm.createIndex("game_genre_links", "genre_name");

  /* ---------------- 3. Fila de sugestões de gênero ---------------- */
  pgm.createTable("game_genre_suggestions", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    suggested_by: { type: "uuid", notNull: true, references: "users(id)", onDelete: "CASCADE" },
    // A sugestão nasce de um jogo concreto: aprovada, o gênero é vinculado a ele.
    game_id: { type: "uuid", notNull: true, references: "games(id)", onDelete: "CASCADE" },
    name: { type: "varchar(60)", notNull: true },
    parent_name: { type: "varchar(60)", references: "game_genres(name)", onDelete: "SET NULL" },
    justification: { type: "varchar(500)" },
    status: { type: "varchar(12)", notNull: true, default: "pending" },
    reviewed_by: { type: "uuid", references: "users(id)", onDelete: "SET NULL" },
    reviewed_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.addConstraint("game_genre_suggestions", "game_genre_suggestions_status_check", {
    check: "status IN ('pending', 'approved', 'rejected')",
  });
  pgm.createIndex("game_genre_suggestions", "status");

  /* ---------------- 4. Tabelas de trabalho da conversão ---------------- */
  // Temporárias porque não são modelo: existem só para o texto livre ser
  // convertido em três statements simples. A primeira guarda o mapa (nome real →
  // nó); a segunda, cada token já resolvido. Repetir o mapa em cada INSERT
  // convidaria as três consultas a divergirem.
  pgm.sql(`CREATE TEMP TABLE gg_map (key text PRIMARY KEY, node varchar(60));`);

  const mapRows = [];
  const seenKeys = new Set();
  for (const node of nodes) {
    const key = genreKey(node.name);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    mapRows.push(`  (${quote(key)}, ${quote(node.name)})`);
  }
  for (const [key, target] of Object.entries(ALIASES)) {
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    mapRows.push(`  (${quote(key)}, ${target === null ? "NULL" : quote(target)})`);
  }
  pgm.sql(`INSERT INTO gg_map (key, node) VALUES\n${mapRows.join(",\n")};`);

  // Separadores iguais aos de `splitGenreNames`. A classe precisa da barra
  // invertida escapada: no regex POSIX do Postgres, `\\` é a barra literal.
  pgm.sql(`
    CREATE TEMP TABLE gg_resolved AS
    SELECT
      parts.game_id,
      parts.raw,
      ${sqlTagName("parts.raw")} AS tag_name,
      m.node
    FROM (
      SELECT
        g.id AS game_id,
        btrim(p.raw) AS raw,
        ${sqlKey("btrim(p.raw)")} AS key
      FROM games g
      CROSS JOIN LATERAL regexp_split_to_table(coalesce(g.genre, ''), '[,/|;\\\\]') AS p(raw)
    ) AS parts
    LEFT JOIN gg_map m ON m.key = parts.key
    -- "Indefinido" é o valor histórico de "não informado": não vira gênero nem
    -- tag, senão todo jogo antigo ganharia a tag "indefinido".
    WHERE parts.key <> ''
      AND parts.key <> 'indefinido';
  `);

  // Nó encontrado → vínculo de gênero. `DISTINCT` porque a mesma palavra pode
  // repetir dentro da string livre ("Puzzle, Puzzle").
  pgm.sql(`
    INSERT INTO game_genre_links (game_id, genre_name)
    SELECT DISTINCT game_id, node
    FROM gg_resolved
    WHERE node IS NOT NULL
    ON CONFLICT DO NOTHING;
  `);

  // Fora da taxonomia → tag. `tags.name` é `varchar(50)` e único, então o filtro
  // de comprimento não é cosmético: nome maior estouraria o INSERT.
  pgm.sql(`
    INSERT INTO tags (name)
    SELECT DISTINCT tag_name
    FROM gg_resolved
    WHERE node IS NULL
      AND tag_name IS NOT NULL
      AND char_length(tag_name) BETWEEN 3 AND 50
    ON CONFLICT (name) DO NOTHING;
  `);

  pgm.sql(`
    INSERT INTO game_tags (game_id, tag_id)
    SELECT DISTINCT r.game_id, t.id
    FROM gg_resolved r
    JOIN tags t ON t.name = r.tag_name
    WHERE r.node IS NULL
      AND r.tag_name IS NOT NULL
      AND char_length(r.tag_name) BETWEEN 3 AND 50
    ON CONFLICT DO NOTHING;
  `);

  pgm.sql(`DROP TABLE gg_resolved;`);
  pgm.sql(`DROP TABLE gg_map;`);

  console.log(
    `[game-genres] ${parents.length} gêneros e ${childRows.length} subgêneros semeados; ` + `texto livre convertido em vínculos de gênero e tags.`,
  );
};

exports.down = (pgm) => {
  // `games.genre` nunca deixou de existir — o `down` não precisa reescrevê-lo.
  // As tags criadas ficam: `tags` é compartilhada com posts e apagar por
  // suposição levaria tag de post junto.
  pgm.dropTable("game_genre_suggestions");
  pgm.dropTable("game_genre_links");
  pgm.dropTable("game_genres");
};
