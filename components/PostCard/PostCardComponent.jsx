// components/PostCardComponent.jsx
import { useState } from "react";
import { Avatar, Button, Textarea } from "@primer/react";
import Link from "next/link";
import styles from "./PostCardComponent.module.css";
import PostActionsComponent from "../PostActions/PostActionsComponent";
import CommentPanelComponent from "../CommentPanel/CommentPanelComponent";
import EmbedComponent from "../Embeds/EmbedComponent";
import ShareModal from "../ShareModal/ShareModal";
import ReportModal from "../ReportModal/ReportModal";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import Image from "next/image";
import PropTypes from "prop-types";
import PollComponent from "./PollComponent";

function timeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);

  const intervals = [
    { label: "ano", seconds: 31536000 },
    { label: "mês", seconds: 2592000 },
    { label: "dia", seconds: 86400 },
    { label: "hora", seconds: 3600 },
    { label: "minuto", seconds: 60 },
    { label: "segundo", seconds: 1 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) return `há ${count} ${interval.label}${count > 1 ? "s" : ""}`;
  }
  return "agora";
}

PostCardComponent.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    content: PropTypes.string.isRequired,

    author_username: PropTypes.string.isRequired,
    author_avatar_url: PropTypes.string,

    created_at: PropTypes.string.isRequired,
    edited_at: PropTypes.string,

    liked_by_user: PropTypes.bool,
    likes_count: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    comments_count: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

    is_current_user: PropTypes.bool,

    post_img_url: PropTypes.string,
    embed: PropTypes.array,

    event_id: PropTypes.string,
    event_title: PropTypes.string,
    event_slug: PropTypes.string,

    organization_id: PropTypes.string,
    organization_slug: PropTypes.string,
    organization_name: PropTypes.string,
    organization_logo_url: PropTypes.string,
  }).isRequired,

  onDelete: PropTypes.func,
  onEdit: PropTypes.func,
  canInteract: PropTypes.bool,
  onTagClick: PropTypes.func,
  /**
   * Exibe "Ver post completo" apontando para `/posts/[id]`. Ligado na página do
   * evento, onde o card é a única superfície do post — no feed o permalink já
   * existe no botão de compartilhar, e o link extra seria ruído.
   */
  showPermalink: PropTypes.bool,
};

