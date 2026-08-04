import React, { useEffect, useState, useCallback, useRef } from "react";
import SeoHead from "@/components/SeoHead";
import { Heading } from "@primer/react";
import { useUser } from "@/context/UserContext";
import PostCardComponent from "@/components/PostCard/PostCardComponent";
import CreatePost from "@/components/CreatePost/CreatePost";

import "./PostsPage.css";
import PostRightBarComponent from "@/components/RightBar/PostRightBarComponent";
import TrendingTags from "@/components/TrendingTags/TrendingTagsComponent";
import WhoToFollow from "@/components/WhoToFollow/WhoToFollow";
import { useRouter } from "next/router";
import { SITE_URL } from "@/lib/seo";
import useInView from "@/hooks/useInView";

const PAGE_TITLE = "Feed da Comunidade Indie | Indies Brasil";
const PAGE_DESCRIPTION =
  "Acompanhe posts e atualizações de desenvolvedores, artistas e criadores de jogos independentes brasileiros. Compartilhe projetos, conquistas e conteúdo.";
const PAGE_URL = `${SITE_URL}/posts`;

const PAGE_SIZE = 20;

export default function PostsPage() {
  const router = useRouter();
  const { user, loadingUser } = useUser();
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tab, setTab] = useState("all");
  const [activeTag, setActiveTag] = useState();
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef(null);
  const loadingMoreRef = useRef(false);

  // Sentinel para infinite scroll
  const [sentinelRef, isSentinelVisible] = useInView({
    threshold: 0,
    rootMargin: "0px 0px 200px 0px",
  });

  useEffect(() => {
    if (!router.isReady) return;

    if (router.query.tag) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTag(router.query.tag);
      setTab("tag");
    }
  }, [router.isReady, router.query.tag]);

  // Monta a URL base conforme tab ativa
  function buildUrl(cursor) {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    if (cursor) params.set("cursor", cursor);

    if (tab === "following") {
      params.set("search_type", "following");
    } else if (tab === "tag" && activeTag) {
      params.set("search_type", "tag");
      params.set("tag", activeTag);
    }

    return `/api/v1/posts?${params.toString()}`;
  }

  // Fetch inicial — reseta o feed
  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);
    setHasMore(true);
    cursorRef.current = null;

    try {
      const response = await fetch(buildUrl(null), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) return;

      const data = await response.json();
      const list = data || [];
      setPosts(list);

      if (list.length > 0) {
        cursorRef.current = list[list.length - 1].created_at;
      }
      setHasMore(list.length >= PAGE_SIZE);
    } finally {
      setLoadingPosts(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buildUrl é derivado de tab/activeTag
  }, [tab, activeTag]);

  // Fetch da próxima página — appended ao feed
  const fetchMorePosts = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || !cursorRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const response = await fetch(buildUrl(cursorRef.current), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) return;

      const data = await response.json();
      const list = data || [];

      if (list.length > 0) {
        cursorRef.current = list[list.length - 1].created_at;
        setPosts((prev) => [...prev, ...list]);
      }
      setHasMore(list.length >= PAGE_SIZE);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buildUrl é derivado de tab/activeTag
  }, [hasMore, tab, activeTag]);

  // Carrega primeira página quando tab/user muda
  useEffect(() => {
    if (!loadingUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchPosts();
    }
  }, [fetchPosts, loadingUser]);

  // Infinite scroll: dispara quando o sentinel fica visível
  useEffect(() => {
    if (isSentinelVisible && hasMore && !loadingPosts && !loadingMoreRef.current) {
      fetchMorePosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchMorePosts/loadingMoreRef estáveis; re-executar apenas quando visibilidade/cursor mudam
  }, [isSentinelVisible, hasMore, loadingPosts]);

  // POST /api/v1/posts
  const handleAddPost = async (content, file = null, existingFormData = null) => {
    try {
      const formData = existingFormData || new FormData();
      // Se não veio formData pré-preenchido (com poll), monta manualmente
      if (!existingFormData) {
        formData.append("content", content);
        if (file) formData.append("file", file);
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
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} />

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
        <>
          {posts.map((post, index) => (
            <React.Fragment key={post.id}>
              <PostCardComponent
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
              {/* Intercala widgets no feed — visíveis só no mobile (≤1280px) */}
              {index === 1 && (
                <aside className="posts-feed-widget">
                  <span className="posts-feed-widget-label">Assuntos do momento</span>
                  <TrendingTags />
                </aside>
              )}
              {index === 4 && (
                <aside className="posts-feed-widget">
                  <span className="posts-feed-widget-label">Sugestões para você</span>
                  <WhoToFollow />
                </aside>
              )}
            </React.Fragment>
          ))}

          {/* Loader da próxima página */}
          {loadingMore && (
            <div className="posts-loading-more" role="status" aria-live="polite">
              Carregando mais posts...
            </div>
          )}

          {/* Fim do feed */}
          {!hasMore && posts.length > 0 && <p className="posts-end-message">Você chegou ao fim do feed.</p>}
        </>
      )}

      {/* Sentinel para infinite scroll — sempre no DOM para o IntersectionObserver funcionar */}
      <div ref={sentinelRef} className="posts-sentinel" />
    </div>
  );
}

// Sidebar
PostsPage.RightSidebar = <PostRightBarComponent />;
