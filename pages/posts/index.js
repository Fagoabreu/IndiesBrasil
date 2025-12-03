import { useEffect, useState } from "react";
import CreatePost from "@/components/CreatePost";
import PostCardComponent from "@/components/PostCardComponent";
import { useUser } from "@/context/UserContext";

// fetchPosts e fetchDbUserId como antes

export default function PostsPage() {
  const { user, loadingUser } = useUser();
  const [posts, setPosts] = useState([]);
  const [dbUserId, setDbUserId] = useState(null);
  const [loadingPosts, setLoadingPosts] = useState(true);

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

  // POST /api/v1/posts
  const handleAddPost = async (content, imgUrl = null) => {
    try {
      const response = await fetch("/api/v1/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          author_username: user.username,
          content,
          img_url: imgUrl,
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
        <PostCardComponent key={post.id} post={post} dbUserId={dbUserId} onDelete={handleDeletePost} />
      ))}
    </>
  );
}
