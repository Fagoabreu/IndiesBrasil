import { useEffect, useState } from "react";
import CreatePost from "@/components/CreatePost";
import PostCard from "@/components/PostCard";
import WhoToFollow from "@/components/WhoToFollow";
import { useUser } from "@/context/UserContext";

// Função para buscar posts da API
async function fetchPosts() {
  const res = await fetch("/api/v1/posts", {
    method: "GET",
    credentials: "include", // envia cookies
  });
  if (!res.ok) throw new Error("Erro ao carregar posts");
  return res.json();
}

// Função para buscar ID do usuário logado (do cookie)
async function fetchDbUserId() {
  const res = await fetch("/api/v1/user", { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.id || null;
}

export default function PostsPage() {
  const { user, loadingUser } = useUser();
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [dbUserId, setDbUserId] = useState(null);

  // Carrega posts e ID do usuário
  useEffect(() => {
    async function loadData() {
      setLoadingPosts(true);
      try {
        const [fetchedPosts, fetchedUserId] = await Promise.all([fetchPosts(), fetchDbUserId()]);
        setPosts(fetchedPosts || []);
        setDbUserId(fetchedUserId);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingPosts(false);
      }
    }
    loadData();
  }, []);

  // Adiciona post localmente ao criar
  const handleAddPost = (content) => {
    const newPost = {
      id: posts.length + 1,
      author: {
        id: dbUserId,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl || "/avatar.png",
      },
      content,
      createdAt: new Date().toISOString(),
      likesCount: 0,
      likedByUser: false,
      commentsCount: 0,
    };
    setPosts([newPost, ...posts]);
  };

  // Deleta post localmente
  const handleDeletePost = (postId) => {
    setPosts(posts.filter((p) => p.id !== postId));
  };

  if (loadingUser || loadingPosts) {
    return <div style={{ padding: 32 }}>Carregando...</div>;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 24,
        maxWidth: 1200,
        margin: "0 auto",
        padding: 16,
      }}
    >
      {/* Coluna principal */}
      <div style={{ gridColumn: "1 / -1" }}>
        {user && <CreatePost user={user} onPost={handleAddPost} />}

        {posts.map((post) => (
          <PostCard key={post.id} post={post} dbUserId={dbUserId} onDelete={handleDeletePost} />
        ))}
      </div>

      {/* Sugestões de quem seguir */}
      <div style={{ display: "none" /* ajuste para desktop com media query */ }}>
        <WhoToFollow />
      </div>
    </div>
  );
}
