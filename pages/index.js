import SeoHead from "@/components/SeoHead";
import Image from "next/image";
import Link from "next/link";
import styles from "./index.module.css";
import CategoryTiles from "@/components/Landing/CategoryTiles/CategoryTiles";
import CommunityFeed from "@/components/Landing/CommunityFeed/CommunityFeed";
import CommunityStats from "@/components/Landing/CommunityStats/CommunityStats";
import HighlightCard from "@/components/HighlightCard/HighlightCard";
import EventCard from "@/components/Agenda/EventCard";
import TestimonialsSection from "@/components/Landing/TestimonialsSection";
import { PaperAirplaneIcon, PersonIcon, VideoIcon } from "@primer/octicons-react";
import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { SITE_URL, SITE_NAME, SITE_ALTERNATE_NAMES, OG_COVER_ART, OG_IMAGE_SIZE } from "@/lib/seo";
import { sortEventsByStart } from "@/lib/eventFormat";
import { HIGHLIGHT_TYPE_FEATURES, groupHighlightsByType } from "@/lib/highlights";
import { LANDING_CATEGORIES } from "@/lib/landing";
import useInView from "@/hooks/useInView";

const PAGE_TITLE = `${SITE_NAME} — A rede social dos jogos independentes brasileiros`;
const PAGE_DESCRIPTION =
  "Descubra jogos digitais, jogos de mesa, quadrinhos e assets feitos no Brasil. Mostre seu portfólio, crie a página do seu estúdio e encontre parceiros de projeto.";
const PAGE_URL = SITE_URL;

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      // O nome histórico ("Indies Brasil") e o endereço sem `www` são como
      // parte das pessoas procura o site; `alternateName` é o campo que o
      // Google consulta para o "nome do site". Ver `SITE_ALTERNATE_NAMES`. O
      // nome principal (`SITE_NAME`) não entra na lista: repeti-lo não ensina
      // nada ao buscador.
      alternateName: SITE_ALTERNATE_NAMES,
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

// Quem está aqui — a resposta ESTÁTICA para "para quem é". Antes eram nove
// frases digitadas em loop (200 ms por caractere) e a primeira leitura do
// visitante era literalmente "Somos ", porque o componente começa vazio: a
// informação existia, mas só para quem esperasse o ciclo terminar.
const HERO_ROLES = ["Programação", "Arte", "Roteiro", "Áudio", "Design", "Produção", "Streaming"];

// Cada card leva a um destino real. Antes eram três caixas de texto sem ação —
// e a seção "recursos", logo abaixo, repetia as mesmas três ideias.
const AUDIENCES = [
  {
    href: "/cadastro",
    icon: <PersonIcon />,
    title: "Para criadores",
    desc: "Monte seu portfólio, crie a página do estúdio, publique jogos e quadrinhos e encontre parceiros de projeto.",
    cta: "Criar meu perfil",
  },
  {
    href: "/jogos",
    icon: <VideoIcon />,
    title: "Para quem joga",
    desc: "Descubra jogos digitais e de mesa, quadrinhos e assets feitos no Brasil — e participe do feed da comunidade.",
    cta: "Explorar o catálogo",
  },
  {
    href: "/presskit",
    icon: <PaperAirplaneIcon />,
    title: "Para imprensa e negócios",
    desc: "Press kits prontos, contatos de estúdio, catálogo de serviços e pautas para cobrir, investir ou fechar parceria.",
    cta: "Ver o press kit",
  },
];

const STEPS = [
  {
    title: "Crie seu perfil",
    desc: "Conte quem você é, o que faz e o que procura na indústria.",
  },
  {
    title: "Publique seu trabalho",
    desc: "Divulgue projetos, portfólio, jogos e atualizações para a comunidade.",
  },
  {
    title: "Conecte-se e cresça",
    desc: "Encontre talentos, estúdios, gamers e oportunidades de negócio.",
  },
];

// Navegação principal: aponta para CONTEÚDO navegável (não para seções da
// própria landing). Quatro itens, os mesmos quatro de antes — trocar "Notícias"
// por "Serviços" cobre a única capacidade do produto que não aparecia em lugar
// nenhum do topo. O resto do catálogo vive no mapa de categorias logo abaixo do
// hero (`LANDING_CATEGORIES`), onde há espaço para dizer o que tem dentro.
const NAV_LINKS = [
  { href: "/jogos", label: "Jogos" },
  { href: "/estudios", label: "Estúdios" },
  { href: "/servicos", label: "Serviços" },
  { href: "/posts", label: "Comunidade" },
];

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
            <Link key={link.href} href={link.href} className={styles.navLink}>
              {link.label}
            </Link>
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
            <Link key={link.href} href={link.href} className={styles.navMobileLink} onClick={onNavigate}>
              {link.label}
            </Link>
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

