import Head from "next/head";
import Link from "next/link";
import HorizontalCardComponent from "@/components/Card/HorizontalCardComponent";
import CarouselComponent from "@/components/Carousel/CarouselComponent";
import styles from "./index.module.css";
import VerticalCardComponent from "@/components/Card/VerticalCardComponent";
import MetricCard from "@/components/Card/MetricCard";
import { PeopleIcon, StarIcon, PeopleIcon as TeamIcon, TagIcon, VideoIcon } from "@primer/octicons-react";
import { useEffect, useState } from "react";
import TyperwriterComponent from "@/components/TypeWriter/TyperwriterComponent";
import { SITE_URL, SITE_NAME, SITE_LOCALE, DEFAULT_OG_IMAGE, TWITTER_HANDLE } from "@/lib/seo";

const PAGE_TITLE = "Indies Brasil — Rede Social de Desenvolvedores Indie Brasileiros";
const PAGE_DESCRIPTION =
  "Conecte-se com desenvolvedores, artistas e gamers da cena indie do Brasil. Portfólio profissional, feed social, sistema de tags e ferramentas para criadores de jogos.";
const PAGE_URL = SITE_URL;

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: PAGE_DESCRIPTION,
      inLanguage: "pt-BR",
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/membros?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "SocialNetworkingApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description: PAGE_DESCRIPTION,
      inLanguage: "pt-BR",
      offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
      audience: { "@type": "Audience", geographicArea: { "@type": "Country", name: "Brasil" } },
    },
  ],
};

const FEATURES = [
  {
    icon: "🎮",
    title: "Portfólio Profissional",
    desc: "Monte um perfil completo com seus projetos, habilidades e histórico de atuação na indústria.",
  },
  {
    icon: "🤝",
    title: "Rede de Talentos",
    desc: "Conecte-se com devs, artistas, músicos e designers que constroem jogos independentes.",
  },
  {
    icon: "📢",
    title: "Feed Social",
    desc: "Compartilhe atualizações de projetos, conquistas e conteúdo com toda a comunidade.",
  },
  {
    icon: "🏷️",
    title: "Sistema de Tags",
    desc: "Descubra e acompanhe tópicos em alta como #GameDev, #PixelArt e #IndieGame.",
  },
  {
    icon: "🎬",
    title: "Embeds Multimídia",
    desc: "Incorpore vídeos do YouTube, lives da Twitch, widgets da Steam e posts do Instagram.",
  },
  {
    icon: "💬",
    title: "Comunidade Ativa",
    desc: "Participe de discussões, dê feedback em projetos e colabore com outros criadores.",
  },
];

