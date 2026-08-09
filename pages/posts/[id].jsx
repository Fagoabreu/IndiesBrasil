import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeftIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import PostCardComponent from "@/components/PostCard/PostCardComponent";
import { useUser } from "@/context/UserContext";
import { SITE_URL } from "@/lib/seo";

/**
 * getServerSideProps — busca os dados do post no servidor ANTES de enviar o HTML.
 *
 * Isto é essencial para o WhatsApp/Discord/redes sociais: os crawlers dessas
 * plataformas NÃO executam JavaScript. Eles leem o HTML bruto e extraem as
 * meta tags <og:title>, <og:description>, <og:image> diretamente.
 *
 * Sem SSR, o router.query.id é undefined no servidor → OG tags genéricas → sem preview.
 * Com SSR, o id vem de context.params → fetch no servidor → OG tags corretas no HTML.
 */
export async function getServerSideProps(context) {
  const { id } = context.params;

  try {
    // Fetch interno ao próprio servidor Next.js (localhost:3000).
    // NÃO usar a URL pública — de dentro do container Docker a requisição
    // externa pode falhar (hairpin NAT, DNS, firewall).
    const res = await fetch(`http://localhost:3000/api/v1/posts/${id}`);

    if (res.status === 404) {
      return {
        props: { initialPost: null, ssrNotFound: true, ssrError: false, postId: id },
      };
    }

    if (!res.ok) {
      return {
        props: { initialPost: null, ssrNotFound: false, ssrError: true, postId: id },
      };
    }

    const post = await res.json();
    return {
      props: {
        initialPost: post,
        ssrNotFound: false,
        ssrError: false,
        postId: id,
      },
    };
  } catch {
    return {
      props: { initialPost: null, ssrNotFound: false, ssrError: true, postId: id },
    };
  }
}

export default function PostDetailPage({ initialPost, ssrNotFound, ssrError, postId }) {
  const router = useRouter();
  const { user } = useUser();

  // Estado inicial já vem do servidor via getServerSideProps.
  // OG tags sempre usam dados reais — o HTML já chega pronto para o WhatsApp.
  const [post, setPost] = useState(initialPost);
  const [notFound, setNotFound] = useState(ssrNotFound);

  // ── OG tags: preenchidas com dados do SSR ──
  const seoTitle = post ? `@${post.author_username} no Indies Brasil` : "Post no Indies Brasil";
  const seoDescription = post?.content?.slice(0, 200) || "Veja este post na comunidade Indies Brasil.";
  const seoCanonical = `${SITE_URL}/posts/${postId}`;
  const seoImage = `${SITE_URL}/api/og/post/${postId}`;

  // Client-side fetch: apenas para usuários logados obterem dados personalizados
  // (liked_by_user, user_vote). O SSR já entregou os dados base + OG tags.
  // Roda em background, não bloqueia a renderização.
  useEffect(() => {
    if (!user || ssrNotFound || ssrError) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/v1/posts/${postId}`, {
          credentials: "include",
        });
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) return; // silencioso: SSR já tem os dados
        const data = await res.json();
        if (!cancelled) setPost(data);
      } catch {
        // Silencioso: dados do SSR continuam válidos
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [postId, user, ssrNotFound, ssrError]);

  // SSR não encontrou o post → 404 imediato (sem loading, sem fetch extra)
  if (notFound) {
    return (
      <div className="posts-page">
        <SeoHead
          title="Post não encontrado — Indies Brasil"
          description="Este post não foi encontrado no Indies Brasil."
          canonical={seoCanonical}
          ogImage={seoImage}
        />
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

  // Se SSR falhou e não temos post → erro
  if (ssrError && !post) {
    return (
      <div className="posts-page">
        <SeoHead title="Erro — Indies Brasil" description="Ocorreu um erro ao carregar este post." canonical={seoCanonical} ogImage={seoImage} />
        <div className="posts-empty">
          <p className="posts-empty-title">Erro ao carregar o post.</p>
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
      <SeoHead title={seoTitle} description={seoDescription} canonical={seoCanonical} ogImage={seoImage} />

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
