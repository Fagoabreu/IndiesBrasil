import React, { useState } from "react";
import { Avatar, Text, Button, Stack, Textarea } from "@primer/react";

// Demo posts e sugestões para protótipo visual
const initialPosts = [
  { id: 1, author: "Alice", content: "Trabalhando em um novo jogo de plataforma retro! 🚀" },
  { id: 2, author: "Bob", content: "Acabei de lançar meu primeiro RPG indie! 🎮" },
  { id: 3, author: "Carol", content: "Procurando feedback sobre meu level design." },
];

export default function Posts({ user }) {
  const [posts, setPosts] = useState(initialPosts);
  const [newPost, setNewPost] = useState("");

  const handlePostSubmit = () => {
    if (!newPost.trim()) return;
    const post = {
      id: posts.length + 1,
      author: user ? user.name : "Anônimo",
      content: newPost,
    };
    setPosts([post, ...posts]);
    setNewPost("");
  };

  return (
    <Stack direction="vertical" gap={3} sx={{ display: "flex" }}>
      {/* New Post Box */}
      {user && (
        <Stack direction="vertical" gap={2} sx={{ padding: 3, borderRadius: 6, borderWidth: 1, borderStyle: "solid", borderColor: "border.default", display: "flex" }}>
          <Textarea placeholder="O que você está criando?" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
          <Button onClick={handlePostSubmit} variant="primary">
            Postar
          </Button>
        </Stack>
      )}

      {/* Demo posts */}
      {posts.map((post) => (
        <Stack
          key={post.id}
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
          <Stack direction="horizontal" gap={2} sx={{ display: "flex", alignItems: "center" }}>
            <Avatar />
            <Text fontWeight="bold">{post.author}</Text>
          </Stack>
          <Text>{post.content}</Text>
          {/* Interaction buttons */}
          <Stack direction="horizontal" gap={2} sx={{ mt: 2 }}>
            <Button variant="invisible" sx={{ "&:hover": { textDecoration: "underline" } }}>
              Curtir
            </Button>
            <Button variant="invisible" sx={{ "&:hover": { textDecoration: "underline" } }}>
              Comentar
            </Button>
            <Button variant="invisible" sx={{ "&:hover": { textDecoration: "underline" } }}>
              Compartilhar
            </Button>
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}
