import { useEffect, useState, useCallback } from "react";
import { useUser } from "@/context/UserContext";
import WhoToFollow from "@/components/WhoToFollow";
import PostCardComponent from "@/components/PostCard/PostCardComponent";
import CreatePost from "@/components/CreatePost/CreatePost";

export default function PostsPage() {
  const { user, loadingUser } = useUser();
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const loadData = useCallback(async () => {
    setLoadingPosts(true);
    try {
      await fetchPosts();
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // GET /api/v1/posts
  async function fetchPosts() {
    const response = await fetch("/api/v1/posts", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) return;
    const data = await response.json();
    setPosts(data || []);
  }

  // POST /api/v1/posts
  const handleAddPost = async (content, imgUrl = null) => {
    try {
      const response = await fetch("/api/v1/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content,
          img: imgUrl,
        }),
      });

      if (!response.ok) {
        console.error("Erro ao criar post");
        return;
      }

      const createdPost = await response.json();
      setPosts((prev) => [createdPost, ...prev]);
    } catch (error) {
      console.error("Erro ao criar post:", error);
    }
  };

  // DELETE /api/v1/posts/:id
  const handleDeletePost = async (postId) => {
    try {
      const response = await fetch(`/api/v1/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        console.error("Erro ao deletar post");
        return;
      }

      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (error) {
      console.error("Erro ao deletar:", error);
    }
  };

  if (loadingUser || loadingPosts) return <div style={{ padding: 32 }}>Carregando...</div>;

  return (
    <>
      {user && <CreatePost user={user} onPost={handleAddPost} />}

      {posts.map((post) => (
        <PostCardComponent key={post.id} post={post} onDelete={handleDeletePost} canInteract={user} />
      ))}
    </>
  );
}

// 👉 Sidebar da página
PostsPage.RightSidebar = <WhoToFollow />;
