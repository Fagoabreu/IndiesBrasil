import SeoHead from "@/components/SeoHead";
import Image from "next/image";
import Link from "next/link";
import CarouselComponent from "@/components/Carousel/CarouselComponent";
import styles from "./index.module.css";
import VerticalCardComponent from "@/components/Card/VerticalCardComponent";
import MetricCard from "@/components/Card/MetricCard";
import HighlightCard from "@/components/HighlightCard/HighlightCard";
import EventCard from "@/components/Agenda/EventCard";
import TestimonialsSection from "@/components/Landing/TestimonialsSection";
import { MilestoneIcon, OrganizationIcon, PeopleIcon, StarIcon, VideoIcon, TableIcon, BookIcon, BroadcastIcon } from "@primer/octicons-react";
import { useEffect, useState } from "react";
import TyperwriterComponent from "@/components/TypeWriter/TyperwriterComponent";
import { useUser } from "@/context/UserContext";
import { SITE_URL, SITE_NAME } from "@/lib/seo";
import { sortEventsByStart } from "@/lib/eventFormat";
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

// Apenas recursos sem seção dedicada na própria página — "Sistema de Tags",
// "Embeds Multimídia" e "Comunidade Ativa" já têm seções próprias abaixo
// (Tags, Integrações e Testemunhos) e eram repetição.
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
];

// Navegação principal: aponta para CONTEÚDO navegável (não para seções da
// própria landing). Antes só havia âncoras, então um visitante que quisesse
// ler algo não tinha nenhuma porta no topo — só "Entrar" e "Criar conta",
// o que reforçava a impressão de que a conta era obrigatória.
const NAV_LINKS = [
  { href: "/jogos", label: "Jogos" },
  { href: "/noticias", label: "Notícias" },
  { href: "/estudios", label: "Estúdios" },
  { href: "/posts", label: "Comunidade" },
];

// Descritor das métricas: cada `field` é lido do /api/v1/status/summary.
// Sem isso, cada card repetia `summary ? summary.x : "..."` no JSX — dez
// expressões condicionais que estouravam a complexidade cognitiva de Home.
// `href` leva à listagem correspondente: o número só ganha utilidade quando
// dá para ver quem/o quê está sendo contado.
const METRICS = [
  {
    title: "Usuários",
    period: "Desde o início",
    field: "user_accounts",
    previousLabel: "Últimos 30 dias",
    previousField: "new_user_accounts",
    icon: <PeopleIcon />,
    href: "/membros",
  },
  {
    title: "Posts",
    period: "30 dias",
    field: "new_posts",
    previousLabel: "Período Anterior",
    previousField: "previous_posts",
    icon: <StarIcon />,
    href: "/posts",
  },
  {
    title: "Eventos",
    period: "Próximos 30 dias",
    field: "events",
    previousLabel: "Período Anterior",
    previousField: "previous_events",
    icon: <MilestoneIcon />,
    href: "/agenda",
  },
  {
    title: "Estúdios",
    period: "Total",
    field: "organizations",
    previousLabel: "Novos nos últimos 30 dias",
    previousField: "new_organizations",
    icon: <OrganizationIcon />,
    href: "/estudios",
  },
  {
    title: "Jogos",
    period: "Total",
    field: "games",
    previousLabel: "Novos nos últimos 30 dias",
    previousField: "new_games",
    icon: <VideoIcon />,
    href: "/jogos",
  },
  {
    title: "Jogos de mesa",
    period: "Total",
    field: "boardgames",
    previousLabel: "Novos nos últimos 30 dias",
    previousField: "new_boardgames",
    icon: <TableIcon />,
    href: "/jogos-de-mesa",
  },
  {
    title: "Livros e quadrinhos",
    period: "Total",
    field: "books",
    previousLabel: "Novos nos últimos 30 dias",
    previousField: "new_books",
    icon: <BookIcon />,
    href: "/quadrinhos",
  },
  {
    // `live_streams` vem do cache de status alimentado pelo refresh da página
    // de streams, então é um retrato da última verificação — daí o "Agora".
    title: "Lives",
    period: "Ao vivo agora",
    field: "live_streams",
    previousLabel: "Estúdios com canal",
    previousField: "streaming_studios",
    icon: <BroadcastIcon />,
    href: "/streams",
  },
];

