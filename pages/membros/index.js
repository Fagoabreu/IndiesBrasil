import Head from "next/head";
import { useEffect, useState } from "react";
import { Heading, TextInput, Spinner } from "@primer/react";
import MemberCard from "@/components/MemberCard/MemberCard";
import styles from "./MembersPage.module.css";
import { SITE_URL, SITE_NAME, SITE_LOCALE, DEFAULT_OG_IMAGE, TWITTER_HANDLE } from "@/lib/seo";

const PAGE_TITLE = "Membros da Comunidade Indie Brasileira | Indies Brasil";
const PAGE_DESCRIPTION = "Conheça desenvolvedores, artistas, designers e criadores de jogos independentes do Brasil. Encontre talentos e parceiros para seu próximo projeto indie.";
const PAGE_URL = `${SITE_URL}/membros`;

export default function MembersPage() {
  const [members, setMembers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

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

  function handleSearch(value) {
    setSearch(value);
    const term = value.toLowerCase();

    const results = members.filter((u) => u.name?.toLowerCase().includes(term) || u.username?.toLowerCase().includes(term));

    setFiltered(results);
  }

  const memberCount = filtered.length.toLocaleString("pt-BR");
  const memberWord = filtered.length === 1 ? "membro" : "membros";

  return (
    <div className={styles.page}>
      <Head>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_DESCRIPTION} />
        <meta name="keywords" content="desenvolvedores indie brasil, artistas gamedev, comunidade jogos independentes, rede social gamedev, encontrar parceiro indie game, talentos jogos brasil" />
        <link rel="canonical" href={PAGE_URL} />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={PAGE_URL} />
        <meta property="og:title" content={PAGE_TITLE} />
        <meta property="og:description" content={PAGE_DESCRIPTION} />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta property="og:locale" content={SITE_LOCALE} />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content={TWITTER_HANDLE} />
        <meta name="twitter:title" content={PAGE_TITLE} />
        <meta name="twitter:description" content={PAGE_DESCRIPTION} />
        <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
      </Head>

      {/* PAGE HEADER */}
      <header className={styles.pageHeader}>
        <div className={styles.headerTitle}>
          <Heading as="h2">Membros</Heading>
          {!loading && (
            <span className={styles.memberCount} aria-live="polite">
              {memberCount} {memberWord}
            </span>
          )}
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

      {/* LOADING */}
      {loading && (
        <div className={styles.loadingState} role="status" aria-live="polite">
          <Spinner size="medium" />
          <span>Carregando membros...</span>
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && filtered.length === 0 && (
        <div className={styles.emptyState} role="status" aria-live="polite">
          <p className={styles.emptyTitle}>{search ? "Nenhum membro encontrado" : "Ainda não há membros"}</p>
          <p className={styles.emptyDescription}>
            {search ? `Nenhum resultado para "${search}". Tente outro termo.` : "Seja o primeiro a fazer parte da comunidade!"}
          </p>
        </div>
      )}

      {/* GRID DE CARDS */}
      {!loading && filtered.length > 0 && (
        <div className={styles.grid}>
          {filtered.map((user) => (
            <MemberCard key={user.id} user={user} />
          ))}
        </div>
      )}
    </div>
  );
}
