import { useEffect, useState, useCallback } from "react";
import { Heading } from "@primer/react";
import { useUser } from "@/context/UserContext";
import PostCardComponent from "@/components/PostCard/PostCardComponent";
import CreatePost from "@/components/CreatePost/CreatePost";

import "./PostsPage.css";
import PostLeftBarComponent from "@/components/LeftBar/PostLeftBarComponent";
import { useRouter } from "next/router";

export default function PostsPage() {
  const router = useRouter();
  const { user, loadingUser } = useUser();
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [tab, setTab] = useState("all");
  const [activeTag, setActiveTag] = useState();

  useEffect(() => {
    if (!router.isReady) return;

    if (router.query.tag) {
      setActiveTag(router.query.tag);
      setTab("tag");
    }
  }, [router.isReady, router.query.tag]);

  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);

    try {
      let endpoint;
      if (tab === "following") {
        endpoint = "/api/v1/posts?search_type=following";
      } else if (tab === "tag") {
        endpoint = `/api/v1/posts?search_type=tag&tag=${activeTag}`;
      } else {
        endpoint = "/api/v1/posts";
      }

      const response = await fetch(endpoint, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) return;

      const data = await response.json();
      setPosts(data || []);
    } finally {
      setLoadingPosts(false);
    }
  }, [tab, activeTag]);

  useEffect(() => {
    if (!loadingUser) {
      fetchPosts();
    }
  }, [fetchPosts, loadingUser]);

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

      // Só injeta no feed se estiver na aba "Todos"
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
      {/* HEADER DO FEED */}
      <div className="social-feed-header">
        <Heading as="h4">Posts</Heading>

        <div className="feed-tabs">
          <button type="button" className={`feed-tab ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>
            Todos
          </button>
          {user && (
            <button type="button" className={`feed-tab ${tab === "following" ? "active" : ""}`} onClick={() => setTab("following")}>
              Seguindo
            </button>
          )}

          {activeTag && (
            <button type="button" className={`feed-tab ${tab === "tag" ? "active" : ""}`} onClick={() => setTab("tag")}>
              #{activeTag}
            </button>
          )}
        </div>
      </div>

      {/* CREATE POST */}
      {user && tab === "all" && (
        <div className="social-feed-create">
          <CreatePost user={user} onPost={handleAddPost} />
        </div>
      )}

      {/* FEED */}
      {posts.map((post) => (
        <PostCardComponent
          key={post.id}
          post={post}
          onDelete={handleDeletePost}
          canInteract={user}
          onTagClick={(tag) => {
            setActiveTag(tag);
            setTab("tag");
            router.push(
              {
                pathname: router.pathname,
                query: { tag },
              },
              undefined,
              { shallow: true },
            );
          }}
        />
      ))}
    </>
  );
}

// Sidebar
PostsPage.RightSidebar = <PostLeftBarComponent />;
