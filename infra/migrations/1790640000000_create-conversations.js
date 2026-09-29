/**
 * Migration: Mensagens diretas (conversations, messages, conversation_reads)
 *
 * ## Participante é `user` OU `studio`
 *
 * Um lado da conversa pode ser um usuário ou um estúdio — e no caso do estúdio
 * são vários humanos operando a mesma caixa de entrada. Referência polimórfica
 * `(tipo, id)` resolve isso sem tabela de mapeamento porque `users.id` e
 * `organizations.id` são ambos `uuid`.
 *
 * ## O par é canônico, e é o banco que garante
 *
 * `CHECK (ROW(a) < ROW(b))` + `UNIQUE` fazem `(user A, studio S)` e
 * `(studio S, user A)` serem **a mesma linha**. Sem isso, A→B e B→A criariam
 * duas conversas, e cada um veria metade da história. O `POST` da API faz
 * `SELECT ... FOR UPDATE` e depois `INSERT`, então duas requisições simultâneas
 * não criam duas threads — o `UNIQUE` é a rede de segurança.
 *
 * ## Identidade × autoria
 *
 * `messages.author_*` é a identidade EXIBIDA (o estúdio, quando um membro
 * responde em nome dele); `sent_by_user_id` é o humano que digitou, sempre
 * gravado. É o que permite a moderação saber quem escreveu um abuso numa
 * conversa de estúdio — sem esse campo, a denúncia de uma mensagem de estúdio
 * não teria autor.
 *
 * ## Leitura é da PARTE, não do membro
 *
 * `conversation_reads` tem uma linha por parte (o estúdio conta como uma).
 * Qualquer membro que abrir marca como lido para o estúdio — é uma caixa de
 * entrada compartilhada, não uma correspondência por pessoa. `muted` fica aqui
 * porque é preferência da parte, não de cada membro.
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE conversations (
      id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      party_a_type    varchar(10) NOT NULL,
      party_a_id      uuid        NOT NULL,
      party_b_type    varchar(10) NOT NULL,
      party_b_id      uuid        NOT NULL,
      -- Desnormalizado de propósito: a listagem ordena por "mais recente" e sem
      -- esta coluna faria um max(created_at) por conversa a cada abertura.
      last_message_at timestamptz,
      created_at      timestamptz NOT NULL DEFAULT now(),

      CONSTRAINT conversations_party_a_type CHECK (party_a_type IN ('user', 'studio')),
      CONSTRAINT conversations_party_b_type CHECK (party_b_type IN ('user', 'studio')),
      CONSTRAINT conversations_party_not_self CHECK (
        party_a_type <> party_b_type OR party_a_id <> party_b_id
      ),
      -- Ordem canônica: é o que impede duas linhas para o mesmo par.
      CONSTRAINT conversations_pair_ordered CHECK (
        ROW(party_a_type, party_a_id) < ROW(party_b_type, party_b_id)
      )
    );

    CREATE UNIQUE INDEX conversations_pair_unique
      ON conversations (party_a_type, party_a_id, party_b_type, party_b_id);

    CREATE INDEX conversations_recent
      ON conversations (last_message_at DESC NULLS LAST);

    -- Busca "as conversas em que eu participo" nos dois lados. São dois índices
    -- porque o par canônico pode colocar a mesma parte em A ou em B.
    CREATE INDEX conversations_party_a ON conversations (party_a_type, party_a_id);
    CREATE INDEX conversations_party_b ON conversations (party_b_type, party_b_id);

    CREATE TABLE messages (
      id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      author_type     varchar(10) NOT NULL,
      author_id       uuid        NOT NULL,
      -- SEMPRE o humano. Numa mensagem de estúdio é o membro que respondeu.
      sent_by_user_id uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body            text        NOT NULL,
      created_at      timestamptz NOT NULL DEFAULT now(),

      CONSTRAINT messages_author_type CHECK (author_type IN ('user', 'studio')),
      CONSTRAINT messages_body_not_blank CHECK (length(btrim(body)) > 0)
    );

    CREATE INDEX messages_thread ON messages (conversation_id, created_at DESC);

    CREATE TABLE conversation_reads (
      conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      reader_type     varchar(10) NOT NULL,
      reader_id       uuid        NOT NULL,
      last_read_at    timestamptz,
      muted           boolean     NOT NULL DEFAULT false,

      PRIMARY KEY (conversation_id, reader_type, reader_id),
      CONSTRAINT conversation_reads_type CHECK (reader_type IN ('user', 'studio'))
    );

    -- "Listar as conversas silenciadas" para poder desmutar depois: sem este
    -- índice a consulta varreria todas as leituras da parte.
    CREATE INDEX conversation_reads_muted
      ON conversation_reads (reader_type, reader_id)
      WHERE muted;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS conversation_reads;
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS conversations;
  `);
};