function Home() {
  const frases = ["Gamers.", "Programadores.", "Roteiristas.", "Animadores.", "Produtores.", "Ilustradores.", "Designers.", "Artistas."];
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    async function getSummary() {
      try {
        const response = await fetch("/api/v1/status/summary", {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) return;

        const data = await response.json();
        setSummary(data);
      } catch (error) {
        console.error("Erro ao buscar summary:", error);
      }
    }
    getSummary();
  }, []);

  return (
    <main className={styles.page}>
      <Head>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_DESCRIPTION} />
        <meta name="keywords" content="jogos indie brasil, desenvolvedores indie brasileiros, rede social gamedev, game development brasil, indie game community, comunidade jogos independentes, gamedev br" />
        <link rel="canonical" href={PAGE_URL} />
        <meta name="robots" content="index, follow" />
        <meta httpEquiv="content-language" content="pt-BR" />
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={PAGE_URL} />
        <meta property="og:title" content={PAGE_TITLE} />
        <meta property="og:description" content={PAGE_DESCRIPTION} />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta property="og:locale" content={SITE_LOCALE} />
        <meta property="og:site_name" content={SITE_NAME} />
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content={TWITTER_HANDLE} />
        <meta name="twitter:title" content={PAGE_TITLE} />
        <meta name="twitter:description" content={PAGE_DESCRIPTION} />
        <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
        {/* JSON-LD */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      </Head>

      {/* HERO */}
      <section className={styles.hero}>
        <span className={styles.heroBadge}>🎮 A comunidade indie do Brasil</span>

        <h1 className={styles.heroHeading}>
          Bem-vindo. <TyperwriterComponent initText="Somos" frases={frases} />
        </h1>

        <p className={styles.heroSub}>
          Conecte-se com desenvolvedores, artistas, gamers e criadores que constroem o futuro dos jogos independentes no Brasil.
        </p>

        <div className={styles.heroCta}>
          <Link href="/cadastro" className={styles.ctaPrimary}>
            Criar conta grátis
          </Link>
          <Link href="/posts" className={styles.ctaSecondary}>
            Explorar comunidade →
          </Link>
        </div>

        <div className={styles.metrics}>
          <MetricCard
            title="Usuarios"
            period="Desde o inicio"
            value={summary ? summary.user_accounts : "..."}
            previousLabel="Ultimos 30 dias"
            previousValue="1"
            icon={<PeopleIcon />}
          />
          <MetricCard
            title="Posts"
            period="30 dias"
            value={summary ? summary.posts : "..."}
            previousLabel="Periodo Anterior"
            previousValue={summary ? summary.previous_posts : "..."}
            icon={<StarIcon />}
          />
          <MetricCard title="Eventos" period="Proximos 30 dias" value="..." icon={<TeamIcon />} />
          <MetricCard title="Estudios" period="Total" value="..." icon={<TagIcon />} />
          <MetricCard title="Jogos" period="Total" value="..." previousLabel="Em Desenvolvimento" previousValue="..." icon={<VideoIcon />} />
        </div>
      </section>

      {/* FEATURES STRIP */}
      <section className={styles.featuresStrip}>
        <p className={styles.sectionLabel}>Plataforma</p>
        <h2 className={styles.sectionTitle}>Tudo que você precisa, num só lugar</h2>
        <p className={styles.sectionSub}>Ferramentas pensadas para profissionais e entusiastas da indústria indie brasileira.</p>

        <div className={styles.featureGrid}>
          {FEATURES.map((feature) => (
            <div key={feature.title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{feature.icon}</div>
              <p className={styles.featureTitle}>{feature.title}</p>
              <p className={styles.featureDesc}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMUNIDADE */}
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>Comunidade</p>
          <h2 className={styles.sectionTitle}>Junte-se ao grupo</h2>
        </header>
        <HorizontalCardComponent
          image="/images/IndiesWhatsApp.jpeg"
          alt="Qr Code Convite Grupo WhatsApp"
          title="Conheça nossa comunidade"
          description="Grupo focado em desenvolvedores independentes de jogos brasileiros. Compartilhamos dicas, recursos, oportunidades e apoio para fomentar a indústria nacional."
        />
      </section>

      {/* INTEGRAÇÕES */}
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>Integrações</p>
          <h2 className={styles.sectionTitle}>YouTube, Twitch, Instagram e Steam</h2>
          <p className={styles.sectionSub}>
            Incorpore vídeos, lives e posts diretamente nas publicações para compartilhar conteúdo multimídia com a comunidade.
          </p>
        </header>

        <CarouselComponent
          cards={[
            { content: "Instagram Imagem", image_src: "/images/instagram_image.png" },
            { content: "Instagram Vídeo", image_src: "/images/instagram_video.png" },
            { content: "Steam Widget", image_src: "/images/steam_widget.png" },
            { content: "Canal Twitch", image_src: "/images/twitch_channel.png" },
            { content: "YouTube Shorts", image_src: "/images/youtube_shorts.png" },
            { content: "YouTube Vídeo", image_src: "/images/youtube_video.png" },
          ]}
        />
      </section>

      {/* TAGS */}
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>Descoberta</p>
          <h2 className={styles.sectionTitle}>Sistema de Tags</h2>
          <p className={styles.sectionSub}>Tags para identificar o assunto ou uma trending do post.</p>
        </header>
        <VerticalCardComponent
          image="/images/sistematags.png"
          alt="ranqueamento Tags"
          title="Tags"
          description="Ranqueamento e localização de posts através de tags que auxiliam a classificação do assunto, podendo iniciar uma trend ou uma conversa."
        />
      </section>
    </main>
  );
}

export default Home;
