import SeoHead from "@/components/SeoHead";
import { useCallback, useEffect, useRef, useState } from "react";
import { Heading, TextInput, Spinner } from "@primer/react";
import MemberCard from "@/components/MemberCard/MemberCard";
import InactiveMemberRow from "@/components/MemberCard/InactiveMemberRow";
// O wrapper da lista mora no módulo do componente (é o `<ul>` das linhas); a
// página importa o mesmo módulo em vez de repetir a regra.
import inactiveListStyles from "@/components/MemberCard/InactiveMemberRow.module.css";
import styles from "./MembersPage.module.css";
import { SITE_URL } from "@/lib/seo";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/router";
import useInView from "@/hooks/useInView";

const PAGE_TITLE = "Membros da Comunidade Indie Brasileira | Indies Brasil";
const PAGE_DESCRIPTION =
  "Conheça desenvolvedores, artistas, designers e criadores de jogos independentes do Brasil. Encontre talentos e parceiros para seu próximo projeto indie.";
const PAGE_URL = `${SITE_URL}/membros`;

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

export default function MembersPage() {
  const router = useRouter();
  const { user } = useUser();
  // A aba "Inativos" é ferramenta de administração: a rota também exige
  // `read:admin`, e esta condição só evita mostrar um botão que daria 403.
  const isAdmin = Boolean(user?.features?.includes("read:admin"));
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(null);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState("all");
  const cursorRef = useRef(null);
  const loadingMoreRef = useRef(false);

  // Quem perde `read:admin` com a aba aberta não pode continuar nela: a próxima
  // requisição responderia 403 e a tela ficaria num erro sem saída. Derivar é
  // melhor que corrigir em efeito — evita `setState` síncrono no corpo do
  // efeito, que o lint do projeto recusa (`react-hooks/set-state-in-effect`).
  const activeTab = tab === "inactive" && !isAdmin ? "all" : tab;

  // Sentinel para infinite scroll
  const [sentinelRef, isSentinelVisible] = useInView({
    threshold: 0,
    rootMargin: "0px 0px 200px 0px",
  });

  // Hidrata a busca a partir de ?q= antes do primeiro fetch — permite
  // compartilhar a URL já filtrada. `hydrated` também serve de trava para o
  // debounce não apagar o ?q= recém-lido antes do input ser preenchido.
  useEffect(() => {
    if (!router.isReady || hydrated) return;
    const initialQ = typeof router.query.q === "string" ? router.query.q : "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(initialQ);
    setAppliedSearch(initialQ);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hidrata uma única vez, quando o router fica pronto
  }, [router.isReady, hydrated]);

  // Debounce: digitação -> termo aplicado na busca + sync de ?q= na URL
  useEffect(() => {
    if (!hydrated) return;

    const timer = setTimeout(() => {
      setAppliedSearch(search);

      // A URL é atualizada via history.replaceState (e não router.replace)
      // porque `pages/_app.js` usa `key={router.asPath}`: qualquer navegação,
      // mesmo shallow, remontaria a página — perdendo o foco do input e
      // disparando um fetch extra a cada termo digitado.
      const { pathname, search: currentSearch } = window.location;
      const params = new URLSearchParams(currentSearch);

      if (search) {
        params.set("q", search);
      } else {
        params.delete("q");
      }

      const query = params.toString();
      const nextUrl = query ? `${pathname}?${query}` : pathname;

      if (nextUrl !== `${pathname}${currentSearch}`) {
        window.history.replaceState(window.history.state, "", nextUrl);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search, hydrated]);

  // Monta a URL conforme tab e busca ativas
  function buildUrl(cursor) {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    if (cursor) params.set("cursor", cursor);
    if (appliedSearch) params.set("q", appliedSearch);
    if (activeTab === "following") params.set("isfollowing", "true");
    // `status=inactive` é a lista administrativa: contas nunca ativadas cujo
    // token de ativação já venceu (a rota responde 403 para quem não é admin).
    if (activeTab === "inactive") params.set("status", "inactive");

    return `/api/v1/users?${params.toString()}`;
  }

  // Primeira página — reseta a lista
  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setHasMore(true);
    cursorRef.current = null;
    loadingMoreRef.current = false;

    try {
      const response = await fetch(buildUrl(null), { credentials: "include" });

      if (!response.ok) {
        console.error("Erro ao carregar membros", response.status);
        setItems([]);
        setTotal(0);
        setHasMore(false);
        return;
      }

      const data = await response.json();
      const list = data.items || [];
      setItems(list);
      setTotal(typeof data.total === "number" ? data.total : list.length);
      cursorRef.current = data.next_cursor || null;
      setHasMore(Boolean(data.has_more));
    } catch (e) {
      console.error("Erro ao carregar membros", e);
      setItems([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buildUrl é derivado de activeTab/appliedSearch
  }, [activeTab, appliedSearch]);

  // Próxima página — anexa à lista
  const fetchMoreMembers = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || !cursorRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const response = await fetch(buildUrl(cursorRef.current), { credentials: "include" });

      if (!response.ok) return;

      const data = await response.json();
      const list = data.items || [];

      if (list.length > 0) {
        setItems((prev) => [...prev, ...list]);
      }
      cursorRef.current = data.next_cursor || null;
      setHasMore(Boolean(data.has_more));
    } catch (e) {
      console.error("Erro ao carregar mais membros", e);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buildUrl é derivado de activeTab/appliedSearch
  }, [hasMore, activeTab, appliedSearch]);

  // Recarrega quando a tab ou a busca aplicada mudam
  useEffect(() => {
    if (!hydrated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMembers();
  }, [fetchMembers, hydrated]);

  // Infinite scroll: dispara quando o sentinel fica visível
  useEffect(() => {
    if (isSentinelVisible && hasMore && !loading && !loadingMoreRef.current) {
      fetchMoreMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchMoreMembers/loadingMoreRef estáveis; re-executar apenas quando visibilidade/cursor mudam
  }, [isSentinelVisible, hasMore, loading]);

  function handleSearch(value) {
    setSearch(value);
  }

  const isLoading = loading;

  const countNum = total ?? items.length;
  const countStr = countNum.toLocaleString("pt-BR");
  const isInactiveTab = activeTab === "inactive";
  const singular = isInactiveTab ? "conta" : activeTab === "following" ? "pessoa" : "membro";
  const plural = isInactiveTab ? "contas" : activeTab === "following" ? "pessoas" : "membros";
  const countWord = countNum === 1 ? singular : plural;

  let emptyTitle;
  if (isInactiveTab) {
    emptyTitle = "Nenhuma conta travada";
  } else if (activeTab === "following") {
    emptyTitle = "Você ainda não segue ninguém";
  } else if (search) {
    emptyTitle = "Nenhum membro encontrado";
  } else {
    emptyTitle = "Ainda não há membros";
  }

  let emptyDescription;
  if (isInactiveTab) {
    emptyDescription = "Toda conta pendente já foi ativada ou ainda tem token válido para ativar.";
  } else if (activeTab === "following") {
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

          {activeTab !== "following" && (
            <div className={styles.searchWrapper}>
              <TextInput
                aria-label="Pesquisar membros"
                placeholder={isInactiveTab ? "Pesquisar por username ou email..." : "Pesquisar por username ou bio..."}
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
              aria-selected={activeTab === "all"}
              className={`${styles.feedTab} ${activeTab === "all" ? styles.feedTabActive : ""}`}
              onClick={() => setTab("all")}
            >
              Descubra
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "following"}
              className={`${styles.feedTab} ${activeTab === "following" ? styles.feedTabActive : ""}`}
              onClick={() => setTab("following")}
            >
              Seguindo
            </button>
            {/* Só para administrador: a rota (`?status=inactive`) exige
                `read:admin`, e a lista expõe e-mail e vencimento de token. */}
            {isAdmin && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "inactive"}
                className={`${styles.feedTab} ${activeTab === "inactive" ? styles.feedTabActive : ""}`}
                onClick={() => setTab("inactive")}
                title="Contas nunca ativadas cujo token de ativação expirou"
              >
                Inativos
              </button>
            )}
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
      {!isLoading && items.length === 0 && (
        <div className={styles.emptyState} role="status" aria-live="polite">
          <p className={styles.emptyTitle}>{emptyTitle}</p>
          <p className={styles.emptyDescription}>{emptyDescription}</p>
        </div>
      )}

      {/* GRID */}
      {!isLoading && items.length > 0 && (
        <>
          {isInactiveTab ? (
            <ul className={inactiveListStyles.list}>
              {items.map((account) => (
                <InactiveMemberRow key={account.id} member={account} />
              ))}
            </ul>
          ) : (
            <div className={styles.grid}>
              {items.map((u) => (
                <MemberCard key={u.id} user={u} />
              ))}
            </div>
          )}

          {/* Loader da próxima página */}
          {loadingMore && (
            <div className={styles.loadingMore} role="status" aria-live="polite">
              {isInactiveTab ? "Carregando mais contas..." : "Carregando mais membros..."}
            </div>
          )}

          {/* Fim da lista */}
          {!hasMore && <p className={styles.endMessage}>Você chegou ao fim da lista.</p>}
        </>
      )}

      {/* Sentinel para infinite scroll — sempre no DOM para o IntersectionObserver funcionar */}
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
    </div>
  );
}
