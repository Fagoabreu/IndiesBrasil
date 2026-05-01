import SeoHead from "@/components/SeoHead";
import { useEffect, useState, useCallback } from "react";
import { Heading } from "@primer/react";
import { useUser } from "@/context/UserContext";
import PostCardComponent from "@/components/PostCard/PostCardComponent";
import CreatePost from "@/components/CreatePost/CreatePost";

import "./PostsPage.css";
import PostRightBarComponent from "@/components/RightBar/PostRightBarComponent";
import { useRouter } from "next/router";
import { SITE_URL } from "@/lib/seo";

const PAGE_TITLE = "Feed da Comunidade Indie | Indies Brasil";
const PAGE_DESCRIPTION = "Acompanhe posts e atualizações de desenvolvedores, artistas e criadores de jogos independentes brasileiros. Compartilhe projetos, conquistas e conteúdo.";
const PAGE_URL = `${SITE_URL}/posts`;

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
    return (
      <div className="posts-page">
        <div className="posts-loading" role="status" aria-live="polite">
          Carregando posts...
        </div>
      </div>
    );
  }

  return (
    <div className="posts-page">
      <SeoHead
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        canonical={PAGE_URL}
      />

      {/* HEADER DO FEED */}
      <div className="social-feed-header">
        <div className="feed-title-block">
          <Heading as="h2">Posts</Heading>
          <p className="feed-subtitle">Acompanhe a comunidade e compartilhe atualizacoes com seu feed.</p>
        </div>

        <div className="feed-tabs" role="tablist" aria-label="Filtros de posts">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "all"}
            className={`feed-tab ${tab === "all" ? "active" : ""}`}
            onClick={() => setTab("all")}
          >
            Todos
          </button>
          {user && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === "following"}
              className={`feed-tab ${tab === "following" ? "active" : ""}`}
              onClick={() => setTab("following")}
            >
              Seguindo
            </button>
          )}

          {activeTag && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === "tag"}
              className={`feed-tab ${tab === "tag" ? "active" : ""}`}
              onClick={() => setTab("tag")}
            >
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
      {posts.length === 0 ? (
        <div className="posts-empty" role="status" aria-live="polite">
          <p className="posts-empty-title">Nenhum post encontrado</p>
          <p className="posts-empty-description">Tente trocar o filtro ou volte mais tarde para ver novas publicacoes.</p>
        </div>
      ) : (
        posts.map((post) => (
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
        ))
      )}
    </div>
  );
}

// Sidebar
PostsPage.RightSidebar = <PostRightBarComponent />;