/**
 * Valor exibido num card de métrica.
 *
 * O `"..."` fixo de antes mentia em dois casos: ficava para sempre se a
 * requisição falhasse (o visitante nunca sabia que o dado não vinha), e não
 * distinguia "carregando" de "não há esse dado". Agora:
 *  - `loading`: reticências, que é a convenção de "aguarde";
 *  - `ready` sem o campo, ou `error`: travessão, que significa "sem dado".
 * @param {object|null} summary
 * @param {"loading"|"ready"|"error"} state
 * @param {string} field
 */
function getMetricValue(summary, state, field) {
  if (state === "loading") return "…";
  if (state !== "ready" || !summary) return "—";
  return summary[field] ?? "—";
}

function NavToggle({ open, onToggle }) {
  return (
    <button
      type="button"
      className={styles.navToggle}
      aria-expanded={open}
      aria-controls="menu-mobile"
      aria-label={open ? "Fechar menu" : "Abrir menu"}
      onClick={onToggle}
    >
      <span className={open ? `${styles.navToggleBar} ${styles.navToggleBarOpen}` : styles.navToggleBar} />
      <span className={open ? `${styles.navToggleBar} ${styles.navToggleBarOpen}` : styles.navToggleBar} />
      <span className={open ? `${styles.navToggleBar} ${styles.navToggleBarOpen}` : styles.navToggleBar} />
    </button>
  );
}

