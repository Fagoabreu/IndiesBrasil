// components/PostCardComponent.jsx
import { useState } from "react";
import { Avatar, Button } from "@primer/react";
import Link from "next/link";
import styles from "./PostCardComponent.module.css";
import PostActionsComponent from "../PostActions/PostActionsComponent";
import CommentPanelComponent from "../CommentPanel/CommentPanelComponent";
import EmbedComponent from "../Embeds/EmbedComponent";
import Image from "next/image";
import PropTypes from "prop-types";

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
  canInteract: PropTypes.bool,
  onTagClick: PropTypes.func,
};

export default function PostCardComponent({ post, onDelete, canInteract = true, onTagClick }) {
  const [hasLiked, setHasLiked] = useState(post.liked_by_user || false);
  const [actionMessage, setActionMessage] = useState(null);
  const [likesCount, setLikesCount] = useState(Number(post.likes_count) || 0);
  const [commentsCount, setCommentsCount] = useState(Number(post.comments_count));

  const [showCommentBox, setShowCommentBox] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  const MAX_CHARS = 240;
  const isLong = post.content.length > MAX_CHARS;
  const shownText = expanded ? post.content : post.content.slice(0, MAX_CHARS);

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

    return text.split(regex).map((part) => {
      // LINK
      if (part.startsWith("http://") || part.startsWith("https://")) {
        return (
          <a key={`link-${part}`} href={part} target="_blank" rel="noopener noreferrer" className={styles.link}>
            {part}
          </a>
        );
      }

      // TAG
      if (part.startsWith("#")) {
        const tag = part.slice(1).toLowerCase();

        return (
          <button key={`tag-${part}`} type="button" className={styles.tag} onClick={() => onTagClick?.(tag)}>
            {part}
          </button>
        );
      }

      // TEXTO NORMAL
      return <span key={`text-${part}`}>{part}</span>;
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
            <div>
              <Link href={`/perfil/${post.author_username}`} className={styles.authorName}>
                <strong>{post.author_username}</strong>
              </Link>
              <span className={styles.subInfo}>
                @{post.author_username} · {timeAgo(post.created_at)}
              </span>
            </div>
            {canInteract && post.is_current_user && (
              <Button variant="invisible" size="small" className={styles.deleteBtn} onClick={() => onDelete?.(post.id)}>
                Deletar
              </Button>
            )}
          </div>

          {/* EVENTO RELACIONADO */}
          {post.event_id && (
            <Link href={post.event_slug ? `/agenda/${post.event_slug}` : `/agenda/${post.event_id}`} className={styles.eventBadge}>
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
            {renderRichText(shownText, { onTagClick })}
            {isLong && (
              <button className={styles.showMoreBtn} onClick={() => setExpanded(!expanded)}>
                {expanded ? "Mostrar menos" : "Mostrar mais"}
              </button>
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
    </article>
  );
}
