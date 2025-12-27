// components/PostCardComponent.jsx
import { useState } from "react";
import { Avatar, Button, Stack } from "@primer/react";
import styles from "./PostCardComponent.module.css";
import PostActionsComponent from "../PostActions/PostActionsComponent";
import CommentPanelComponent from "../CommentPanel/CommentPanelComponent";

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
  const [hasLiked, setHasLiked] = useState(post.liked_by_user || false);
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

  const handleLike = () => {
    const liked = !hasLiked;
    setHasLiked(liked);
    setLikesCount((prev) => prev + (liked ? 1 : -1));

    fetch(`/api/v1/posts/${post.id}/likes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ liked }),
    });
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

  return (
    <article className={styles.postCard}>
      {/* HEADER */}
      <Stack direction="horizontal" gap={2} className={styles.headerRow}>
        <Avatar src={post.author_avatar_url || "/images/avatar.png"} size={32} />

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
      {/* IMAGEM DO POST */}
      {post.post_img_url && (
        <div className={styles.imageWrapper}>
          <img src={post.post_img_url} alt="Imagem do post" loading="lazy" className={styles.postImage} />
        </div>
      )}

      {/* AÇÕES */}
      <PostActionsComponent
        hasLiked={hasLiked}
        likesCount={likesCount}
        commentsCount={commentsCount}
        canInteract={canInteract}
        onLike={handleLike}
        onToggleComments={toggleComments}
        onReply={() => setShowCommentBox(true)}
      />

      {/* PAINEL DE COMENTÁRIOS */}
      <CommentPanelComponent
        comments={comments}
        showCommentBox={showCommentBox}
        showComments={showComments}
        onCloseCommentBox={() => setShowCommentBox(false)}
        onSubmitComment={handleSubmitComment}
        onDeleteComment={deleteComments}
      />
    </article>
  );
}
