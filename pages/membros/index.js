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

  const discoverCount = filtered.length.toLocaleString("pt-BR");
  const discoverWord = filtered.length === 1 ? "membro" : "membros";
  const followingCount = following.length.toLocaleString("pt-BR");
  const followingWord = following.length === 1 ? "pessoa" : "pessoas";

  return (
    <div className={styles.page}>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} />

      {/* PAGE HEADER */}
      <header className={styles.pageHeader}>
        <div className={styles.headerTitle}>
          <Heading as="h2">Membros</Heading>
        </div>
        <p className={styles.pageSubtitle}>Conheça as pessoas que constroem jogos indie no Brasil.</p>

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
      </header>

      {/* SEGUINDO */}
      {user && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleRow}>
              <span className={styles.sectionLabel}>Seguindo</span>
              {!loadingFollowing && (
                <span className={styles.sectionCount} aria-live="polite">
                  {followingCount} {followingWord}
                </span>
              )}
            </div>
          </div>

          {loadingFollowing && (
            <div className={styles.loadingState} role="status" aria-live="polite">
              <Spinner size="medium" />
              <span>Carregando...</span>
            </div>
          )}

          {!loadingFollowing && following.length === 0 && (
            <div className={styles.emptyState} role="status" aria-live="polite">
              <p className={styles.emptyTitle}>Você ainda não segue ninguém</p>
              <p className={styles.emptyDescription}>Descubra novos membros abaixo e comece a seguir!</p>
            </div>
          )}

          {!loadingFollowing && following.length > 0 && (
            <div className={styles.grid}>
              {following.map((u) => (
                <MemberCard key={u.id} user={u} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* DESCUBRA */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleRow}>
            <span className={styles.sectionLabel}>Descubra</span>
            {!loading && (
              <span className={styles.sectionCount} aria-live="polite">
                {discoverCount} {discoverWord}
              </span>
            )}
          </div>
        </div>

        {loading && (
          <div className={styles.loadingState} role="status" aria-live="polite">
            <Spinner size="medium" />
            <span>Carregando membros...</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className={styles.emptyState} role="status" aria-live="polite">
            <p className={styles.emptyTitle}>{search ? "Nenhum membro encontrado" : "Ainda não há membros"}</p>
            <p className={styles.emptyDescription}>
              {search ? `Nenhum resultado para "${search}". Tente outro termo.` : "Seja o primeiro a fazer parte da comunidade!"}
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className={styles.grid}>
            {filtered.map((u) => (
              <MemberCard key={u.id} user={u} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
