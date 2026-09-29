import { useEffect, useRef, useState } from "react";
import { Avatar, Button, IconButton, Spinner, Textarea } from "@primer/react";
import { BellSlashIcon, BellIcon, ChevronLeftIcon, KebabHorizontalIcon } from "@primer/octicons-react";
import PropTypes from "prop-types";
import Link from "next/link";
import ReportModal from "@/components/ReportModal/ReportModal";
import styles from "./MessagesPanel.module.css";

const POLL_INTERVAL_MS = 15000;
const PAGE_SIZE = 30;

/** Data e hora curtas — a conversa é lida em sequência, o ano não ajuda. */
function formatMoment(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function firstName(person) {
  return person?.name || person?.username || "Participante";
}

/**
 * Rótulo do autor de uma mensagem.
 *
 * Numa conversa de estúdio a autoria é coletiva, então a mensagem precisa dizer
 * **quem digitou** — `sent_by` é o humano gravado pelo servidor, e sem ele a
 * outra parte não saberia com quem está falando.
 */
function authorLabel(message, conversation) {
  const name = firstName(message.author);
  const isOwnStudio = message.author.type === "studio" && conversation?.peer?.type !== "studio";

  if (!isOwnStudio || !message.sent_by?.username) return name;
  return `${name} · @${message.sent_by.username}`;
}

/**
 * Conversa aberta: histórico, compositor, silenciar e denúncia.
 *
 * Carrega e mantém os próprios dados (e a paginação) porque tudo aqui gira em
 * torno do mesmo `id` — dividir isso em mais props só criaria intermediários.
 * O painel acima cuida da listagem e é avisado por `onChanged` quando algo
 * aqui altera a ordem ou o contador de não lidas.
 *
 * Não há tempo real no protocolo: a atualização é por consulta periódica
 * (`POLL_INTERVAL_MS`) e por foco da janela — o suficiente para uma caixa de
 * entrada e sem manter um socket aberto por aba.
 */
export default function ConversationThread({
  conversationId,
  partyType = undefined,
  partyId = undefined,
  onBack = undefined,
  onChanged = undefined,
}) {
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState(null);

  const bodyRef = useRef(null);
  const endRef = useRef(null);

  const scope = partyType && partyId ? `party_type=${partyType}&party_id=${encodeURIComponent(partyId)}` : "";

  function params(extra = "") {
    const query = [scope, extra].filter(Boolean).join("&");
    return query ? `?${query}` : "";
  }

  /** Carrega a página mais recente (e marca como lida — efeito de abrir). */
  async function load() {
    const res = await fetch(`/api/v1/conversations/${conversationId}${params(`limit=${PAGE_SIZE}`)}`, { credentials: "include" });

    if (!res.ok) {
      setError(await res.json().catch(() => null));
      setLoading(false);
      return;
    }

    const data = await res.json();
    setThread(data);
    setHasMore(data.has_more);
    setError(null);
    setLoading(false);
  }

  useEffect(() => {
    // Carga inicial. A chamada passa por uma microtask porque `load` define
    // estado, e o lint de hooks acusa `setState` executado de forma síncrona no
    // corpo de um efeito. O efeito e o comportamento são os mesmos — só a
    // definição do estado sai do corpo do efeito.
    //
    // Não há reset de estado aqui: o painel monta este componente com
    // `key={conversationId}`, então trocar de conversa é remontar (o estado
    // inicial já é "carregando").
    Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Consulta periódica + ao voltar o foco para a aba. Só enquanto a conversa
  // está aberta — a listagem não precisa disso.
  useEffect(() => {
    const refresh = () => {
      load();
    };
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    globalThis.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      globalThis.removeEventListener("focus", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Rola para o fim ao abrir e quando chega mensagem nova.
  useEffect(() => {
    const last = thread?.messages?.[thread.messages.length - 1];
    if (last && endRef.current) {
      endRef.current.scrollIntoView({ block: "end" });
    }
  }, [thread?.messages]);

  async function handleLoadOlder() {
    const oldest = thread?.messages?.[0]?.created_at;
    if (!oldest) return;

    setLoadingOlder(true);
    try {
      const res = await fetch(`/api/v1/conversations/${conversationId}${params(`limit=${PAGE_SIZE}&before=${encodeURIComponent(oldest)}`)}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setThread((prev) => ({ ...prev, messages: [...data.messages, ...(prev?.messages ?? [])] }));
      setHasMore(data.has_more);
    } finally {
      setLoadingOlder(false);
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/v1/conversations/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body, party_type: partyType, party_id: partyId }),
      });

      if (!res.ok) {
        setError(await res.json().catch(() => null));
        return;
      }

      const sent = await res.json();
      setThread((prev) => ({ ...prev, messages: [...(prev?.messages ?? []), sent] }));
      setDraft("");
      setError(null);
      onChanged?.();
    } finally {
      setSending(false);
    }
  }

  async function handleToggleMute() {
    const next = !thread?.muted;
    const res = await fetch(`/api/v1/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ muted: next, party_type: partyType, party_id: partyId }),
    });

    if (!res.ok) {
      setError(await res.json().catch(() => null));
      return;
    }

    const data = await res.json();
    setThread((prev) => ({ ...prev, muted: data.muted }));
    onChanged?.();
  }

  async function handleReport(reason, justification) {
    setReportSubmitting(true);
    try {
      const res = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          target_type: "conversation",
          target_id: conversationId,
          reason,
          justification,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setReportError(data?.message || "Não foi possível enviar a denúncia.");
        return;
      }

      setShowReport(false);
      setReportError(null);
    } finally {
      setReportSubmitting(false);
    }
  }

  const conversation = thread?.conversation;
  const peer = conversation?.peer;

  return (
    <section className={styles.thread} aria-label="Conversa">
      <header className={styles.threadHeader}>
        <IconButton icon={ChevronLeftIcon} variant="invisible" aria-label="Voltar para a lista" onClick={onBack} className={styles.backBtn} />

        {peer?.type === "user" ? (
          <Link href={`/perfil/${peer.username}`} className={styles.threadIdentity}>
            <Avatar size={32} src={peer.avatar_url || "/images/avatar.png"} alt="" />
            <span className={styles.threadName}>{firstName(peer)}</span>
          </Link>
        ) : (
          <Link href={peer?.slug ? `/estudios/${peer.slug}` : "#"} className={styles.threadIdentity}>
            <Avatar size={32} src={peer?.avatar_url || "/images/studio.jpg"} alt="" />
            <span className={styles.threadName}>{firstName(peer)}</span>
          </Link>
        )}

        <div className={styles.threadActions}>
          <button
            type="button"
            className={styles.threadAction}
            onClick={handleToggleMute}
            aria-pressed={thread?.muted === true}
            title={thread?.muted ? "Reativar notificações" : "Silenciar notificações"}
          >
            {thread?.muted ? <BellSlashIcon size={14} /> : <BellIcon size={14} />}
            <span className={styles.threadActionLabel}>{thread?.muted ? "Silenciada" : "Silenciar"}</span>
          </button>
          <IconButton
            icon={KebabHorizontalIcon}
            variant="invisible"
            aria-label="Denunciar conversa"
            title="Denunciar conversa"
            onClick={() => setShowReport(true)}
          />
        </div>
      </header>

      <div className={styles.messages} aria-live="polite">
        {loading && (
          <div className={styles.threadLoading}>
            <Spinner size="small" /> Carregando conversa…
          </div>
        )}

        {!loading && hasMore && (
          <div className={styles.loadOlder}>
            <Button size="small" onClick={handleLoadOlder} loading={loadingOlder}>
              Carregar mensagens anteriores
            </Button>
          </div>
        )}

        {!loading && (thread?.messages ?? []).length === 0 && <p className={styles.emptyHint}>Nenhuma mensagem ainda. Diga olá.</p>}

        {(thread?.messages ?? []).map((message) => {
          const own = message.author.type === partyType && String(message.author.id) === String(partyId);
          return (
            <article key={message.id} className={`${styles.message} ${own ? styles.messageOwn : ""}`}>
              {!own && (
                <Avatar
                  size={28}
                  src={message.author.avatar_url || (message.author.type === "studio" ? "/images/studio.jpg" : "/images/avatar.png")}
                  alt=""
                />
              )}
              <div className={styles.bubbleWrap}>
                {!own && <span className={styles.bubbleAuthor}>{authorLabel(message, conversation)}</span>}
                <div className={styles.bubble}>{message.body}</div>
                <span className={styles.bubbleTime}>{formatMoment(message.created_at)}</span>
              </div>
            </article>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && <p className={styles.threadError}>{error.message || "Não foi possível concluir a ação."}</p>}

      <form className={styles.composer} onSubmit={handleSend}>
        <Textarea
          ref={bodyRef}
          className={styles.composerInput}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Escreva uma mensagem…"
          rows={2}
          maxLength={4000}
          disabled={sending}
          aria-label="Mensagem"
          // Enter envia e Shift+Enter quebra linha — o atalho que se espera de um
          // campo de conversa. Sem `preventDefault` o Enter quebraria a linha.
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSend(event);
            }
          }}
        />
        <div className={styles.composerFooter}>
          <span className={styles.composerHint}>
            {partyType === "studio" ? "Você está respondendo em nome do estúdio." : "Enter envia · Shift+Enter quebra linha"}
          </span>
          <Button type="submit" variant="primary" size="small" disabled={!draft.trim() || sending} loading={sending}>
            Enviar
          </Button>
        </div>
      </form>

      {showReport && (
        <ReportModal
          title="Denunciar conversa"
          warning="Esta conversa é privada. Ao denunciar, o histórico completo dela — suas mensagens e as do outro participante — será enviado para a moderação. A equipe poderá ler o conteúdo para julgar a denúncia, e a conversa pode ser congelada."
          hint="Descreva o problema. Denúncias falsas ou em massa podem ser penalizadas, como qualquer outro conteúdo da comunidade."
          onClose={() => {
            setShowReport(false);
            setReportError(null);
          }}
          onSubmit={handleReport}
          submitting={reportSubmitting}
          error={reportError}
        />
      )}
    </section>
  );
}

ConversationThread.propTypes = {
  conversationId: PropTypes.string.isRequired,
  /** Identidade com que o usuário está agindo (`user` ou `studio`). */
  partyType: PropTypes.string,
  partyId: PropTypes.string,
  onBack: PropTypes.func,
  /** Avisa o painel que ordem/contadores mudaram. */
  onChanged: PropTypes.func,
};