/** Quantos posts a prévia do feed mostra antes de mandar para `/posts`. */
const RECENT_POSTS_LIMIT = 3;

function Home({ initialHighlights = [], recentPosts = [] }) {
  const { user } = useUser();
  const isLoggedIn = Boolean(user?.id);
  const [summary, setSummary] = useState(null);
  const [summaryState, setSummaryState] = useState("loading");
  // Os destaques chegam do servidor (`getServerSideProps`): o HTML da home
  // precisa sair com `href="/jogos/<slug>"`. Buscá-los no cliente deixava a
  // primeira dobra sem nenhuma obra — o visitante via só texto de marketing e
  // o Google precisava executar JavaScript para achar o conteúdo.
  const highlights = initialHighlights;
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
    getUpcomingEvents();
  }, []);

  // Uma linha por tipo, na ordem de `HIGHLIGHT_TYPES`: o agrupamento passa a
  // ser dito por um título, e não só pelo selo sobre a arte.
  const highlightGroups = groupHighlightsByType(highlights);

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
              <span className={styles.heroBadge}>🇧🇷 Comunidade indie brasileira</span>

              {/* O H1 diz o que a plataforma É. A versão anterior — "Onde o
                  talento indie brasileiro se encontra" — descrevia um
                  sentimento e deixava a pergunta principal sem resposta:
                  comunidade? portal de notícias? vaga de emprego? Sem <br>
                  forçado: a quebra vem da largura. */}
              <h1 className={styles.heroHeading}>
                A rede social dos <span className={styles.heroAccent}>jogos independentes</span> brasileiros
              </h1>

              {/* Quem está aqui, estático. Antes esta era a frase que respondia
                  "para quem é" — e ela era digitada a 200 ms por caractere,
                  começando vazia: a primeira leitura era literalmente "Somos ". */}
              <ul className={styles.heroRoles} aria-label="Quem faz parte">
                {HERO_ROLES.map((role) => (
                  <li key={role}>{role}</li>
                ))}
              </ul>

              <p className={styles.heroSub}>
                Descubra jogos digitais, jogos de mesa, quadrinhos e assets feitos no Brasil — e mostre o seu: portfólio, estúdio, catálogo e material
                de imprensa. O feed da comunidade está aberto para ler.
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
                conteúdo navegável, não ao cadastro. A arte é a versão com a
                sobra transparente (`OG_COVER_ART`): o CSS do card assume a
                proporção da moldura da arte e descarta a sobra, que existe só
                para o preview de link (1,91:1). As medidas do arquivo ficam nos
                atributos (reserva da caixa) e o `sizes` considera que o
                `object-fit: cover` desenha a imagem ~1,71x a largura do card. */}
            <div className={styles.heroPromo}>
              <Link href="/jogos" className={styles.promoCard} aria-label="Explorar jogos independentes brasileiros">
                <Image
                  src={OG_COVER_ART}
                  alt=""
                  className={styles.promoImage}
                  width={OG_IMAGE_SIZE.width}
                  height={OG_IMAGE_SIZE.height}
                  sizes="(max-width: 860px) 170vw, 820px"
                  priority
                />
              </Link>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════
            DESTAQUES — conteúdo real na primeira rolagem, uma linha por tipo
            Antes esta seção vinha depois de 12 métricas e 3 cards de
            audiência: quinze caixas de texto antes de o visitante ver uma
            única obra. Os dados chegam do servidor (`getServerSideProps`),
            então o HTML já sai com os links.
        ════════════════════════════════════ */}
        {highlightGroups.length > 0 && (
          <SectionReveal className={styles.section}>
            <header className={styles.sectionHeader}>
              <p className={styles.sectionLabel}>Destaques</p>
              <h2 className={styles.sectionTitle}>O que a comunidade está criando</h2>
              <p className={styles.sectionSub}>Jogos digitais, jogos de mesa, livros e assets feitos por estúdios brasileiros.</p>
            </header>

            {highlightGroups.map((group) => (
              <div key={group.type} className={styles.highlightGroup}>
                <div className={styles.highlightGroupHeader}>
                  <h3 className={styles.highlightGroupTitle}>{group.heading}</h3>
                  <Link href={group.route} className={styles.highlightGroupLink}>
                    Ver todos →
                  </Link>
                </div>
                <div className={styles.highlightGrid}>
                  {group.items.map((item) => (
                    <HighlightCard key={`${item.type}-${item.slug}`} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </SectionReveal>
        )}

        {/* ════════════════════════════════════
            PORTAS DE ENTRADA — o mapa do produto
            Substituem os 12 cards de métrica: o número dizia "existe", mas não
            levava a nada e escondia metade do catálogo. Cada porta é um link
            com o rótulo do que tem dentro; o contador é aprimoramento.
        ════════════════════════════════════ */}
        <SectionReveal id="explorar" className={styles.section}>
          <header className={styles.sectionHeader}>
            <p className={styles.sectionLabel}>Explore</p>
            <h2 className={styles.sectionTitle}>Tudo o que existe aqui, por categoria</h2>
            <p className={styles.sectionSub}>
              Dez portas de entrada. Ler é livre e não exige conta — publicar, comentar e seguir é que pedem um perfil.
            </p>
          </header>
          <CategoryTiles categories={LANDING_CATEGORIES} summary={summary} state={summaryState} />

          {/* Prova social em uma linha. Os mesmos números que antes ocupavam
              uma grade de 12 cards com "período anterior" — agora como apoio
              da vitrine, não como primeira coisa a ser lida. */}
          <CommunityStats summary={summary} state={summaryState} />
        </SectionReveal>

        {/* ════════════════════════════════════
            AUDIÊNCIAS — para quem é, e para onde ir
            Cada card é um link: antes eram três caixas de texto sem ação, ao
            lado de uma grade de "recursos" que repetia as mesmas ideias.
        ════════════════════════════════════ */}
        <SectionReveal id="audiencias" className={styles.section}>
          <header className={styles.sectionHeader}>
            <p className={styles.sectionLabel}>Para quem é</p>
            <h2 className={styles.sectionTitle}>Feito para quem faz e para quem joga</h2>
            <p className={styles.sectionSub}>Escolha por onde começar — cada caminho leva direto ao que você procura.</p>
          </header>

          <div className={styles.audienceGrid}>
            {AUDIENCES.map((audience) => (
              <Link key={audience.title} href={audience.href} className={styles.audienceCard}>
                <span className={styles.audienceIcon} aria-hidden="true">
                  {audience.icon}
                </span>
                <h3 className={styles.audienceTitle}>{audience.title}</h3>
                <p className={styles.audienceDesc}>{audience.desc}</p>
                <span className={styles.audienceCta}>{audience.cta} →</span>
              </Link>
            ))}
          </div>
        </SectionReveal>

        {/* ════════════════════════════════════
            COMUNIDADE — o feed em si
            A página se apresenta como rede social e não mostrava nenhum post:
            portas de entrada e vitrine cobrem o catálogo, não a conversa.
        ════════════════════════════════════ */}
        {recentPosts.length > 0 && (
          <SectionReveal id="feed" className={styles.section}>
            <header className={styles.sectionHeader}>
              <p className={styles.sectionLabel}>Comunidade</p>
              <h2 className={styles.sectionTitle}>O que estão falando agora</h2>
              <p className={styles.sectionSub}>
                Posts de quem faz jogos no Brasil — atualizações de projeto, conquistas e dúvidas. Ler é livre; responder pede uma conta.
              </p>
            </header>

            <CommunityFeed posts={recentPosts} />

            <Link href="/posts" className={styles.upcomingMore}>
              Entrar no feed da comunidade →
            </Link>
          </SectionReveal>
        )}

        {/* ════════════════════════════════════
            AGENDA — próximos eventos
            Depois das portas de entrada e das audiências: quem veio ver o que
            a comunidade está fazendo também quer saber quando e onde encontrá-la.
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
            COMO FUNCIONA — só para quem ainda não tem conta: "crie seu perfil"
            não é próximo passo de quem já está dentro.
        ════════════════════════════════════ */}
        {!isLoggedIn && (
          <SectionReveal className={styles.sectionAlt}>
            <header className={styles.sectionHeader}>
              <p className={styles.sectionLabel}>Como funciona</p>
              <h2 className={styles.sectionTitle}>Comece em três passos</h2>
            </header>

            <div className={styles.stepsGrid}>
              {STEPS.map((step, index) => (
                <div key={step.title} className={styles.stepCard}>
                  <span className={styles.stepNumber}>{index + 1}</span>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepDesc}>{step.desc}</p>
                </div>
              ))}
            </div>
          </SectionReveal>
        )}

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
              <p className={styles.studioVisualText}>Portfólio, catálogo de obras e press kit — o material que a imprensa e o investidor procuram.</p>
            </div>
          </div>
        </SectionReveal>

        {/* ════════════════════════════════════
            TESTEMUNHOS — a seção já anima internamente via useInView;
            aqui só recebe o mesmo ritmo vertical das demais.
        ════════════════════════════════════ */}
        <div id="comunidade" className={styles.section}>
          <TestimonialsSection />
        </div>

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
              <Link href="/jogos" className={styles.footerLink}>
                Jogos
              </Link>
              <Link href="/estudios" className={styles.footerLink}>
                Estúdios
              </Link>
              <Link href="/assets" className={styles.footerLink}>
                Artes e assets
              </Link>
              <Link href="/servicos" className={styles.footerLink}>
                Serviços
              </Link>
              <Link href="/posts" className={styles.footerLink}>
                Comunidade
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
              <Link href="/analises" className={styles.footerLink}>
                Análises
              </Link>
              <Link href="/estudos" className={styles.footerLink}>
                Cursos
              </Link>
              <Link href="/streams" className={styles.footerLink}>
                Lives
              </Link>
              <Link href="/agenda" className={styles.footerLink}>
                Agenda
              </Link>
            </div>
            <div className={styles.footerColumn}>
              <p className={styles.footerHeading}>Institucional</p>
              <Link href="/presskit" className={styles.footerLink}>
                Press kit
              </Link>
              <Link href="/sobre" className={styles.footerLink}>
                Sobre o projeto
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

/**
 * Destaques renderizados no servidor.
 *
 * A home mostrava o conteúdo só depois de três `fetch` no cliente: o HTML
 * servido era texto de marketing + a arte, sem um único link de obra. Para
 * quem chega de fora — e para o Google — a plataforma parecia não ter catálogo.
 *
 * Os imports são dinâmicos pelo mesmo motivo das outras páginas: `models` e
 * `infra/controller` puxam o pool do Postgres e não podem entrar no bundle do
 * cliente.
 *
 * A falha não derruba a home: sem banco (ou sem a feature) a seção de destaques
 * simplesmente não aparece, e o resto da página continua servindo como
 * apresentação do produto.
 */
export async function getServerSideProps() {
  const { anonymousCan } = await import("@/infra/controller");

  const [highlights, posts] = await Promise.all([loadHighlights(anonymousCan), loadRecentPosts(anonymousCan)]);

  return { props: { initialHighlights: highlights, recentPosts: posts } };
}

async function loadHighlights(anonymousCan) {
  try {
    const { default: highlight } = await import("@/models/highlight");

    const highlights = await highlight.findHighlights();

    // Cada tipo tem a sua feature (ver `HIGHLIGHT_TYPE_FEATURES`): se o anônimo
    // perde a leitura de um catálogo, o card daquele tipo sai do HTML em vez de
    // anunciar um endereço que responde 404.
    const allowed = highlights.filter((item) => anonymousCan(HIGHLIGHT_TYPE_FEATURES[item.type]));

    return JSON.parse(JSON.stringify(allowed));
  } catch (error) {
    console.error("Erro ao buscar destaques da home:", error);
    return [];
  }
}

/**
 * Três posts recentes para a prévia do feed.
 *
 * `getPosts(null, …)` é o caminho anônimo do model — o mesmo que a rota
 * pública usa —, então a moderação (post, autor ou estúdio bloqueado) vale aqui
 * sem código extra. `JSON.parse(JSON.stringify())` porque `created_at` é `Date`
 * e o Next não serializa `Date` em props (a página responderia 500).
 */
async function loadRecentPosts(anonymousCan) {
  if (!anonymousCan("read:post")) return [];

  try {
    const { default: post } = await import("@/models/post");

    const posts = await post.getPosts(null, undefined, undefined, { limit: RECENT_POSTS_LIMIT });

    return JSON.parse(JSON.stringify(posts));
  } catch (error) {
    console.error("Erro ao buscar posts da home:", error);
    return [];
  }
}
