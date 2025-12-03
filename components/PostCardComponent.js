// components/PostCardComponent.jsx
import { useState } from "react";
import { Avatar, Textarea, Button, Stack, Text } from "@primer/react";
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

export default function PostCardComponent({ post, dbUserId, onDelete }) {
  const [hasLiked, setHasLiked] = useState(post.likedByUser || false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);

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

  return (
    <div className={styles.postWrapper}>
      {/* HEADER */}
      <Stack direction="horizontal" gap={2} className={styles.headerRow}>
        <Avatar src={post.author.avatarUrl || "/avatar.png"} size={32} sx={{ borderRadius: "50%" }} />

        <Stack direction="vertical" gap={0} className={styles.headerText}>
          <Text className={styles.authorName}>{post.author.name}</Text>
          <Text className={styles.subInfo}>
            @{post.author.username} • {timeAgo(post.createdAt)}
          </Text>
        </Stack>

        {dbUserId === post.author.id && (
          <Button variant="invisible" className={styles.deleteBtn} onClick={() => onDelete?.(post.id)}>
            Deletar
          </Button>
        )}
      </Stack>

      {/* CONTEÚDO */}
      <Text className={styles.postContent}>
        {shownText}
        {isLong && (
          <button className={styles.showMoreBtn} onClick={() => setExpanded(!expanded)}>
            {expanded ? "Mostrar menos" : "Mostrar mais"}
          </button>
        )}
      </Text>

      {/* AÇÕES */}
      <div className={styles.actions}>
        {/* LIKE */}
        <button className={`${styles.iconBtn} ${hasLiked ? styles.liked : ""}`} onClick={handleLike}>
          <span className={styles.heart}>❤️</span>
          <span>{likesCount}</span>
        </button>

        {/* MOSTRAR / OCULTAR COMENTÁRIOS */}
        <button className={styles.iconBtn} onClick={toggleComments}>
          💬 <span>{post.commentsCount || 0}</span>
        </button>

        {/* RESPONDER */}
        <button className={styles.replyBtn} onClick={() => setShowCommentBox(true)}>
          Responder
        </button>
      </div>

      {/* LISTA DE COMENTÁRIOS */}
      {showComments && (
        <div className={styles.commentList}>
          {comments.map((c, idx) => (
            <div key={idx} className={styles.commentItem}>
              <Text className={styles.commentUser}>@{c.username}</Text>
              <Text className={styles.commentText}>{c.text}</Text>
            </div>
          ))}
        </div>
      )}

      {/* CAIXA DE COMENTÁRIO */}
      {showCommentBox && (
        <div className={styles.commentBox}>
          <Textarea placeholder="Adicionar comentário..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
          <div className={styles.commentActions}>
            <Button
              onClick={() => {
                setNewComment("");
                setShowCommentBox(false);
              }}
              disabled={!newComment.trim()}
            >
              Comentar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
