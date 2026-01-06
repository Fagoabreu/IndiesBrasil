import { useEffect, useState, useCallback } from "react";
import { useUser } from "@/context/UserContext";
import WhoToFollow from "@/components/WhoToFollow";
import PostCardComponent from "@/components/PostCard/PostCardComponent";
import CreatePost from "@/components/CreatePost/CreatePost";
import { SegmentedControl } from "@primer/react";

export default function PostsPage() {
  const { user, loadingUser } = useUser();
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [tab, setTab] = useState("all");

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
    const endpoint = tab === "following" ? "/api/v1/posts/following" : "/api/v1/posts";

    const response = await fetch(endpoint, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) return;

    const data = await response.json();
    setPosts(data || []);
  }

  // Recarrega posts ao trocar de aba
  useEffect(() => {
    if (!loadingUser) {
      fetchPosts();
    }
  }, [tab, loadingUser]);

  // POST /api/v1/posts
  const handleAddPost = async (content, file = null) => {
    try {
      const formData = new FormData();
      formData.append("content", content);

      if (file) {
        formData.append("file", file);
      }

      const response = await fetch("/api/v1/posts", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) return;

      const createdPost = await response.json();

      if (tab === "all") {
        setPosts((prev) => [createdPost, ...prev]);
      }
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

      if (!response.ok) return;

      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (error) {
      console.error("Erro ao deletar:", error);
    }
  };

  if (loadingUser || loadingPosts) {
    return <div className="posts-loading">Carregando...</div>;
  }

  return (
    <>
      <div className="posts-tabs">
        <SegmentedControl value={tab} onChange={setTab} aria-label="Filtro de posts">
          <SegmentedControl.Item value="all">Todos</SegmentedControl.Item>

          <SegmentedControl.Item value="following">Seguindo</SegmentedControl.Item>
        </SegmentedControl>
      </div>

      {user && tab === "all" && <CreatePost user={user} onPost={handleAddPost} />}

      {posts.map((post) => (
        <PostCardComponent key={post.id} post={post} onDelete={handleDeletePost} canInteract={user} />
      ))}
    </>
  );
}

// 👉 Sidebar da página
PostsPage.RightSidebar = <WhoToFollow />;
