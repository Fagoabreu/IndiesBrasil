import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeftIcon } from "@primer/octicons-react";
import { Spinner } from "@primer/react";
import SeoHead from "@/components/SeoHead";
import PostCardComponent from "@/components/PostCard/PostCardComponent";
import { useUser } from "@/context/UserContext";
import { SITE_URL } from "@/lib/seo";

export default function PostDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoading(true);
      setNotFound(false);
      setError(null);
      try {
        const res = await fetch(`/api/v1/posts/${id}`, {
          credentials: "include",
        });
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setError("Erro ao carregar o post.");
          return;
        }
        const data = await res.json();
        setPost(data);
      } catch {
        setError("Erro de conexão.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="posts-page" style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
        <Spinner size="large" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="posts-page">
        <div className="posts-empty">
          <p className="posts-empty-title">Post não encontrado</p>
          <p className="posts-empty-description">
            <Link href="/posts" style={{ color: "var(--brand-primary)" }}>
              ← Voltar para o feed
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="posts-page">
        <div className="posts-empty">
          <p className="posts-empty-title">{error}</p>
          <p className="posts-empty-description">
            <Link href="/posts" style={{ color: "var(--brand-primary)" }}>
              ← Voltar para o feed
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="posts-page">
      <SeoHead
        title={`Post de ${post.username} — Indies Brasil`}
        description={post.content?.slice(0, 160) || "Veja este post na comunidade Indies Brasil."}
        canonical={`${SITE_URL}/posts/${id}`}
      />

      <div style={{ marginBottom: 12 }}>
        <Link
          href="/posts"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: "0.85rem",
            color: "var(--fgColor-muted)",
            textDecoration: "none",
          }}
        >
          <ArrowLeftIcon size={14} /> Voltar ao feed
        </Link>
      </div>

      <PostCardComponent key={post.id} post={post} canInteract={!!user} onDelete={() => router.push("/posts")} />
    </div>
  );
}