export default function PostCardComponent({ post, onDelete, onEdit, canInteract = true, onTagClick, showPermalink = false }) {
  const [hasLiked, setHasLiked] = useState(post.liked_by_user || false);
  const [actionMessage, setActionMessage] = useState(null);
  const [likesCount, setLikesCount] = useState(Number(post.likes_count) || 0);
  const [commentsCount, setCommentsCount] = useState(Number(post.comments_count));

  // O texto exibido sai daqui, não direto de `post.content`: depois de salvar a
  // edição o card precisa refletir o texto novo mesmo antes de o pai repropsá-lo.
  const [content, setContent] = useState(post.content);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  // Exclusão pede confirmação: o botão agia na primeira batida e não há
  // desfazer para o post nem para os comentários dele.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const [showCommentBox, setShowCommentBox] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState(null);

  const MAX_CHARS = 240;
  const isLong = content.length > MAX_CHARS;
  const shownText = expanded ? content : content.slice(0, MAX_CHARS);

  function startEditing() {
    setDraft(content);
    setEditError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEditError(null);
  }

  async function handleSaveEdit(event) {
    event.preventDefault();

    const nextContent = draft.trim();
    if (!nextContent) {
      setEditError("O post não pode ficar vazio.");
      return;
    }

    setSaving(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/v1/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: nextContent }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setEditError(data.message || "Não foi possível salvar a edição.");
        return;
      }

      setContent(data.content);
      setEditing(false);
      // O pai guarda a lista de posts: sem avisar, o texto antigo volta no
      // próximo render (troca de aba, paginação, refetch).
      onEdit?.(data);
    } catch {
      setEditError("Falha de rede ao salvar a edição.");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Exclusão já confirmada no diálogo.
   *
   * O `onDelete` vem da página e devolve `true`/`false` (ou `undefined` quando a
   * página navega depois). O `await` cobre os três formatos; o diálogo fecha
   * depois da resposta, não antes, para o "excluindo" aparecer no botão e para
   * uma falha não passar como sucesso.
   */
  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteError(null);

    try {
      const deleted = await onDelete?.(post.id);

      // Contrato opcional: a página devolve `false` quando a API recusou. Sem
      // isso, o diálogo fecharia como se o post tivesse saído.
      if (deleted === false) {
        setDeleteError("Não foi possível deletar o post. Tente novamente.");
        return;
      }

      setConfirmingDelete(false);
    } catch {
      setDeleteError("Falha de rede ao deletar o post.");
    } finally {
      setDeleting(false);
    }
  }

  function openDeleteConfirmation() {
    setDeleteError(null);
    setConfirmingDelete(true);
  }

  const handleLike = async () => {
    const beforeLiked = hasLiked;
    const beforeCount = likesCount;
    const liked = !hasLiked;
    setHasLiked(liked);
    setLikesCount((prev) => prev + (liked ? 1 : -1));
    setActionMessage(null);

    const res = await fetch(`/api/v1/posts/${post.id}/likes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ liked }),
    });

    if (!res.ok) {
      const data = await res.json();
      setHasLiked(beforeLiked);
      setLikesCount(beforeCount);
      setActionMessage(data.message);
    }
  };

  const toggleComments = async () => {
    if (!commentsLoaded) {
      // Carregar comentários pela 1ª vez
      try {
        const res = await fetch(`/api/v1/posts/${post.id}/comments`, {
          credentials: "include",
        });
        const data = await res.json();
        setComments(data || []);
        setCommentsLoaded(true);
      } catch (e) {
        console.error("Erro ao carregar comentários", e);
      }
    }

    setShowComments((prev) => !prev);
  };

  const deleteComments = async (commentId) => {
    try {
      const res = await fetch(`/api/v1/posts/${post.id}/comments/${commentId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        console.error("Erro ao deletar comentário");
        return;
      }

      // Remove do estado
      setComments((prev) => prev.filter((c) => c.id !== commentId));

      // Atualiza contador
      setCommentsCount((prev) => prev - 1);
    } catch (error) {
      console.error("Erro ao deletar comentário:", error);
    }
  };

  const handleReport = async (reason, justification) => {
    setReportSubmitting(true);
    setReportError(null);

    try {
      const res = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          target_type: "post",
          target_id: post.id,
          reason,
          justification: justification || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setReportError(data.message || "Não foi possível enviar a denúncia.");
        return;
      }

      setShowReportModal(false);
      setActionMessage("Denúncia enviada. Obrigado por ajudar a manter a comunidade segura.");
    } catch {
      setReportError("Não foi possível enviar a denúncia.");
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleSubmitComment = async (content) => {
    try {
      const res = await fetch(`/api/v1/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });

      if (!res.ok) return;

      const createdComment = await res.json();

      // Adiciona novo comentário na lista
      setComments((prev) => [createdComment, ...prev]);
      setCommentsCount((prev) => prev + 1);

      // Limpa e fecha o box
      setShowCommentBox(false);

      // Garante que a lista apareça
      setShowComments(true);
    } catch (error) {
      console.error("Erro ao enviar comentário:", error);
    }
  };

  function renderRichText(text, { onTagClick }) {
    const regex = /(https?:\/\/[^\s]+|#\w+)/g;

    return text.split(regex).map((part, i) => {
      if (!part) return null;

      // LINK
      if (part.startsWith("http://") || part.startsWith("https://")) {
        return (
          <a key={`link-${i}-${part.slice(0, 30)}`} href={part} target="_blank" rel="noopener noreferrer" className={styles.link}>
            {part}
          </a>
        );
      }

      // TAG
      if (part.startsWith("#")) {
        const tag = part.slice(1).toLowerCase();

        return (
          <button key={`tag-${i}-${part}`} type="button" className={styles.tag} onClick={() => onTagClick?.(tag)}>
            {part}
          </button>
        );
      }

      // TEXTO NORMAL
      return <span key={`text-${i}`}>{part}</span>;
    });
  }

  return (
    <article className={styles.postCard}>
      <div className={styles.postGrid}>
        {/* COLUNA AVATAR */}
        <div className={styles.avatarCol}>
          <Link href={`/perfil/${post.author_username}`} className={styles.avatarLink}>
            <Avatar src={post.author_avatar_url || "/images/avatar.png"} size={40} />
          </Link>
        </div>
        {/* COLUNA CONTEÚDO */}
        <div className={styles.contentCol}>
          {/* HEADER */}
          <div className={styles.header}>
            <div className={styles.authorInfo}>
              <Link href={`/perfil/${post.author_username}`} className={styles.authorName}>
                <strong>{post.author_username}</strong>
              </Link>
              <span className={styles.subInfo}>
                @{post.author_username} · {timeAgo(post.created_at)}
                {post.edited_at ? " · editado" : ""}
              </span>
            </div>
            {canInteract && post.is_current_user && (
              <div className={styles.ownerActions}>
                {!editing && (
                  <Button variant="invisible" size="small" onClick={startEditing}>
                    Editar
                  </Button>
                )}
                <Button variant="invisible" size="small" className={styles.deleteBtn} aria-haspopup="dialog" onClick={openDeleteConfirmation}>
                  Deletar
                </Button>
              </div>
            )}
          </div>

          {/* EVENTO RELACIONADO
              Sempre pelo **id**: `/agenda/[id]` valida UUID (`isUuid`) e
              responde 404 para slug. O badge preferia `event_slug`, então todo
              post com slug preenchido levava a "página não encontrada" — o id é
              o endereço canônico em todo o resto do site (EventCard, sitemap). */}
          {post.event_id && (
            <Link href={`/agenda/${post.event_id}`} className={styles.eventBadge}>
              <span className={styles.eventBadgeIcon}>📅</span>
              <span className={styles.eventBadgeLabel}>{post.event_title || "Ver evento"}</span>
            </Link>
          )}

          {/* ORGANIZAÇÃO RELACIONADA */}
          {post.organization_id && post.organization_slug && (
            <Link href={`/estudios/${post.organization_slug}`} className={styles.orgBadge}>
              {post.organization_logo_url ? (
                <Image
                  src={post.organization_logo_url}
                  alt={post.organization_name || "Estúdio"}
                  width={18}
                  height={18}
                  className={styles.orgBadgeLogo}
                />
              ) : (
                <span className={styles.orgBadgeInitial}>{(post.organization_name || "E")[0].toUpperCase()}</span>
              )}
              <span className={styles.orgBadgeName}>{post.organization_name}</span>
            </Link>
          )}

          {/* TEXTO */}
          <div className={styles.text}>
            {editing ? (
              <form className={styles.editForm} onSubmit={handleSaveEdit}>
                <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={4} block aria-label="Editar post" autoFocus />
                {editError && (
                  <p className={styles.editError} role="alert">
                    {editError}
                  </p>
                )}
                <div className={styles.editActions}>
                  <Button type="submit" variant="primary" size="small" loading={saving}>
                    Salvar
                  </Button>
                  <Button type="button" variant="invisible" size="small" onClick={cancelEditing} disabled={saving}>
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <>
                {renderRichText(shownText, { onTagClick })}
                {isLong && (
                  <button className={styles.showMoreBtn} onClick={() => setExpanded(!expanded)}>
                    {expanded ? "Mostrar menos" : "Mostrar mais"}
                  </button>
                )}
              </>
            )}
          </div>

          {/* IMAGEM */}
          {post.post_img_url && (
            <div className={styles.media}>
              <Image src={post.post_img_url} alt="Imagem do post" loading="lazy" width={0} height={0} sizes="100vw" />
            </div>
          )}

          {/* EMBEDS */}
          <EmbedComponent embeds={post.embed} />

          {/* ENQUETE */}
          {post.poll_id && (
            <PollComponent
              postId={post.id}
              question={post.poll_question || ""}
              options={post.options || []}
              userVote={post.user_vote}
              endedAt={post.poll_ended_at}
              isAuthor={post.is_current_user}
            />
          )}

          {/* PERMALINK */}
          {showPermalink && (
            <Link href={`/posts/${post.id}`} className={styles.permalink}>
              Ver post completo →
            </Link>
          )}

          {/* AÇÕES */}
          <PostActionsComponent
            hasLiked={hasLiked}
            likesCount={likesCount}
            commentsCount={commentsCount}
            actionMessage={actionMessage}
            canInteract={canInteract}
            onLike={handleLike}
            onToggleComments={toggleComments}
            onReply={() => setShowCommentBox(true)}
            onShare={() => setShowShareModal(true)}
            onReport={canInteract && !post.is_current_user ? () => setShowReportModal(true) : undefined}
          />

          {/* COMENTÁRIOS */}
          <CommentPanelComponent
            comments={comments}
            showCommentBox={showCommentBox}
            showComments={showComments}
            onCloseCommentBox={() => setShowCommentBox(false)}
            onSubmitComment={handleSubmitComment}
            onDeleteComment={deleteComments}
          />
        </div>
      </div>

      {showShareModal && (
        <ShareModal
          path={`/posts/${post.id}`}
          text={content?.slice(0, 200)}
          title="Compartilhar post"
          hint="Copie o link e cole no WhatsApp, Discord ou Instagram. A miniatura do post será exibida automaticamente."
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showReportModal && (
        <ReportModal onClose={() => setShowReportModal(false)} onSubmit={handleReport} submitting={reportSubmitting} error={reportError} />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="Deletar post"
          description="Tem certeza de que quer deletar este post?"
          details="O texto, as curtidas e os comentários serão apagados. Não dá para desfazer."
          error={deleteError}
          confirmLabel="Deletar"
          danger
          loading={deleting}
          onClose={() => setConfirmingDelete(false)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </article>
  );
}
