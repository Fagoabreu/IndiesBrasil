import { useState } from "react";
import { Avatar, Textarea, Button, Stack, Text } from "@primer/react";

// Função para calcular tempo decorrido "há X minutos/dias"
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
    if (count >= 1) {
      return `há ${count} ${interval.label}${count > 1 ? "s" : ""}`;
    }
  }

  return "agora";
}

export default function PostCard({ post, dbUserId, onDelete }) {
  const [hasLiked, setHasLiked] = useState(post.likedByUser || false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [newComment, setNewComment] = useState("");

  const handleLike = () => {
    setHasLiked(!hasLiked);
    setLikesCount((prev) => prev + (hasLiked ? -1 : 1));
    // Aqui você chamaria a API de like/unlike
  };

  const handleDelete = () => {
    if (onDelete) onDelete(post.id);
    // Aqui você chamaria a API de delete
  };

  return (
    <Stack
      direction="vertical"
      gap={2}
      sx={{
        padding: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "border.default",
        display: "flex",
        transition: "box-shadow 0.2s, transform 0.2s",
        "&:hover": {
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          transform: "translateY(-2px)",
        },
      }}
    >
      {/* Header */}
      <Stack direction="horizontal" gap={2} sx={{ display: "flex", alignItems: "center" }}>
        <Avatar src={post.author.avatarUrl || "/avatar.png"} />
        <Stack direction="vertical" gap={0}>
          <Text fontWeight="bold">{post.author.name}</Text>
          <Text color="fg.muted" fontSize={0}>
            @{post.author.username} • {timeAgo(post.createdAt)}
          </Text>
        </Stack>
        {dbUserId === post.author.id && (
          <Button variant="invisible" onClick={handleDelete} sx={{ marginLeft: "auto" }}>
            Deletar
          </Button>
        )}
      </Stack>

      {/* Conteúdo */}
      <Text>{post.content}</Text>

      {/* Interações */}
      <Stack direction="horizontal" gap={2}>
        <Button variant="invisible" onClick={handleLike}>
          {hasLiked ? "❤️" : "🤍"} {likesCount}
        </Button>
        <Button variant="invisible" onClick={() => setShowCommentBox(!showCommentBox)}>
          💬 {post.commentsCount || 0}
        </Button>
      </Stack>

      {/* Caixa de comentário */}
      {showCommentBox && (
        <Stack direction="vertical" gap={2} sx={{ marginTop: 2 }}>
          <Textarea placeholder="Comentar..." value={newComment} onChange={(e) => setNewComment(e.target.value)} sx={{ width: "100%" }} />
          <Button
            onClick={() => {
              // Aqui você chamaria a API para criar comentário
              setNewComment("");
            }}
            disabled={!newComment.trim()}
          >
            Comentar
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
