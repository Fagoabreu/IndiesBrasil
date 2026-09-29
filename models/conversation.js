import database from "infra/database";
import { ForbiddenError, NotFoundError, ValidationError } from "infra/errors";
import organization from "./organization";
import moderation, { targetExists } from "./moderation";
import notification from "./notification";

/* =========================================================
 * Constantes
 * ========================================================= */

// Um lado da conversa é um membro (`user`) ou um estúdio (`studio`).
export const PARTY_TYPES = ["user", "studio"];

// Corpo é TEXTO PURO. O cliente renderiza como texto (React escapa), então não
// passa por sanitizador de HTML — sanitizar aqui mutilaria texto legítimo como
// "a < b". O limite existe para não gravar um romance por mensagem.
export const MAX_BODY_LENGTH = 4000;

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

/* =========================================================
 * Helpers internos
 * ========================================================= */

function assertPartyType(type) {
  if (!PARTY_TYPES.includes(type)) {
    throw new ValidationError({
      message: "Tipo de participante inválido.",
      action: `Informe um tipo válido: ${PARTY_TYPES.join(", ")}.`,
    });
  }
}

/** `uuid` no PostgreSQL é comparado byte a byte e sai em minúsculas do driver —
 *  normalizar aqui é o que faz a comparação em JS concordar com o `CHECK` do banco. */
function normalizeId(id) {
  return String(id ?? "").toLowerCase();
}

/**
 * Ordena o par na ordem canônica exigida pelo banco
 * (`CHECK ROW(party_a_type, party_a_id) < ROW(party_b_type, party_b_id)`).
 *
 * Sem isto, `A → B` e `B → A` seriam duas linhas diferentes e cada lado veria
 * metade da história. Hex em minúsculas compara na mesma ordem que os bytes do
 * `uuid` (os hífens caem sempre nas mesmas posições), então a ordenação em JS
 * coincide com a do PostgreSQL.
 */
function canonicalPair(partyA, partyB) {
  const a = { type: partyA.type, id: normalizeId(partyA.id) };
  const b = { type: partyB.type, id: normalizeId(partyB.id) };
  const aComesFirst = a.type < b.type || (a.type === b.type && a.id < b.id);
  return aComesFirst ? [a, b] : [b, a];
}

function matchesSide(conversation, side, party) {
  return conversation[`party_${side}_type`] === party.type && normalizeId(conversation[`party_${side}_id`]) === normalizeId(party.id);
}

function partyMatches(conversation, party) {
  return matchesSide(conversation, "a", party) || matchesSide(conversation, "b", party);
}

/** O outro lado da conversa em relação a `party`. */
function peerOf(conversation, party) {
  if (matchesSide(conversation, "a", party)) {
    return { type: conversation.party_b_type, id: conversation.party_b_id };
  }
  return { type: conversation.party_a_type, id: conversation.party_a_id };
}

function normalizeBody(body) {
  if (typeof body !== "string") {
    throw new ValidationError({ message: "A mensagem é obrigatória." });
  }

  // Normaliza quebra de linha para o texto não variar entre SOs no histórico.
  const value = body.replace(/\r\n?/g, "\n").trim();

  if (!value) {
    throw new ValidationError({ message: "A mensagem não pode ficar em branco." });
  }

  if (value.length > MAX_BODY_LENGTH) {
    throw new ValidationError({
      message: `A mensagem deve ter no máximo ${MAX_BODY_LENGTH} caracteres.`,
    });
  }

  return value;
}

