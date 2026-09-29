import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Avatar, Button, Flash, Heading, PageLayout, Spinner } from "@primer/react";
import { CommentDiscussionIcon, ShieldLockIcon } from "@primer/octicons-react";
import { useUser } from "@/context/UserContext";
import styles from "./[id].module.css";

function formatMoment(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function participantLink(participant) {
  if (participant.type === "studio") {
    return participant.slug ? `/estudios/${participant.slug}` : null;
  }
  return participant.username ? `/perfil/${participant.username}` : null;
}

function participantName(participant) {
  return participant.name || participant.username || participant.id;
}

/**
 * Visualizador de uma conversa denunciada (somente leitura).
 *
 * Existe para a moderação poder **julgar** a denúncia: sem ler o que foi
 * escrito, "Resolver" e "Arquivar" seriam chutes. O acesso é restrito a
 * administradores e limitado ao `id` da conversa denunciada — não há rota que
 * liste conversas.
 *
 * Não há ação de escrita aqui: a conversa não tem edição nem exclusão. Congelar
 * é uma ação de moderação comum ("Bloquear"), pela tela de moderação, com
 * `target_type = "conversation"`.
 */
export default function AdminConversationPage() {
  const router = useRouter();
  const { user, loadingUser } = useUser();
  const { id } = router.query;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const isAdmin = Boolean(user?.features?.includes("read:admin"));

  useEffect(() => {
    if (!id || !isAdmin) return;
    let cancelled = false;

    fetch(`/api/v1/admin/conversations/${id}?limit=50`, { credentials: "include" })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(await res.json().catch(() => null));
          setData(null);
          return;
        }
        setData(await res.json());
        setError(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, isAdmin]);

  async function handleLoadOlder() {
    const oldest = data?.messages?.[0]?.created_at;
    if (!oldest) return;

    setLoadingOlder(true);
    try {
      const res = await fetch(`/api/v1/admin/conversations/${id}?limit=50&before=${encodeURIComponent(oldest)}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const page = await res.json();
      setData((prev) => ({ ...prev, messages: [...page.messages, ...(prev?.messages ?? [])], has_more: page.has_more }));
    } finally {
      setLoadingOlder(false);
    }
  }

  if (loadingUser) {
    return (
      <PageLayout padding="none">
        <PageLayout.Content width="large">
          <div className={styles.state}>
            <Spinner size="medium" />
          </div>
        </PageLayout.Content>
      </PageLayout>
    );
  }

  if (!isAdmin) {
    return (
      <PageLayout padding="none">
        <PageLayout.Content width="medium">
          <div className={styles.state}>
            <Flash variant="danger">Acesso restrito a administradores.</Flash>
          </div>
        </PageLayout.Content>
      </PageLayout>
    );
  }

  const participants = data?.conversation?.participants ?? [];

  return (
    <PageLayout padding="none">
      <PageLayout.Content width="large">
        <div className={styles.page}>
          <header className={styles.header}>
            <Heading as="h1" className={styles.title}>
              <CommentDiscussionIcon size={18} /> Conversa denunciada
            </Heading>
            <Button size="small" onClick={() => router.push("/admin/reports")}>
              Voltar para denúncias
            </Button>
          </header>

          <p className={styles.notice}>
            <ShieldLockIcon size={14} /> Conteúdo privado, exibido apenas para julgar a denúncia. O acesso a esta tela é restrito à moderação.
          </p>

          {error && <Flash variant="danger">{error.message || "Não foi possível carregar a conversa."}</Flash>}

          {data?.conversation?.frozen && (
            <Flash variant="warning">Esta conversa está congelada: os participantes leem o histórico, mas ninguém envia novas mensagens.</Flash>
          )}

          {loading && (
            <div className={styles.state}>
              <Spinner size="medium" />
            </div>
          )}

          {!loading && data && (
            <>
              <section className={styles.participants}>
                {participants.map((participant) => {
                  const href = participantLink(participant);
                  return (
                    <div key={`${participant.type}_${participant.id}`} className={styles.participant}>
                      <Avatar
                        size={32}
                        src={participant.avatar_url || (participant.type === "studio" ? "/images/studio.jpg" : "/images/avatar.png")}
                        alt=""
                      />
                      <span className={styles.participantBody}>
                        {href ? (
                          <Link href={href} className={styles.participantName}>
                            {participantName(participant)}
                          </Link>
                        ) : (
                          <span className={styles.participantName}>{participantName(participant)}</span>
                        )}
                        <span className={styles.participantMeta}>{participant.type === "studio" ? "Estúdio" : "Membro"}</span>
                      </span>
                    </div>
                  );
                })}
                <div className={styles.participantMeta}>Aberta em {formatMoment(data.conversation.created_at)}</div>
              </section>

              <section className={styles.messages}>
                {data.has_more && (
                  <div className={styles.loadOlder}>
                    <Button size="small" onClick={handleLoadOlder} loading={loadingOlder}>
                      Carregar mensagens anteriores
                    </Button>
                  </div>
                )}

                {(data.messages ?? []).map((message) => (
                  <article key={message.id} className={styles.message}>
                    <div className={styles.messageHead}>
                      <span className={styles.messageAuthor}>
                        {message.author.type === "studio" ? "Estúdio" : "Membro"}:{" "}
                        {message.author.name || message.author.username || message.author.id}
                      </span>
                      {/* Autoria humana: numa mensagem de estúdio é o membro que
                          digitou — é a quem uma sanção precisa ser atribuída. */}
                      {message.author.type === "studio" && message.sent_by?.username && (
                        <span className={styles.messageSentBy}>enviada por @{message.sent_by.username}</span>
                      )}
                      <span className={styles.messageTime}>{formatMoment(message.created_at)}</span>
                    </div>
                    <p className={styles.messageBody}>{message.body}</p>
                  </article>
                ))}
              </section>
            </>
          )}
        </div>
      </PageLayout.Content>
    </PageLayout>
  );
}
