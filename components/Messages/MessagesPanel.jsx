import { useEffect, useState } from "react";
import { Avatar, Spinner } from "@primer/react";
import { BellSlashIcon, CommentDiscussionIcon } from "@primer/octicons-react";
import PropTypes from "prop-types";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import ConversationThread from "./ConversationThread";
import styles from "./MessagesPanel.module.css";

/** Resumo de uma linha: quebra de linha vira espaço e o que sobra é cortado. */
function snippet(conversation) {
  const body = conversation.last_message?.body;
  if (!body) return "Nenhuma mensagem ainda";

  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > 80 ? `${flat.slice(0, 77)}...` : flat;
}

function peerName(conversation) {
  return conversation.peer?.name || conversation.peer?.username || "Participante";
}

function peerAvatar(conversation) {
  if (conversation.peer?.avatar_url) return conversation.peer.avatar_url;
  return conversation.peer?.type === "studio" ? "/images/studio.jpg" : "/images/avatar.png";
}

function formatMoment(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

/**
 * Aba de mensagens: lista de conversas + conversa selecionada.
 *
 * Serve às duas caixas de entrada — a pessoal (`partyType` ausente) e a do
 * estúdio (`partyType="studio"`) —, porque a diferença entre elas é só a
 * identidade enviada à API. Duplicar a tela seria duplicar também as regras de
 * não lidas, silêncio e denúncia.
 *
 * A conversa aberta fica no endereço (`?conversa=<id>`), o que torna o link
 * compartilhável e o botão voltar do navegador funcional.
 */
export default function MessagesPanel({ partyType = undefined, partyId = undefined }) {
  const router = useRouter();
  const { user } = useUser();
  const [conversations, setConversations] = useState(null);
  const [scope, setScope] = useState("inbox");
  const [error, setError] = useState(null);

  const selectedId = typeof router.query.conversa === "string" ? router.query.conversa : null;

  // Identidade EFETIVA da caixa: sem `partyType`, é a pessoal do próprio usuário.
  // A conversa precisa dela para saber quais mensagens são "minhas" (lado direito)
  // e para avisar "respondendo em nome do estúdio" — o servidor, quando ninguém
  // informa nada, já assume a caixa pessoal.
  const effectivePartyType = partyType || "user";
  const effectivePartyId = partyId || user?.id;
  const scopeQuery =
    effectivePartyType && effectivePartyId ? `&party_type=${effectivePartyType}&party_id=${encodeURIComponent(effectivePartyId)}` : "";

  /**
   * Carrega a lista do filtro atual.
   *
   * `reset` só é usado na troca de filtro: ali a tela passa a mostrar outro
   * conjunto e o esqueleto é honesto. No refresh em segundo plano (mensagem
   * enviada, conversa fechada) a lista anterior permanece até chegar a nova —
   * piscar a tela a cada mensagem enviada seria pior que um dado por um
   * instante desatualizado.
   */
  async function loadConversations({ reset = false } = {}) {
    // O reset de "carregando" vive aqui (e não no efeito): dentro de um efeito,
    // alterar estado de forma síncrona dispara render em cascata — é o que o
    // lint do projeto aponta. Assim a marcação e a busca acontecem juntas.
    if (reset) setConversations(null);

    const res = await fetch(`/api/v1/conversations?scope=${scope}${scopeQuery}`, { credentials: "include" });

    if (!res.ok) {
      setError(await res.json().catch(() => null));
      setConversations([]);
      return;
    }

    setConversations(await res.json());
    setError(null);
  }

  useEffect(() => {
    // `loadConversations` define estado, e o lint de hooks acusa `setState` no
    // corpo do efeito; pela microtask a definição acontece no callback da
    // promessa. Mesma função usada no refresh de `onChanged` — uma consulta só.
    Promise.resolve().then(() => loadConversations({ reset: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, scopeQuery]);

  function openConversation(id) {
    setScope("inbox");
    router.replace({ query: { ...router.query, conversa: id } }, undefined, { shallow: true });
  }

  function closeConversation() {
    const query = { ...router.query };
    delete query.conversa;
    router.replace({ query }, undefined, { shallow: true });
    // Voltar para a lista é o momento de buscar de novo: a conversa aberta pode
    // ter mudado a ordem (data da última mensagem) e o contador de não lidas.
    loadConversations();
  }

  function changeScope(next) {
    setScope(next);
    // A lista muda de conjunto; manter a conversa aberta apontaria para algo que
    // pode não estar mais na tela.
    closeConversation();
  }

  const list = conversations ?? [];

  return (
    <div className={styles.panel}>
      <div className={styles.scopeBar} role="tablist" aria-label="Filtro de conversas">
        <button
          type="button"
          role="tab"
          aria-selected={scope === "inbox"}
          className={`${styles.scopeBtn} ${scope === "inbox" ? styles.scopeBtnActive : ""}`}
          onClick={() => changeScope("inbox")}
        >
          Todas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === "muted"}
          className={`${styles.scopeBtn} ${scope === "muted" ? styles.scopeBtnActive : ""}`}
          onClick={() => changeScope("muted")}
        >
          <BellSlashIcon size={12} /> Silenciadas
        </button>
      </div>

      <div className={`${styles.grid} ${selectedId ? styles.gridThreadOpen : ""}`}>
        <div className={styles.list} aria-label="Conversas">
          {conversations === null && (
            <div className={styles.listState}>
              <Spinner size="small" /> Carregando conversas…
            </div>
          )}

          {conversations !== null && list.length === 0 && (
            <div className={styles.emptyState}>
              <CommentDiscussionIcon size={20} />
              <p className={styles.emptyTitle}>{scope === "muted" ? "Nenhuma conversa silenciada" : "Nenhuma conversa ainda"}</p>
              <p className={styles.emptyHint}>
                {scope === "muted"
                  ? "Conversas silenciadas aparecem aqui, e você pode reativar as notificações a qualquer momento."
                  : "Abra o perfil de um membro ou a página de um estúdio e use “Enviar mensagem”."}
              </p>
            </div>
          )}

          {list.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={`${styles.item} ${selectedId === conversation.id ? styles.itemActive : ""}`}
              onClick={() => openConversation(conversation.id)}
            >
              <Avatar size={40} src={peerAvatar(conversation)} alt="" />
              <span className={styles.itemBody}>
                <span className={styles.itemTop}>
                  <span className={styles.itemName}>{peerName(conversation)}</span>
                  <span className={styles.itemDate}>{formatMoment(conversation.last_message_at || conversation.created_at)}</span>
                </span>
                <span className={styles.itemSnippet}>{snippet(conversation)}</span>
              </span>
              {conversation.unread_count > 0 && (
                <span className={styles.unreadBadge} aria-label={`${conversation.unread_count} não lidas`}>
                  {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                </span>
              )}
              {conversation.muted && <BellSlashIcon size={12} className={styles.mutedMark} />}
            </button>
          ))}
        </div>

        <div className={styles.threadColumn}>
          {selectedId ? (
            <ConversationThread
              key={selectedId}
              conversationId={selectedId}
              partyType={effectivePartyType}
              partyId={effectivePartyId}
              onBack={closeConversation}
              onChanged={loadConversations}
            />
          ) : (
            <div className={styles.threadPlaceholder}>
              <CommentDiscussionIcon size={20} />
              <p className={styles.emptyHint}>Escolha uma conversa para ler e responder.</p>
            </div>
          )}
        </div>
      </div>

      {error && <p className={styles.panelError}>{error.message || "Não foi possível carregar as conversas."}</p>}
    </div>
  );
}

MessagesPanel.propTypes = {
  /** `studio` quando a caixa é a compartilhada do estúdio; ausente = pessoal. */
  partyType: PropTypes.string,
  /** Id do estúdio, quando `partyType` é informado. */
  partyId: PropTypes.string,
};
