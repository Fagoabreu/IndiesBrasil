"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Heading, TextInput, Spinner, Avatar } from "@primer/react";
import { OrganizationIcon, PlusIcon, PeopleIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import { SITE_URL } from "@/lib/seo";
import styles from "./index.module.css";

const PAGE_TITLE = "Estúdios — Indies Brasil";
const PAGE_DESCRIPTION = "Conheça os estúdios de jogos indie brasileiros: press kits, membros, projetos e muito mais.";
const PAGE_URL = `${SITE_URL}/estudios`;

export default function StudiosPage() {
  const { user } = useUser();

  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  // aba "Descubra"
  const [allStudios, setAllStudios] = useState([]);
  const [allLoading, setAllLoading] = useState(true);
  const [allPage, setAllPage] = useState(1);
  const [allHasMore, setAllHasMore] = useState(false);

  // aba "Seguindo"
  const [followingStudios, setFollowingStudios] = useState([]);
  const [followingLoading, setFollowingLoading] = useState(false);

  // Carrega todos os estúdios (aba Descubra) com debounce na busca
  useEffect(() => {
    const t = setTimeout(() => {
      setAllPage(1);
      loadAll(1, search);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (allPage > 1) loadAll(allPage, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPage]);

  // Carrega estúdios seguidos quando usuário faz login
  useEffect(() => {
    if (!user) return;
    setFollowingLoading(true);
    fetch("/api/v1/studios?isfollowing=true", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setFollowingStudios(Array.isArray(data) ? data : []))
      .catch(() => setFollowingStudios([]))
      .finally(() => setFollowingLoading(false));
  }, [user]);

  async function loadAll(pageNum, searchQuery) {
    setAllLoading(true);
    try {
      const params = new URLSearchParams({ page: pageNum, limit: 20, search: searchQuery });
      const res = await fetch(`/api/v1/studios?${params}`, { credentials: "include" });
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      setAllStudios((prev) => (pageNum === 1 ? rows : [...prev, ...rows]));
      setAllHasMore(rows.length === 20);
    } catch {
      setAllStudios([]);
    } finally {
      setAllLoading(false);
    }
  }

  const activeList = tab === "following" ? followingStudios : allStudios;
  const isLoading = tab === "following" ? followingLoading : allLoading;

  const countNum = activeList.length;
  const countStr = countNum.toLocaleString("pt-BR");
  const countWord = countNum === 1 ? "estúdio" : "estúdios";

  let emptyTitle;
  if (tab === "following") {
    emptyTitle = "Você ainda não segue nenhum estúdio";
  } else if (search) {
    emptyTitle = "Nenhum estúdio encontrado";
  } else {
    emptyTitle = "Ainda não há estúdios cadastrados";
  }

  let emptyDescription;
  if (tab === "following") {
    emptyDescription = 'Vá para "Descubra" e comece a seguir!';
  } else if (search) {
    emptyDescription = `Nenhum resultado para "${search}". Tente outro termo.`;
  } else {
    emptyDescription = "Seja o primeiro a cadastrar o seu estúdio!";
  }

  return (
    <div className={styles.page}>
      <SeoHead
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        canonical={PAGE_URL}
        openGraph={{ title: PAGE_TITLE, description: PAGE_DESCRIPTION, url: PAGE_URL }}
      />

      {/* PAGE HEADER */}
      <header className={styles.pageHeader}>
        <div className={styles.headerBlock}>
          <div className={styles.headerTitle}>
            <Heading as="h2">Estúdios</Heading>
            {!isLoading && (
              <span className={styles.memberCount} aria-live="polite">
                {countStr} {countWord}
              </span>
            )}
          </div>
          <p className={styles.pageSubtitle}>Conheça os estúdios de jogos indie do Brasil.</p>

          {tab === "all" && (
            <div className={styles.searchWrapper}>
              <TextInput
                aria-label="Pesquisar estúdios"
                placeholder="Pesquisar por nome ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leadingVisual="search"
                className={styles.searchInput}
              />
            </div>
          )}
        </div>

        <div className={styles.headerRight}>
          {user?.features?.includes("create:studio") && (
            <Link href="/estudios/novo" className={styles.btnPrimary}>
              <PlusIcon size={14} /> Criar estúdio
            </Link>
          )}

          {user && (
            <div className={styles.feedTabs} role="tablist" aria-label="Filtros de estúdios">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "all"}
                className={`${styles.feedTab} ${tab === "all" ? styles.feedTabActive : ""}`}
                onClick={() => setTab("all")}
              >
                Descubra
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "following"}
                className={`${styles.feedTab} ${tab === "following" ? styles.feedTabActive : ""}`}
                onClick={() => setTab("following")}
              >
                Seguindo
              </button>
            </div>
          )}
        </div>
      </header>

      {/* LOADING */}
      {isLoading && (
        <div className={styles.loadingState} role="status" aria-live="polite">
          <Spinner size="medium" />
          <span>Carregando...</span>
        </div>
      )}

      {/* EMPTY STATE */}
      {!isLoading && activeList.length === 0 && (
        <div className={styles.emptyState} role="status" aria-live="polite">
          <OrganizationIcon size={40} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>{emptyTitle}</p>
          <p className={styles.emptyDescription}>{emptyDescription}</p>
        </div>
      )}

      {/* GRID */}
      {!isLoading && activeList.length > 0 && (
        <>
          <ul className={styles.studioGrid}>
            {activeList.map((studio) => (
              <StudioCard key={studio.id} studio={studio} />
            ))}
          </ul>

          {tab === "all" && allHasMore && (
            <div className={styles.loadMore}>
              <button className={styles.btnOutline} disabled={allLoading} onClick={() => setAllPage((p) => p + 1)}>
                {allLoading ? <Spinner size="small" /> : "Carregar mais"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StudioCard({ studio }) {
  return (
    <li className={styles.studioCard}>
      <Link href={`/estudios/${studio.slug}`} className={styles.cardLink}>
        <div className={styles.cardBanner}>
          {studio.banner_url ? <img src={studio.banner_url} alt="" className={styles.bannerImg} /> : <div className={styles.bannerPlaceholder} />}
        </div>
        <div className={styles.cardBody}>
          <div className={styles.cardLogoRow}>
            <Avatar src={studio.logo_url || undefined} size={48} alt={studio.name} className={styles.studioLogo} />
          </div>
          <h2 className={styles.studioName}>{studio.name}</h2>
          {studio.pitch && <p className={styles.studioPitch}>{studio.pitch}</p>}
          <div className={styles.cardMeta}>
            <span className={styles.metaItem}>
              <PeopleIcon size={13} />
              {studio.member_count ?? 0} {studio.member_count === 1 ? "membro" : "membros"}
            </span>
            {(studio.follower_count ?? 0) > 0 && (
              <span className={styles.metaItem}>
                {studio.follower_count} {studio.follower_count === 1 ? "seguidor" : "seguidores"}
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}