function LandingNav({ isLoggedIn, username, menuOpen, onToggle, onNavigate }) {
  return (
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <Link href="/" className={styles.navLogo}>
          <Image src="/images/logo.png" alt={`Logo ${SITE_NAME}`} width={32} height={32} unoptimized priority />
          <span className={styles.navBrand}>{SITE_NAME}</span>
        </Link>

        <nav className={styles.navLinks} aria-label="Navegação principal">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className={styles.navLink}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className={styles.navActions}>
          {isLoggedIn ? (
            <Link href={`/perfil/${username}`} className={styles.navCta}>
              Meu perfil
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

          {/* As âncoras da seção e o "Entrar" não cabem em telas pequenas.
              Em vez de escondê-los, ficam neste painel. */}
          <NavToggle open={menuOpen} onToggle={onToggle} />
        </div>
      </div>

      <div id="menu-mobile" className={menuOpen ? `${styles.navMobile} ${styles.navMobileOpen}` : styles.navMobile} hidden={!menuOpen}>
        <nav className={styles.navMobileLinks} aria-label="Navegação principal (mobile)">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className={styles.navMobileLink} onClick={onNavigate}>
              {link.label}
            </a>
          ))}
          {!isLoggedIn && (
            <Link href="/login" className={styles.navMobileLink} onClick={onNavigate}>
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function SectionReveal({ children, className = "", as: Tag = "section", ...props }) {
  // `once`: a seção revela ao entrar e não volta a se esconder. Sem isso o
  // conteúdo reaparecia deslocado 30px (translateY em .reveal) a cada rolagem
  // de volta — a página parecia se remontar sozinha.
  const [ref, isVisible] = useInView({ threshold: 0.08, once: true });
  return (
    <Tag ref={ref} className={`${styles.reveal} ${isVisible ? styles.revealVisible : ""} ${className}`} {...props}>
      {children}
    </Tag>
  );
}

/** Quantos eventos a home mostra antes de mandar para a agenda completa. */
const UPCOMING_EVENTS_LIMIT = 2;

function Home() {
  const { user } = useUser();
  const isLoggedIn = Boolean(user?.id);
  const [summary, setSummary] = useState(null);
  const [summaryState, setSummaryState] = useState("loading");
  const [highlights, setHighlights] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);

  // Fecha o menu mobile com Escape e ao voltar para o breakpoint desktop —
  // sem isso o painel ficaria aberto "fantasma" escondido atrás do layout.
  useEffect(() => {
    if (!menuOpen) return;

    function onKeyDown(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    const desktopQuery = window.matchMedia("(min-width: 861px)");
    function onBreakpointChange(event) {
      if (event.matches) setMenuOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    desktopQuery.addEventListener("change", onBreakpointChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      desktopQuery.removeEventListener("change", onBreakpointChange);
    };
  }, [menuOpen]);

  useEffect(() => {
    async function getSummary() {
      try {
        const response = await fetch("/api/v1/status/summary", {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          // Não deixa os cards em "carregando" para sempre: um erro precisa
          // ser visível como ausência de dado, não como lentidão.
          setSummaryState("error");
          return;
        }

        const data = await response.json();
        setSummary(data);
        setSummaryState("ready");
      } catch (error) {
        console.error("Erro ao buscar summary:", error);
        setSummaryState("error");
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

    // Próximos eventos da agenda. A rota devolve os três meses seguintes na
    // ordem das instâncias (por id, não por data), então a ordenação por data
    // acontece aqui.
    //
    // Só eventos **públicos**: a home é lida por qualquer visitante, inclusive
    // anônimo, e eventos de membros não devem aparecer para quem não entrou.
    async function getUpcomingEvents() {
      try {
        const response = await fetch("/api/v1/events", {
          method: "GET",
          credentials: "include",
        });
        if (!response.ok) return;

        const data = await response.json();
        const publicos = Array.isArray(data) ? data.filter((ev) => ev.visibility === "public") : [];
        setUpcomingEvents(sortEventsByStart(publicos).slice(0, UPCOMING_EVENTS_LIMIT));
      } catch (error) {
        console.error("Erro ao buscar próximos eventos:", error);
      }
    }

    getSummary();
    getHighlights();
    getUpcomingEvents();
  }, []);

  return (
    <div className={styles.root}>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} jsonLd={JSON_LD} />

      <a href="#conteudo" className={styles.skipLink}>
        Pular para o conteúdo
      </a>

      {/* ════════════════════════════════════
          NAVEGAÇÃO
      ════════════════════════════════════ */}
      <LandingNav
        isLoggedIn={isLoggedIn}
        username={user?.username}
        menuOpen={menuOpen}
        onToggle={() => setMenuOpen((open) => !open)}
        onNavigate={() => setMenuOpen(false)}
      />

      <main id="conteudo" className={styles.page}>
        {/* ════════════════════════════════════
            HERO — Primeira impressão
        ════════════════════════════════════ */}
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroContent}>
              <span className={styles.heroBadge}>🇧🇷 A casa dos jogos independentes brasileiros</span>

              {/* Sem <br> forçado: a quebra vinha no lugar errado em telas
                  estreitas. O texto quebra naturalmente pela largura. */}
              <h1 className={styles.heroHeading}>
                Onde o talento indie <span className={styles.heroAccent}>brasileiro</span> se encontra
              </h1>

              <p className={styles.heroTypeWriter}>
                {/* O texto animado muda a cada 100–200ms; para leitores de tela
                    isso vira ruído, então a versão acessível é estática. */}
                <span aria-hidden="true">
                  Somos <TyperwriterComponent initText="" frases={FRASES} />
                </span>
                <span className={styles.srOnly}>Somos gamers, programadores, roteiristas, animadores, produtores, ilustradores e designers.</span>
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
                    {/* Primário = conteúdo. A leitura é livre, então o maior
                        peso visual leva ao produto, não ao formulário. */}
                    <Link href="/jogos" className={styles.ctaPrimary}>
                      Explorar jogos →
                    </Link>
                    <Link href="/cadastro" className={styles.ctaSecondary}>
                      Criar conta grátis
                    </Link>
                  </>
                )}
              </div>

              {!isLoggedIn && (
                <p className={styles.heroMicrocopy}>Leia sem criar conta &nbsp;·&nbsp; Publique quando quiser &nbsp;·&nbsp; Feito no Brasil</p>
              )}
            </div>

            {/* Card promocional — maior elemento da dobra, então leva ao
                conteúdo navegável, não ao cadastro. */}
            <div className={styles.heroPromo}>
              <Link href="/jogos" className={styles.promoCard} aria-label="Explorar jogos independentes brasileiros">
                <Image src="/images/ArteSite.png" alt="" className={styles.promoImage} width={460} height={345} priority />
              </Link>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════
            MÉTRICAS — Prova social
        ════════════════════════════════════ */}
        <SectionReveal className={styles.metricsSection}>
          {/* Os cards são h3; sem um h2 anterior a hierarquia saltaria de h1
              para h3. O título é visualmente oculto, mas presente na árvore. */}
          <h2 className={styles.srOnly}>Indies Brasil em números</h2>

          {/* Declara de frente a ausência de barreira: é a informação que
              faltava para desfazer a conclusão de que a conta é obrigatória. */}
          {!isLoggedIn && (
            <div className={styles.freeNotice}>
              <span className={styles.freeNoticeIcon} aria-hidden="true">
                🔓
              </span>
              <div>
                <p className={styles.freeNoticeTitle}>Explore à vontade — sem cadastro</p>
                <p className={styles.freeNoticeText}>
                  Ler jogos, notícias, estúdios e publicações é livre e não exige conta. Você só precisa de uma para publicar, comentar e seguir.
                </p>
              </div>
            </div>
          )}

          {/* `aria-busy` avisa a tecnologia assistiva que os números ainda
              estão chegando — antes as reticências passavam como valor. */}
          <div className={styles.metrics} aria-busy={summaryState === "loading"}>
            {METRICS.map((metric) => (
              <MetricCard
                key={metric.title}
                title={metric.title}
                period={metric.period}
                value={getMetricValue(summary, summaryState, metric.field)}
                previousLabel={metric.previousLabel}
                previousValue={getMetricValue(summary, summaryState, metric.previousField)}
                icon={metric.icon}
                href={metric.href}
              />
            ))}
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
                <span className={styles.audienceIcon} aria-hidden="true">
                  {audience.icon}
                </span>
                <h3 className={styles.audienceTitle}>{audience.title}</h3>
                <p className={styles.audienceDesc}>{audience.desc}</p>
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
            AGENDA — próximos eventos
            Logo após os destaques: quem veio ver o que a comunidade está
            fazendo também quer saber quando e onde encontrá-la.
        ════════════════════════════════════ */}
        {upcomingEvents.length > 0 && (
          <SectionReveal className={styles.section}>
            <header className={styles.sectionHeader}>
              <p className={styles.sectionLabel}>Agenda</p>
              <h2 className={styles.sectionTitle}>Próximos eventos</h2>
              <p className={styles.sectionSub}>Encontros, game jams e lançamentos da comunidade — a agenda é aberta e não exige conta.</p>
            </header>

            <div className={styles.upcomingList}>
              {upcomingEvents.map((event) => (
                <EventCard key={event.instance_id} event={event} />
              ))}
            </div>

            <Link href="/agenda" className={styles.upcomingMore}>
              Ver a agenda completa →
            </Link>
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
                <div className={styles.featureIcon} aria-hidden="true">
                  {feature.icon}
                </div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDesc}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </SectionReveal>

        {/* ════════════════════════════════════
            COMO FUNCIONA — depois dos recursos: o passo a passo só faz
            sentido após apresentar o que a plataforma oferece.
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
                <span className={styles.stepIcon} aria-hidden="true">
                  {step.icon}
                </span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.desc}</p>
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
              <div className={styles.studioBadge} aria-hidden="true">
                🎮 + 🎨 + 📰
              </div>
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
                image_src: "/images/posts/instagram_image.png",
              },
              {
                content: "Instagram Vídeo",
                image_src: "/images/posts/instagram_video.png",
              },
              { content: "Steam Widget", image_src: "/images/steam_widget.png" },
              {
                content: "Canal Twitch",
                image_src: "/images/posts/twitch_channel.png",
              },
              {
                content: "YouTube Shorts",
                image_src: "/images/posts/youtube_shorts.png",
              },
              {
                content: "YouTube Vídeo",
                image_src: "/images/posts/youtube_video.png",
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
            image="/images/posts/sistematags.png"
            alt="ranqueamento Tags"
            title="Tags"
            description="Ranqueamento e localização de posts através de tags que auxiliam a classificação do assunto, podendo iniciar uma trend ou uma conversa."
          />
        </SectionReveal>
        <SectionReveal className={styles.section}>
          <header className={styles.sectionHeader}>
            <p className={styles.sectionLabel}>Votação</p>
            <h2 className={styles.sectionTitle}>Sistema de Pesquisa</h2>
            <p className={styles.sectionSub}>Votação dos usuários para ranquear e destacar pesquisas.</p>
          </header>
          <VerticalCardComponent
            image="/images/posts/questionario.png"
            alt="ranqueamento Tags"
            title="Tags"
            description="Ranqueamento e localização de posts através de tags que auxiliam a classificação do assunto, podendo iniciar uma trend ou uma conversa."
          />
        </SectionReveal>

        {/* ════════════════════════════════════
            TESTEMUNHOS — a seção já anima internamente via useInView;
            aqui só recebe o mesmo ritmo vertical das demais.
        ════════════════════════════════════ */}
        <div id="comunidade" className={styles.section}>
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
            <span className={styles.pressIcon} aria-hidden="true">
              📄
            </span>
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
    </div>
  );
}

Home.noLayout = true;

export default Home;
