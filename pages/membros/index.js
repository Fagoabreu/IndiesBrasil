import SeoHead from "@/components/SeoHead";
import { useEffect, useState } from "react";
import { Heading, TextInput, Spinner } from "@primer/react";
import MemberCard from "@/components/MemberCard/MemberCard";
import styles from "./MembersPage.module.css";
import { SITE_URL } from "@/lib/seo";
import { useUser } from "@/context/UserContext";

const PAGE_TITLE = "Membros da Comunidade Indie Brasileira | Indies Brasil";
const PAGE_DESCRIPTION =
  "Conheça desenvolvedores, artistas, designers e criadores de jogos independentes do Brasil. Encontre talentos e parceiros para seu próximo projeto indie.";
const PAGE_URL = `${SITE_URL}/membros`;

export default function MembersPage() {
  const { user } = useUser();
  const [members, setMembers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/users", { credentials: "include" });
        const data = await res.json();
        if (res.status == 200) {
          setMembers(data || []);
          setFiltered(data || []);
        } else {
          console.error("Erro ao carregar membros", data);
        }
      } catch (e) {
        console.error("Erro ao carregar membros", e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoadingFollowing(true);

    async function loadFollowing() {
      try {
        const res = await fetch("/api/v1/users?isfollowing=true", { credentials: "include" });
        const data = await res.json();
        if (res.ok) {
          setFollowing(data || []);
        }
      } catch (e) {
        console.error("Erro ao carregar seguindo", e);
      } finally {
        setLoadingFollowing(false);
      }
    }

    loadFollowing();
  }, [user]);

  function handleSearch(value) {
    setSearch(value);
    const term = value.toLowerCase();

    const results = members.filter((u) => u.name?.toLowerCase().includes(term) || u.username?.toLowerCase().includes(term));

    setFiltered(results);
  }

  const activeList = tab === "following" ? following : filtered;
  const isLoading = tab === "following" ? loadingFollowing : loading;

  const countNum = activeList.length;
  const countStr = countNum.toLocaleString("pt-BR");
  const singular = tab === "following" ? "pessoa" : "membro";
  const plural = tab === "following" ? "pessoas" : "membros";
  const countWord = countNum === 1 ? singular : plural;

  let emptyTitle;
  if (tab === "following") {
    emptyTitle = "Você ainda não segue ninguém";
  } else if (search) {
    emptyTitle = "Nenhum membro encontrado";
  } else {
    emptyTitle = "Ainda não há membros";
  }

  let emptyDescription;
  if (tab === "following") {
    emptyDescription = 'Vá para "Descubra" e comece a seguir!';
  } else if (search) {
    emptyDescription = `Nenhum resultado para "${search}". Tente outro termo.`;
  } else {
    emptyDescription = "Seja o primeiro a fazer parte da comunidade!";
  }

  return (
    <div className={styles.page}>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} />

      {/* PAGE HEADER */}
      <header className={styles.pageHeader}>
        <div className={styles.headerBlock}>
          <div className={styles.headerTitle}>
            <Heading as="h2">Membros</Heading>
            {!isLoading && (
              <span className={styles.memberCount} aria-live="polite">
                {countStr} {countWord}
              </span>
            )}
          </div>
          <p className={styles.pageSubtitle}>Conheça as pessoas que constroem jogos indie no Brasil.</p>

          {tab === "all" && (
            <div className={styles.searchWrapper}>
              <TextInput
                aria-label="Pesquisar membros"
                placeholder="Pesquisar por nome ou username..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                leadingVisual="search"
                className={styles.searchInput}
              />
            </div>
          )}
        </div>

        {user && (
          <div className={styles.feedTabs} role="tablist" aria-label="Filtros de membros">
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
          <p className={styles.emptyTitle}>{emptyTitle}</p>
          <p className={styles.emptyDescription}>{emptyDescription}</p>
        </div>
      )}

      {/* GRID */}
      {!isLoading && activeList.length > 0 && (
        <div className={styles.grid}>
          {activeList.map((u) => (
            <MemberCard key={u.id} user={u} />
          ))}
        </div>
      )}
    </div>
  );
}
