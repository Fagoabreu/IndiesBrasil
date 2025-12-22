// components/PostCardComponent.jsx
import { useState } from "react";
import { Avatar, Textarea, Button, Stack } from "@primer/react";
import styles from "./PostCardComponent.module.css";

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

export default function PostCardComponent({ post, onDelete, canInteract = true }) {
  const [hasLiked, setHasLiked] = useState(post.likedByUser || false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);

  const MAX_CHARS = 240;
  const isLong = post.content.length > MAX_CHARS;
  const shownText = expanded ? post.content : post.content.slice(0, MAX_CHARS);

  const handleLike = () => {
    setHasLiked(!hasLiked);
    setLikesCount((prev) => prev + (hasLiked ? -1 : 1));
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

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    try {
      const res = await fetch(`/api/v1/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: newComment }),
      });

      if (!res.ok) {
        console.error("Erro ao comentar");
        return;
      }

      const createdComment = await res.json();

      // Adiciona novo comentário na lista
      setComments((prev) => [createdComment, ...prev]);
      setCommentsCount((prev) => prev + 1);

      // Limpa e fecha o box
      setNewComment("");
      setShowCommentBox(false);

      // Garante que a lista apareça
      setShowComments(true);
    } catch (error) {
      console.error("Erro ao enviar comentário:", error);
    }
  };

  return (
    <div className={styles.postWrapper}>
      {/* HEADER */}
      <Stack direction="horizontal" gap={2} className={styles.headerRow}>
        <Avatar src={post.author_avatar_url || "/images/avatar.png"} size={32} sx={{ borderRadius: "50%" }} />

        <Stack direction="vertical" gap={0} className={styles.headerText}>
          <span className={styles.authorName}>{post.author_username}</span>
          <span className={styles.subInfo}>
            @{post.author_username} • {timeAgo(post.created_at)}
          </span>
        </Stack>

        {post.is_current_user && (
          <Button variant="invisible" className={styles.deleteBtn} onClick={() => onDelete?.(post.id)}>
            Deletar
          </Button>
        )}
      </Stack>

      {/* CONTEÚDO */}
      <p className={styles.postContent}>
        {shownText}
        {isLong && (
          <button className={styles.showMoreBtn} onClick={() => setExpanded(!expanded)}>
            {expanded ? "Mostrar menos" : "Mostrar mais"}
          </button>
        )}
      </p>

      {/* AÇÕES */}
      <div className={styles.actions}>
        {/* LIKE */}
        {canInteract && (
          <button className={`${styles.iconBtn} ${hasLiked ? styles.liked : ""}`} onClick={handleLike}>
            <span className={styles.heart}>❤️</span>
            <span>{likesCount}</span>
          </button>
        )}

        {/* MOSTRAR / OCULTAR COMENTÁRIOS */}
        <button className={styles.iconBtn} onClick={toggleComments}>
          💬 <span>{commentsCount}</span>
        </button>

        {/* RESPONDER */}
        {canInteract && (
          <button className={styles.replyBtn} onClick={() => setShowCommentBox(true)}>
            Responder
          </button>
        )}
      </div>

      {/* LISTA DE COMENTÁRIOS */}
      {showComments && (
        <div className={styles.commentList}>
          {comments.map((c, idx) => (
            <div key={idx} className={styles.commentItem}>
              <Avatar src={c.author_avatar_url || "/images/avatar.png"} size={32} sx={{ borderRadius: "50%" }} />
              <div className={styles.commentBody}>
                <span className={styles.commentUser}>@{c.author_username}</span>
                <p className={styles.commentText}>{c.content}</p>
              </div>
              {c.is_current_user && (
                <Button variant="invisible" className={styles.deleteBtn} onClick={() => deleteComments?.(c.id)}>
                  Deletar
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CAIXA DE COMENTÁRIO */}
      {showCommentBox && (
        <div className={styles.commentBox}>
          <Textarea placeholder="Adicionar comentário..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
          <div className={styles.commentActions}>
            <Button onClick={handleSubmitComment} disabled={!newComment.trim()}>
              Comentar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
