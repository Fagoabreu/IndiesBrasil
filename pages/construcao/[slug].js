import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeftIcon, ToolsIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { SITE_URL } from "@/lib/seo";

const LABELS = {
  noticias: "Notícias",
  avaliacoes: "Avaliações",
  estudo: "Estudo",
  ajuda: "Ajuda Comunidade",
  suporte: "Suporte ao Site",
};

export default function EmConstrucao() {
  const router = useRouter();
  const { slug } = router.query;
  const label = LABELS[slug] || slug || "Página";

  return (
    <div
      className="construcao-page"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 20px",
        textAlign: "center",
        gap: 16,
      }}
    >
      <SeoHead title={`${label} — Em Construção`} canonical={`${SITE_URL}/construcao/${slug}`} noindex />

      <div style={{ color: "var(--fgColor-muted)", opacity: 0.5 }}>
        <ToolsIcon size={48} />
      </div>

      <h1
        style={{
          fontSize: "1.4rem",
          fontWeight: 700,
          margin: 0,
          color: "var(--fgColor-default)",
        }}
      >
        {label}
      </h1>

      <p
        style={{
          fontSize: "0.95rem",
          color: "var(--fgColor-muted)",
          maxWidth: 400,
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        Esta página está em construção. Em breve você poderá acessar todo o conteúdo de {label.toLowerCase()} aqui. Fique de olho nas novidades!
      </p>

      <Link
        href="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginTop: 12,
          padding: "8px 20px",
          borderRadius: 6,
          background: "var(--brand-primary)",
          color: "#fff",
          fontSize: "0.875rem",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        <ArrowLeftIcon size={14} />
        Voltar para Home
      </Link>
    </div>
  );
}
