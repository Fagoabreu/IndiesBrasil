import SeoHead from "@/components/SeoHead";
import Image from "next/image";
import Link from "next/link";
import HorizontalCardComponent from "@/components/Card/HorizontalCardComponent";
import CarouselComponent from "@/components/Carousel/CarouselComponent";
import styles from "./index.module.css";
import VerticalCardComponent from "@/components/Card/VerticalCardComponent";
import MetricCard from "@/components/Card/MetricCard";
import HighlightCard from "@/components/HighlightCard/HighlightCard";
import { PeopleIcon, StarIcon, PeopleIcon as TeamIcon, TagIcon, VideoIcon } from "@primer/octicons-react";
import { useEffect, useState } from "react";
import TyperwriterComponent from "@/components/TypeWriter/TyperwriterComponent";
import { SITE_URL, SITE_NAME } from "@/lib/seo";
import useInView from "@/hooks/useInView";

const PAGE_TITLE = "Indies Brasil — Rede Social de Desenvolvedores Indie Brasileiros";
const PAGE_DESCRIPTION = "Conecte-se com desenvolvedores, artistas e gamers, no coop chegaremos mais longe.";
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

function SectionReveal({ children, className = "", as: Tag = "section", ...props }) {
  const [ref, isVisible] = useInView({ threshold: 0.08 });
  return (
    <Tag ref={ref} className={`${styles.reveal} ${isVisible ? styles.revealVisible : ""} ${className}`} {...props}>
      {children}
    </Tag>
  );
}

function Home() {
  const frases = [
    "Gamers.",
    "Programadores.",
    "Roteiristas.",
    "Animadores.",
    "Produtores.",
    "Ilustradores.",
    "Designers.",
    "Streamers.",
    "Artistas.",
  ];
  const [summary, setSummary] = useState(null);
  const [highlights, setHighlights] = useState([]);

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

    async function getHighlights() {
      try {
        const response = await fetch("/api/v1/highlights", {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          setHighlights(await response.json());
        }
      } catch (error) {
        console.error("Erro ao buscar highlights:", error);
      }
    }

    getSummary();
    getHighlights();
  }, []);

  return (
    <main className={styles.page}>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} jsonLd={JSON_LD} />

      {/* ════════════════════════════════════
          HERO — Primeira impressão
      ════════════════════════════════════ */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroContent}>
            <span className={styles.heroBadge}>🎮 A comunidade indie do Brasil</span>

            <h1 className={styles.heroHeading}>
              Bem-vindo.
              <br /> <TyperwriterComponent initText="Somos" frases={frases} />
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
          </div>

          {/* Card promocional — ao lado do hero */}
          <div className={styles.heroPromo}>
            <Link href="/cadastro" className={styles.promoCard}>
              <Image src="/images/ArteSite.png" alt="Junte-se à comunidade Indies Brasil" className={styles.promoImage} width={400} height={300} />
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          MÉTRICAS — Prova social
      ════════════════════════════════════ */}
      <SectionReveal className={styles.metricsSection}>
        <div className={styles.metrics}>
          <MetricCard
            title="Usuários"
            period="Desde o início"
            value={summary ? summary.user_accounts : "..."}
            previousLabel="Últimos 30 dias"
            previousValue={summary ? summary.new_user_accounts : "..."}
            icon={<PeopleIcon />}
          />
          <MetricCard
            title="Posts"
            period="30 dias"
            value={summary ? summary.new_posts : "..."}
            previousLabel="Período Anterior"
            previousValue={summary ? summary.previous_posts : "..."}
            icon={<StarIcon />}
          />
          <MetricCard
            title="Eventos"
            period="Próximos 30 dias"
            value={summary ? summary.events : "..."}
            previousLabel="Período Anterior"
            previousValue={summary ? summary.previous_events : "..."}
            icon={<TeamIcon />}
          />
          <MetricCard
            title="Estúdios"
            period="Total"
            value={summary ? summary.organizations : "..."}
            previousLabel="Novos nos últimos 30 dias"
            previousValue={summary ? summary.new_organizations : "..."}
            icon={<TagIcon />}
          />
          <MetricCard title="Jogos" period="Total" value="..." previousLabel="Em Desenvolvimento" previousValue="..." icon={<VideoIcon />} />
        </div>
      </SectionReveal>

      {/* ════════════════════════════════════
          HIGHLIGHTS — Conteúdo em destaque
      ════════════════════════════════════ */}
      {highlights.length > 0 && (
        <SectionReveal className={styles.section}>
          <header className={styles.sectionHeader}>
            <p className={styles.sectionLabel}>Destaques</p>
            <h2 className={styles.sectionTitle}>Conteúdos dos Estúdios</h2>
            <p className={styles.sectionSub}>Jogos, boardgames e publicações em destaque dos estúdios brasileiros.</p>
          </header>
          <div className={styles.highlightGrid}>
            {highlights.map((item) => (
              <HighlightCard key={`${item.type}-${item.slug}`} item={item} />
            ))}
          </div>
        </SectionReveal>
      )}

      {/* ════════════════════════════════════
          FEATURES — O que a plataforma oferece
      ════════════════════════════════════ */}
      <SectionReveal className={styles.section}>
        <header className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>Plataforma</p>
          <h2 className={styles.sectionTitle}>Tudo que você precisa, num só lugar</h2>
          <p className={styles.sectionSub}>Ferramentas pensadas para profissionais e entusiastas da indústria indie brasileira.</p>
        </header>

        <div className={styles.featureGrid}>
          {FEATURES.map((feature) => (
            <div key={feature.title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{feature.icon}</div>
              <p className={styles.featureTitle}>{feature.title}</p>
              <p className={styles.featureDesc}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </SectionReveal>

      {/* ════════════════════════════════════
          INTEGRAÇÕES — YouTube, Twitch, Steam, Instagram
      ════════════════════════════════════ */}
      <SectionReveal className={styles.section}>
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
      </SectionReveal>

      {/* ════════════════════════════════════
          TAGS — Descoberta de conteúdo
      ════════════════════════════════════ */}
      <SectionReveal className={styles.section}>
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
      </SectionReveal>

      {/* ════════════════════════════════════
          COMUNIDADE — Chamada para ação final
      ════════════════════════════════════ */}
      <SectionReveal className={styles.section}>
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
      </SectionReveal>
    </main>
  );
}

export default Home;