function clampLimit(limit) {
  const parsed = Number.parseInt(limit, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

/* =========================================================
 * Serialização
 * ========================================================= */

function serializePeer(row) {
  if (row.peer_type === "studio") {
    return {
      type: "studio",
      id: row.peer_id,
      name: row.peer_studio_name,
      slug: row.peer_studio_slug,
      avatar_url: row.peer_studio_logo_url || null,
    };
  }

  return {
    type: "user",
    id: row.peer_id,
    name: row.peer_display_name || row.peer_username,
    username: row.peer_username,
    avatar_url: row.peer_avatar_url || null,
  };
}

function serializeConversation(row, party) {
  return {
    id: row.id,
    party: { type: party.type, id: normalizeId(party.id) },
    peer: serializePeer(row),
    last_message_at: row.last_message_at,
    last_message:
      row.last_message_body == null
        ? null
        : {
            body: row.last_message_body,
            author_type: row.last_message_author_type,
            created_at: row.last_message_created_at,
          },
    unread_count: Number(row.unread_count ?? 0),
    muted: row.muted === true,
    created_at: row.created_at,
  };
}

function serializeMessage(row) {
  const author =
    row.author_type === "studio"
      ? {
          type: "studio",
          id: row.author_id,
          name: row.author_studio_name,
          slug: row.author_studio_slug,
          avatar_url: row.author_studio_logo_url || null,
        }
      : {
          type: "user",
          id: row.author_id,
          name: row.author_display_name || row.author_username,
          username: row.author_username,
          avatar_url: row.author_avatar_url || null,
        };

  return {
    id: row.id,
    conversation_id: row.conversation_id,
    author,
    // Quem digitou. Numa mensagem de estúdio é o membro que respondeu — é o que
    // permite à moderação atribuir um abuso a uma pessoa.
    sent_by: { id: row.sent_by_user_id, username: row.sent_by_username || null },
    body: row.body,
    created_at: row.created_at,
  };
}

/* =========================================================
 * Acesso
 * ========================================================= */

/**
 * Resolve e valida a identidade com que o usuário está agindo.
 *
 * `party.id` é a identidade EXIBIDA (o usuário ou o estúdio); `party.userId` é
 * sempre o humano — é ele que vai em `messages.sent_by_user_id`.
 *
 * Sem `type`/`id` informados a identidade é a caixa pessoal do próprio usuário.
 * O padrão mora aqui, e não em cada rota, porque é parte da regra: quatro
 * rotas repetindo `searchParams.get("party_type") || "user"` é como as
 * divergências começam.
 */
async function resolveParty({ type, id, userId }) {
  const resolvedType = type || "user";
  assertPartyType(resolvedType);

  if (!userId) {
    throw new ForbiddenError({ message: "É necessário estar autenticado para acessar mensagens." });
  }

  const resolvedId = id || userId;
  if (!resolvedId) {
    throw new ValidationError({ message: "O identificador do participante é obrigatório." });
  }

  if (resolvedType === "user") {
    // Um usuário só age em nome próprio. Sem esta trava a rota aceitaria o `id`
    // de outra pessoa e a caixa de entrada dela ficaria exposta.
    if (normalizeId(resolvedId) !== normalizeId(userId)) {
      throw new ForbiddenError({ message: "Você só pode acessar as suas próprias mensagens." });
    }
    return { type: "user", id: normalizeId(userId), userId: normalizeId(userId) };
  }

  // Estúdio é caixa de entrada compartilhada: qualquer membro ativo, admin ou
  // dono pode operar em nome dele. A checagem é feita a cada acesso (e não na
  // criação da conversa), então quem entra no estúdio depois passa a ver o
  // histórico anterior — e quem sai perde o acesso imediatamente.
  const studio = await organization.findById(resolvedId);
  const [isMember, isAdmin] = await Promise.all([organization.isMember(studio.id, userId), organization.isAdmin(studio.id, userId)]);

  if (!isMember && !isAdmin && studio.owner_id !== userId) {
    throw new ForbiddenError({ message: "Apenas membros do estúdio podem acessar as mensagens dele." });
  }

  return { type: "studio", id: studio.id, userId: normalizeId(userId), slug: studio.slug, name: studio.name };
}

async function findById(conversationId) {
  const results = await database.query({
    text: `SELECT * FROM conversations WHERE id = $1`,
    values: [conversationId],
  });

  const conversation = results.rows[0];
  if (!conversation) {
    throw new NotFoundError({ message: "Conversa não encontrada." });
  }

  return conversation;
}

/**
 * Ponto único de decisão de acesso à conversa.
 *
 * Responde 404 (e não 403) quando o usuário não é parte: confirmar que a
 * conversa existe revelaria que duas outras pessoas estão conversando.
 */
async function assertCanRead({ conversationId, party }) {
  const conversation = await findById(conversationId);

  if (!partyMatches(conversation, party)) {
    throw new NotFoundError({ message: "Conversa não encontrada." });
  }

  return conversation;
}

/* =========================================================
 * Criação
 * ========================================================= */

/**
 * Abre (ou recupera) a conversa do usuário com um membro ou estúdio.
 *
 * Não existe equivalente para o estúdio abrir conversa: **o estúdio só
 * responde**. Manter apenas esta função é o que impede a regra de ser violada
 * por descuido — não há API para iniciar uma thread com a identidade do estúdio.
 */
async function findOrCreateForUser({ userId, targetType, targetId }) {
  assertPartyType(targetType);

  const senderId = normalizeId(userId);
  const peerId = normalizeId(targetId);

  if (!senderId) {
    throw new ForbiddenError({ message: "É necessário estar autenticado para enviar mensagens." });
  }

  if (!peerId) {
    throw new ValidationError({ message: "Informe com quem você quer conversar." });
  }

  if (targetType === "user") {
    if (peerId === senderId) {
      throw new ValidationError({
        message: "Não é possível conversar consigo mesmo.",
        action: "Escolha outro membro ou um estúdio.",
      });
    }

    // `targetExists` é exportação nomeada do módulo de moderação (não faz parte
    // do objeto padrão) e é o que existe para não gravar uma conversa com um
    // alvo que não existe.
    const exists = await targetExists("user", peerId);
    if (!exists) {
      throw new NotFoundError({ message: "Membro não encontrado." });
    }
  } else {
    const studio = await organization.findById(peerId);
    const [isMember, isAdmin] = await Promise.all([organization.isMember(studio.id, senderId), organization.isAdmin(studio.id, senderId)]);

    // Conversar com o próprio estúdio criaria uma thread em que os dois lados
    // são a mesma pessoa — e o estúdio não inicia conversa de qualquer forma.
    if (isMember || isAdmin || studio.owner_id === senderId) {
      throw new ValidationError({
        message: "Você já faz parte deste estúdio.",
        action: "As mensagens da equipe ficam na página do estúdio.",
      });
    }
  }

  // Alvo bloqueado não recebe novas conversas — mesma regra que esconde o
  // conteúdo bloqueado do resto da plataforma.
  if (await moderation.isBlocked(targetType, peerId)) {
    throw new NotFoundError({ message: "Não foi possível iniciar a conversa." });
  }

  const [first, second] = canonicalPair({ type: "user", id: senderId }, { type: targetType, id: peerId });

  const inserted = await database.query({
    text: `
      INSERT INTO conversations (party_a_type, party_a_id, party_b_type, party_b_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (party_a_type, party_a_id, party_b_type, party_b_id) DO NOTHING
      RETURNING *
    `,
    values: [first.type, first.id, second.type, second.id],
  });

  if (inserted.rows[0]) {
    return inserted.rows[0];
  }

  // Conflito: a conversa já existia — ou outra requisição acabou de criá-la, e
  // o índice único a serializou. Aqui é leitura, não nova criação.
  const existing = await database.query({
    text: `
      SELECT *
      FROM conversations
      WHERE party_a_type = $1 AND party_a_id = $2
        AND party_b_type = $3 AND party_b_id = $4
    `,
    values: [first.type, first.id, second.type, second.id],
  });

  return existing.rows[0];
}

/* =========================================================
 * Listagem
 * ========================================================= */

const CONVERSATION_LIST_SQL = `
  WITH participating AS (
    SELECT
      c.*,
      CASE WHEN c.party_a_type = $1 AND c.party_a_id = $2 THEN c.party_b_type ELSE c.party_a_type END AS peer_type,
      CASE WHEN c.party_a_type = $1 AND c.party_a_id = $2 THEN c.party_b_id   ELSE c.party_a_id   END AS peer_id
    FROM conversations c
    WHERE (c.party_a_type = $1 AND c.party_a_id = $2)
       OR (c.party_b_type = $1 AND c.party_b_id = $2)
  ),
  last_message AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id, m.body, m.author_type, m.created_at
    FROM messages m
    WHERE m.conversation_id IN (SELECT id FROM participating)
    ORDER BY m.conversation_id, m.created_at DESC
  )
  SELECT
    p.id,
    p.peer_type,
    p.peer_id,
    p.last_message_at,
    p.created_at,
    reads.last_read_at,
    COALESCE(reads.muted, false) AS muted,
    peer_user.username       AS peer_username,
    peer_user.resumo         AS peer_display_name,
    peer_user_img.secure_url AS peer_avatar_url,
    peer_org.name            AS peer_studio_name,
    peer_org.slug            AS peer_studio_slug,
    peer_org_img.secure_url  AS peer_studio_logo_url,
    last_message.body        AS last_message_body,
    last_message.author_type AS last_message_author_type,
    last_message.created_at  AS last_message_created_at,
    (
      SELECT COUNT(*)
      FROM messages unread
      WHERE unread.conversation_id = p.id
        AND unread.created_at > COALESCE(reads.last_read_at, 'epoch'::timestamptz)
        AND NOT (unread.author_type = $1 AND unread.author_id = $2)
    )::int AS unread_count
  FROM participating p
  LEFT JOIN conversation_reads reads
    ON reads.conversation_id = p.id
   AND reads.reader_type = $1
   AND reads.reader_id = $2
  LEFT JOIN users peer_user
    ON p.peer_type = 'user' AND peer_user.id = p.peer_id
  LEFT JOIN uploaded_images peer_user_img
    ON peer_user_img.id = peer_user.avatar_image
  LEFT JOIN organizations peer_org
    ON p.peer_type = 'studio' AND peer_org.id = p.peer_id
  LEFT JOIN uploaded_images peer_org_img
    ON peer_org_img.id = peer_org.img
  LEFT JOIN last_message
    ON last_message.conversation_id = p.id
  WHERE ($3::boolean IS NULL OR COALESCE(reads.muted, false) = $3)
    AND ($4::uuid IS NULL OR p.id = $4)
  ORDER BY COALESCE(p.last_message_at, p.created_at) DESC
`;

async function queryConversations({ party, mutedOnly = null, conversationId = null }) {
  const results = await database.query({
    text: CONVERSATION_LIST_SQL,
    values: [party.type, normalizeId(party.id), mutedOnly, conversationId],
  });

  return results.rows.map((row) => serializeConversation(row, party));
}

async function listForParty({ party }) {
  return queryConversations({ party, mutedOnly: null });
}

/**
 * Uma conversa já serializada (mesmo formato da listagem).
 *
 * A tela da conversa precisa do mesmo dado de exibição do outro lado — e
 * reusar a consulta da listagem é o que impede os dois formatos de divergirem.
 */
async function findForParty({ conversationId, party }) {
  const [found] = await queryConversations({ party, conversationId });

  if (!found) {
    throw new NotFoundError({ message: "Conversa não encontrada." });
  }

  return found;
}

/**
 * Conversas silenciadas pela parte.
 *
 * Existe para que o silêncio seja reversível: sem esta listagem, mutar seria
 * uma ação sem volta pela interface.
 */
async function listMutedForParty({ party }) {
  return queryConversations({ party, mutedOnly: true });
}

/* =========================================================
 * Mensagens
 * ========================================================= */

const MESSAGE_DISPLAY_COLUMNS = `
    m.id,
    m.conversation_id,
    m.author_type,
    m.author_id,
    m.sent_by_user_id,
    m.body,
    m.created_at,
    sent_by.username           AS sent_by_username,
    author_user.username       AS author_username,
    author_user.resumo         AS author_display_name,
    author_user_img.secure_url AS author_avatar_url,
    author_org.name            AS author_studio_name,
    author_org.slug            AS author_studio_slug,
    author_org_img.secure_url  AS author_studio_logo_url
`;

const MESSAGE_DISPLAY_FROM = `
  FROM messages m
  LEFT JOIN users sent_by
    ON sent_by.id = m.sent_by_user_id
  LEFT JOIN users author_user
    ON m.author_type = 'user' AND author_user.id = m.author_id
  LEFT JOIN uploaded_images author_user_img
    ON author_user_img.id = author_user.avatar_image
  LEFT JOIN organizations author_org
    ON m.author_type = 'studio' AND author_org.id = m.author_id
  LEFT JOIN uploaded_images author_org_img
    ON author_org_img.id = author_org.img
`;

/**
 * Página de mensagens, do mais novo para o mais antigo.
 *
 * `before` é o `created_at` da mensagem mais antiga já carregada (cursor) — a
 * paginação é por tempo e não por `OFFSET`, senão uma mensagem nova chegando
 * entre duas páginas empurraria a lista e duplicaria/omitaria itens.
 */
async function queryMessages({ conversationId, before = null, limit }) {
  const pageSize = clampLimit(limit);

  const results = await database.query({
    text: `
      SELECT ${MESSAGE_DISPLAY_COLUMNS}
      ${MESSAGE_DISPLAY_FROM}
      WHERE m.conversation_id = $1
        AND ($2::timestamptz IS NULL OR m.created_at < $2)
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT $3
    `,
    values: [conversationId, before, pageSize + 1],
  });

  const hasMore = results.rows.length > pageSize;
  const rows = hasMore ? results.rows.slice(0, pageSize) : results.rows;

  // A tela desenha de cima para baixo, então devolvemos em ordem cronológica.
  return {
    messages: rows.reverse().map(serializeMessage),
    has_more: hasMore,
  };
}

/** Mensagem única já enriquecida para exibição (usada pela resposta do envio). */
async function findMessageForDisplay(messageId) {
  const results = await database.query({
    text: `
      SELECT ${MESSAGE_DISPLAY_COLUMNS}
      ${MESSAGE_DISPLAY_FROM}
      WHERE m.id = $1
    `,
    values: [messageId],
  });

  return results.rows[0] ? serializeMessage(results.rows[0]) : null;
}

async function listMessages({ conversationId, party, before = null, limit }) {
  await assertCanRead({ conversationId, party });
  return queryMessages({ conversationId, before, limit });
}

/**
 * Mesmo conteúdo, sem checagem de parte.
 *
 * Uso exclusivo da moderação: quem chama já foi autorizado por
 * `read:conversation:any`. O nome é explícito porque uma função de leitura sem
 * trava de acesso é exatamente o tipo de conveniência que vira vazamento depois.
 */
async function listMessagesForModeration({ conversationId, before = null, limit }) {
  return queryMessages({ conversationId, before, limit });
}

/**
 * A conversa com os dados de exibição dos dois lados. Serve às telas da
 * moderação, que precisam nomear os participantes (e não apenas os `id`).
 */
async function describeForModeration(conversationId) {
  const conversation = await findById(conversationId);

  const sides = [
    { type: conversation.party_a_type, id: conversation.party_a_id },
    { type: conversation.party_b_type, id: conversation.party_b_id },
  ];

  const participants = await Promise.all(
    sides.map(async (side) => {
      if (side.type === "studio") {
        const studio = await database.query({
          text: `
            SELECT o.id, o.name, o.slug, oi.secure_url AS avatar_url
            FROM organizations o
            LEFT JOIN uploaded_images oi ON oi.id = o.img
            WHERE o.id = $1
          `,
          values: [side.id],
        });
        const row = studio.rows[0];
        return {
          type: "studio",
          id: side.id,
          name: row?.name ?? null,
          slug: row?.slug ?? null,
          avatar_url: row?.avatar_url ?? null,
        };
      }

      const user = await database.query({
        text: `
          SELECT u.id, u.username, u.resumo, ui.secure_url AS avatar_url
          FROM users u
          LEFT JOIN uploaded_images ui ON ui.id = u.avatar_image
          WHERE u.id = $1
        `,
        values: [side.id],
      });
      const row = user.rows[0];
      return {
        type: "user",
        id: side.id,
        name: row?.resumo || row?.username || null,
        username: row?.username ?? null,
        avatar_url: row?.avatar_url ?? null,
      };
    }),
  );

  return {
    id: conversation.id,
    created_at: conversation.created_at,
    last_message_at: conversation.last_message_at,
    frozen: await moderation.isBlocked("conversation", conversation.id),
    participants,
  };
}

/* =========================================================
 * Escrita
 * ========================================================= */

/**
 * Grava a notificação do destinatário.
 *
 * Falha aqui **não** desfaz a mensagem: a notificação é efeito colateral e o
 * que importa (a mensagem gravada) já está no banco. Por isso o `try`.
 */
async function notifyRecipient({ conversation, party, body }) {
  const peer = peerOf(conversation, party);
  const preview = body.length > 120 ? `${body.slice(0, 117)}...` : body;

  try {
    if (peer.type === "user") {
      await notification.upsertUserNotification({
        user_id: peer.id,
        type: "new_message",
        source_user_id: party.userId,
        org_slug: party.slug ?? "",
      });
      return;
    }

    await notification.upsertConversationNotification({
      org_id: peer.id,
      source_user_id: party.userId,
      conversation_id: conversation.id,
      subject_title: preview,
    });
  } catch (error) {
    console.error("Falha ao notificar nova mensagem:", error);
  }
}

async function sendMessage({ conversationId, party, body }) {
  const value = normalizeBody(body);
  const conversation = await assertCanRead({ conversationId, party });

  // Conversa congelada pela moderação: os dois lados continuam lendo o que já
  // existe (a denúncia precisa do histórico), mas ninguém escreve mais.
  if (await moderation.isBlocked("conversation", conversationId)) {
    throw new ForbiddenError({
      message: "Esta conversa está congelada pela moderação.",
      action: "Não é possível enviar novas mensagens.",
    });
  }

  const sent = await database.transaction(async (client) => {
    // Trava a conversa para serializar `last_message_at`: sem o lock, duas
    // mensagens simultâneas poderiam gravar a data fora de ordem.
    await client.query({
      text: `SELECT id FROM conversations WHERE id = $1 FOR UPDATE`,
      values: [conversationId],
    });

    const inserted = await client.query({
      text: `
        INSERT INTO messages (conversation_id, author_type, author_id, sent_by_user_id, body)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      values: [conversationId, party.type, party.id, party.userId, value],
    });

    // Usa o `created_at` da própria mensagem: derivar de `now()` de novo aqui
    // poderia divergir do valor gravado dentro desta transação.
    await client.query({
      text: `UPDATE conversations SET last_message_at = $2 WHERE id = $1`,
      values: [conversationId, inserted.rows[0].created_at],
    });

    return inserted.rows[0];
  });

  await notifyRecipient({ conversation, party, body: value });

  return findMessageForDisplay(sent.id);
}

async function markRead({ conversationId, party }) {
  await assertCanRead({ conversationId, party });

  const results = await database.query({
    text: `
      INSERT INTO conversation_reads (conversation_id, reader_type, reader_id, last_read_at)
      VALUES ($1, $2, $3, now())
      ON CONFLICT (conversation_id, reader_type, reader_id)
      DO UPDATE SET last_read_at = EXCLUDED.last_read_at
      RETURNING *
    `,
    values: [conversationId, party.type, party.id],
  });

  return results.rows[0];
}

/**
 * Liga/desliga o silêncio da conversa para a parte.
 *
 * Silenciar não esconde a conversa: ela continua na listagem com o contador de
 * não lidas. Só deixa de gerar notificação.
 */
async function setMuted({ conversationId, party, muted }) {
  await assertCanRead({ conversationId, party });

  const results = await database.query({
    text: `
      INSERT INTO conversation_reads (conversation_id, reader_type, reader_id, muted)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (conversation_id, reader_type, reader_id)
      DO UPDATE SET muted = EXCLUDED.muted
      RETURNING *
    `,
    values: [conversationId, party.type, party.id, muted === true],
  });

  return results.rows[0];
}

/**
 * Contadores de não lidas da parte: conversas com novidade e total de mensagens.
 * Calculados no servidor porque o cliente não teria como contar sem baixar
 * todas as conversas.
 */
async function countUnreadForParty({ party }) {
  const results = await database.query({
    text: `
      SELECT
        COUNT(DISTINCT m.conversation_id)::int AS conversations,
        COUNT(m.id)::int                       AS messages
      FROM messages m
      JOIN conversations c
        ON c.id = m.conversation_id
      LEFT JOIN conversation_reads reads
        ON reads.conversation_id = c.id
       AND reads.reader_type = $1
       AND reads.reader_id = $2
      WHERE (
          (c.party_a_type = $1 AND c.party_a_id = $2)
          OR (c.party_b_type = $1 AND c.party_b_id = $2)
        )
        AND m.created_at > COALESCE(reads.last_read_at, 'epoch'::timestamptz)
        AND NOT (m.author_type = $1 AND m.author_id = $2)
    `,
    values: [party.type, normalizeId(party.id)],
  });

  return results.rows[0];
}

/**
 * O usuário participa desta conversa?
 *
 * Existe para a denúncia: só quem está na conversa pode denunciá-la, senão a
 * moderação receberia denúncias de `id` de conversas alheias — e quem denuncia
 * não teria visto nada. Não é a trava de leitura (essa é `assertCanRead`); é a
 * de *reportar*.
 */
async function isParticipantByUserId(conversationId, userId) {
  const results = await database.query({
    text: `
      SELECT 1
      FROM conversations
      WHERE id = $1
        AND (
          (party_a_type = 'user' AND party_a_id = $2)
          OR (party_b_type = 'user' AND party_b_id = $2)
        )
      LIMIT 1
    `,
    values: [conversationId, normalizeId(userId)],
  });

  return results.rowCount > 0;
}

const conversation = {
  PARTY_TYPES,
  MAX_BODY_LENGTH,
  resolveParty,
  assertCanRead,
  findById,
  findOrCreateForUser,
  listForParty,
  listMutedForParty,
  findForParty,
  listMessages,
  listMessagesForModeration,
  describeForModeration,
  sendMessage,
  markRead,
  setMuted,
  countUnreadForParty,
  isParticipantByUserId,
  serializeConversation,
};

export default conversation;
