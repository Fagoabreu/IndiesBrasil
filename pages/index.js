import SeoHead from "@/components/SeoHead";
import Image from "next/image";
import Link from "next/link";
import CarouselComponent from "@/components/Carousel/CarouselComponent";
import styles from "./index.module.css";
import VerticalCardComponent from "@/components/Card/VerticalCardComponent";
import MetricCard from "@/components/Card/MetricCard";
import HighlightCard from "@/components/HighlightCard/HighlightCard";
import TestimonialsSection from "@/components/Landing/TestimonialsSection";
import { MilestoneIcon, OrganizationIcon, PeopleIcon, StarIcon, VideoIcon } from "@primer/octicons-react";
import { useEffect, useState } from "react";
import TyperwriterComponent from "@/components/TypeWriter/TyperwriterComponent";
import { useUser } from "@/context/UserContext";
import { SITE_URL, SITE_NAME } from "@/lib/seo";
import useInView from "@/hooks/useInView";

const PAGE_TITLE = "Indies Brasil — A casa dos jogos independentes brasileiros";
const PAGE_DESCRIPTION =
  "Conecte-se com desenvolvedores, artistas e gamers que constroem o futuro dos jogos independentes no Brasil. Portfólio, estúdios, catálogos e comunidade em um só lugar.";
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
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/membros?q={search_term_string}`,
        },
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
      audience: {
        "@type": "Audience",
        geographicArea: { "@type": "Country", name: "Brasil" },
      },
    },
  ],
};

const FRASES = ["Gamers.", "Programadores.", "Roteiristas.", "Animadores.", "Produtores.", "Ilustradores.", "Designers.", "Streamers.", "Artistas."];

const AUDIENCES = [
  {
    icon: "🎨",
    title: "Para criadores",
    desc: "Monte um portfólio profissional, forme um estúdio, publique seus jogos e encontre parceiros de projeto.",
  },
  {
    icon: "🎮",
    title: "Para gamers",
    desc: "Descubra jogos, boardgames e quadrinhos independentes feitos no Brasil e acompanhe seus estúdios favoritos.",
  },
  {
    icon: "📰",
    title: "Para mídia e negócios",
    desc: "Encontre pautas, press kits prontos e estúdios para cobrir, publicar, investir ou fechar parcerias.",
  },
];

const STEPS = [
  {
    icon: "🧭",
    title: "Crie seu perfil",
    desc: "Conte quem você é, o que faz e o que procura na indústria.",
  },
  {
    icon: "🚀",
    title: "Publique seu trabalho",
    desc: "Divulgue projetos, portfólio, jogos e atualizações para a comunidade.",
  },
  {
    icon: "🤝",
    title: "Conecte-se e cresça",
    desc: "Encontre talentos, estúdios, gamers e oportunidades de negócio.",
  },
];

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
  const { user } = useUser();
  const isLoggedIn = Boolean(user?.id);
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
    <>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} jsonLd={JSON_LD} />

      {/* ════════════════════════════════════
          NAVEGAÇÃO
      ════════════════════════════════════ */}
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.navLogo}>
            <Image src="/images/logo.png" alt={`Logo ${SITE_NAME}`} width={32} height={32} unoptimized priority />
            <span className={styles.navBrand}>{SITE_NAME}</span>
          </Link>

          <nav className={styles.navLinks} aria-label="Navegação principal">
            <a href="#audiencias" className={styles.navLink}>
              Para quem é
            </a>
            <a href="#recursos" className={styles.navLink}>
              Recursos
            </a>
            <a href="#estudios" className={styles.navLink}>
              Estúdios
            </a>
            <a href="#comunidade" className={styles.navLink}>
              Comunidade
            </a>
          </nav>

          <div className={styles.navActions}>
            {isLoggedIn ? (
              <Link href="/posts" className={styles.navCta}>
                Ir para a comunidade
              </Link>
            ) : (
              <>
                <Link href="/login" className={styles.navLogin}>
                  Entrar
                </Link>
                <Link href="/cadastro" className={styles.navCta}>
                  Criar conta grátis
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className={styles.page}>
        {/* ════════════════════════════════════
            HERO — Primeira impressão
        ════════════════════════════════════ */}
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroContent}>
              <span className={styles.heroBadge}>🇧🇷 A casa dos jogos independentes brasileiros</span>

              <h1 className={styles.heroHeading}>
                Onde o talento indie
                <br />
                <span className={styles.heroAccent}>brasileiro</span> se encontra
              </h1>

              <p className={styles.heroTypeWriter}>
                Somos <TyperwriterComponent initText="" frases={FRASES} />
              </p>

              <p className={styles.heroSub}>
                Conecte-se com desenvolvedores, artistas e gamers que constroem o futuro dos jogos independentes no Brasil.
              </p>

              <div className={styles.heroCta}>
                {isLoggedIn ? (
                  <Link href="/posts" className={styles.ctaPrimary}>
                    Ir para a comunidade →
                  </Link>
                ) : (
                  <>
                    <Link href="/cadastro" className={styles.ctaPrimary}>
                      Criar conta grátis
                    </Link>
                    <Link href="/posts" className={styles.ctaSecondary}>
                      Explorar a comunidade →
                    </Link>
                  </>
                )}
              </div>

              {!isLoggedIn && (
                <p className={styles.heroMicrocopy}>✓ Grátis para sempre &nbsp;·&nbsp; ✓ Sem cartão de crédito &nbsp;·&nbsp; ✓ Feito no Brasil</p>
              )}
            </div>

            {/* Card promocional — ao lado do hero */}
            <div className={styles.heroPromo}>
              <Link href={isLoggedIn ? "/posts" : "/cadastro"} className={styles.promoCard}>
                <Image
                  src="/images/ArteSite.png"
                  alt="Junte-se à comunidade Indies Brasil"
                  className={styles.promoImage}
                  width={460}
                  height={345}
                  priority
                />
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
              icon={<MilestoneIcon />}
            />
            <MetricCard
              title="Estúdios"
              period="Total"
              value={summary ? summary.organizations : "..."}
              previousLabel="Novos nos últimos 30 dias"
              previousValue={summary ? summary.new_organizations : "..."}
              icon={<OrganizationIcon />}
            />
            <MetricCard title="Jogos" period="Total" value="..." previousLabel="Em Desenvolvimento" previousValue="..." icon={<VideoIcon />} />
          </div>
        </SectionReveal>

        {/* ════════════════════════════════════
            AUDIÊNCIAS
        ════════════════════════════════════ */}
        <SectionReveal id="audiencias" className={styles.section}>
          <header className={styles.sectionHeader}>
            <p className={styles.sectionLabel}>Para quem é</p>
            <h2 className={styles.sectionTitle}>Um ecossistema completo para a cena indie</h2>
            <p className={styles.sectionSub}>Da criação à descoberta — todo mundo tem um lugar na Indies Brasil.</p>
          </header>

          <div className={styles.audienceGrid}>
            {AUDIENCES.map((audience) => (
              <div key={audience.title} className={styles.audienceCard}>
                <span className={styles.audienceIcon}>{audience.icon}</span>
                <h3 className={styles.audienceTitle}>{audience.title}</h3>
                <p className={styles.audienceDesc}>{audience.desc}</p>
              </div>
            ))}
          </div>
        </SectionReveal>

        {/* ════════════════════════════════════
            COMO FUNCIONA
        ════════════════════════════════════ */}
        <SectionReveal className={styles.sectionAlt}>
          <header className={styles.sectionHeader}>
            <p className={styles.sectionLabel}>Como funciona</p>
            <h2 className={styles.sectionTitle}>Comece em três passos</h2>
          </header>

          <div className={styles.stepsGrid}>
            {STEPS.map((step, index) => (
              <div key={step.title} className={styles.stepCard}>
                <span className={styles.stepNumber}>{index + 1}</span>
                <span className={styles.stepIcon}>{step.icon}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </SectionReveal>

        {/* ════════════════════════════════════
            HIGHLIGHTS — Conteúdo em destaque
        ════════════════════════════════════ */}
        {highlights.length > 0 && (
          <SectionReveal className={styles.section}>
            <header className={styles.sectionHeader}>
              <p className={styles.sectionLabel}>Destaques</p>
              <h2 className={styles.sectionTitle}>O que a comunidade está criando</h2>
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
        <SectionReveal id="recursos" className={styles.section}>
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
            ESTÚDIOS & NEGÓCIOS
        ════════════════════════════════════ */}
        <SectionReveal id="estudios" className={styles.studioSection}>
          <div className={styles.studioCard}>
            <div className={styles.studioContent}>
              <p className={styles.sectionLabel}>Estúdios &amp; Negócios</p>
              <h2 className={styles.sectionTitle}>Sua vitrine para o mundo</h2>
              <p className={styles.studioDesc}>
                Crie a página do seu estúdio com logo, pitch, equipe, contatos, catálogo de obras e um press kit profissional — pronto para a imprensa
                e para investidores.
              </p>
              <div className={styles.studioActions}>
                {!isLoggedIn && (
                  <Link href="/cadastro" className={styles.ctaPrimary}>
                    Criar meu estúdio
                  </Link>
                )}
                <Link href="/estudios" className={styles.ctaSecondary}>
                  Conhecer estúdios →
                </Link>
              </div>
            </div>
            <div className={styles.studioVisual}>
              <div className={styles.studioBadge}>🎮 + 🎨 + 📰</div>
              <p className={styles.studioVisualText}>Portfólio, catálogos e press kit em um só lugar.</p>
            </div>
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
              {
                content: "Instagram Imagem",
                image_src: "/images/instagram_image.png",
              },
              {
                content: "Instagram Vídeo",
                image_src: "/images/instagram_video.png",
              },
              { content: "Steam Widget", image_src: "/images/steam_widget.png" },
              {
                content: "Canal Twitch",
                image_src: "/images/twitch_channel.png",
              },
              {
                content: "YouTube Shorts",
                image_src: "/images/youtube_shorts.png",
              },
              {
                content: "YouTube Vídeo",
                image_src: "/images/youtube_video.png",
              },
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
            TESTEMUNHOS
        ════════════════════════════════════ */}
        <div id="comunidade">
          <TestimonialsSection />
        </div>

        {/* ════════════════════════════════════
            MÍDIA / PRESS KIT
        ════════════════════════════════════ */}
        <SectionReveal className={styles.pressSection}>
          <div className={styles.pressCard}>
            <div className={styles.pressContent}>
              <p className={styles.sectionLabel}>Para a imprensa</p>
              <h2 className={styles.sectionTitle}>Press kit oficial</h2>
              <p className={styles.pressDesc}>
                Fatos, descrição da plataforma e contatos para cobertura. Baixe o material em PDF ou acesse a página completa.
              </p>
              <div className={styles.studioActions}>
                <Link href="/presskit" className={styles.ctaPrimary}>
                  Ver press kit
                </Link>
                <Link href="/presskit" className={styles.ctaSecondary}>
                  Baixar PDF ⬇
                </Link>
              </div>
            </div>
            <span className={styles.pressIcon}>📄</span>
          </div>
        </SectionReveal>

        {/* ════════════════════════════════════
            CTA FINAL
        ════════════════════════════════════ */}
        <SectionReveal className={styles.finalCtaSection}>
          <div className={styles.finalCta}>
            <h2 className={styles.finalCtaTitle}>Pronto para fazer parte da cena indie?</h2>
            <p className={styles.finalCtaSub}>Junte-se a desenvolvedores, artistas e gamers que estão construindo o futuro dos jogos no Brasil.</p>
            {isLoggedIn ? (
              <Link href="/posts" className={styles.ctaPrimary}>
                Ir para a comunidade →
              </Link>
            ) : (
              <Link href="/cadastro" className={styles.ctaPrimary}>
                Começar agora — é grátis
              </Link>
            )}
          </div>
        </SectionReveal>
      </main>

      {/* ════════════════════════════════════
          RODAPÉ
      ════════════════════════════════════ */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Link href="/" className={styles.navLogo}>
              <Image src="/images/logo.png" alt={`Logo ${SITE_NAME}`} width={28} height={28} unoptimized />
              <span className={styles.navBrand}>{SITE_NAME}</span>
            </Link>
            <p className={styles.footerTagline}>A rede social dos jogos independentes brasileiros.</p>
          </div>

          <div className={styles.footerColumns}>
            <div className={styles.footerColumn}>
              <p className={styles.footerHeading}>Plataforma</p>
              <Link href="/posts" className={styles.footerLink}>
                Comunidade
              </Link>
              <Link href="/jogos" className={styles.footerLink}>
                Jogos
              </Link>
              <Link href="/estudios" className={styles.footerLink}>
                Estúdios
              </Link>
              <Link href="/agenda" className={styles.footerLink}>
                Agenda
              </Link>
            </div>
            <div className={styles.footerColumn}>
              <p className={styles.footerHeading}>Conteúdo</p>
              <Link href="/noticias" className={styles.footerLink}>
                Notícias
              </Link>
              <Link href="/jogos-de-mesa" className={styles.footerLink}>
                Jogos de mesa
              </Link>
              <Link href="/quadrinhos" className={styles.footerLink}>
                Quadrinhos
              </Link>
              <Link href="/estudos" className={styles.footerLink}>
                Cursos
              </Link>
            </div>
            <div className={styles.footerColumn}>
              <p className={styles.footerHeading}>Institucional</p>
              <Link href="/presskit" className={styles.footerLink}>
                Press kit
              </Link>
              <a href="mailto:contato@indies.com.br" className={styles.footerLink}>
                Contato
              </a>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>
            © {new Date().getFullYear()} {SITE_NAME}. Feito com 💚 no Brasil.
          </span>
        </div>
      </footer>
    </>
  );
}

Home.noLayout = true;

export default Home;
