"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { TextInput, Spinner } from "@primer/react";
import { DeviceMobileIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import GameCard from "@/components/Card/GameCard";
import { PageHeader, PageShell, TabBar } from "@/components/ui/organisms";
import StudioPublishNotice from "@/components/Studio/StudioPublishNotice/StudioPublishNotice";
import { useUser } from "@/context/UserContext";
import { pageTitle, SITE_URL } from "@/lib/seo";
import { RATING_LABELS, RATING_ORDER } from "@/lib/rating-constants";
import { AI_USAGE_LEVELS, formatAiLevelLabel } from "@/lib/ai-usage";
import styles from "./index.module.css";

const PAGE_TITLE = pageTitle("Jogos");
const PAGE_DESCRIPTION = "Descubra jogos criados por desenvolvedores indie brasileiros.";
const PAGE_URL = `${SITE_URL}/jogos`;

/** Abas do feed — no escopo do módulo para não recriar o array a cada render. */
const FEED_TABS = [
  { id: "all", label: "Descubra" },
  { id: "following", label: "Seguindo" },
];

const STAGES = {
  concept: "Conceito",
  prototype: "Protótipo",
  alpha: "Alpha",
  beta: "Beta",
  early_access: "Acesso Antecipado",
  released: "Lançado",
  cancelled: "Cancelado",
};

const LIMIT = 20;

/**
 * Lê um filtro da URL (`/jogos?genre=Ação`, `/jogos?tag=emocional`).
 *
 * É o que faz o link do chip funcionar: sem isso a ficha do jogo oferecia
 * "ver todos os jogos de Ação" e a listagem abria sem filtro nenhum — o pior
 * tipo de link, o que parece ter funcionado. A página já usa `getServerSideProps`
 * (e não prerender), então `router.query` está preenchido no primeiro render do
 * cliente.
 */
function queryFilter(query, key) {
  const value = query?.[key];
  return typeof value === "string" ? value : "";
}

/**
 * A primeira página da listagem vem do servidor.
 *
 * Sem isso o HTML desta rota era um spinner: os cards só existiam depois que o
 * navegador rodava o JavaScript e chamava `/api/v1/games`. O Google até executa
 * JavaScript, mas então não havia nenhum `<a href="/jogos/...">` para descobrir
 * — a listagem não linkava para nada antes de rodar.
 *
 * Chamada ao model direto, e não à própria API por HTTP: é o mesmo dado que
 * `/api/v1/games` devolve (a rota repassa as linhas de `findAll` sem
 * enriquecimento) e evita uma requisição da máquina para ela mesma.
 *
 * O `JSON.parse(JSON.stringify(...))` converte os `Date` que o node-pg devolve
 * (ex.: `created_at`) em ISO — o Next não serializa `Date` em props.
 */
export async function getServerSideProps() {
  // `getServerSideProps` não passa pelo middleware (`controller.canRequest`),
  // então consulta a mesma lista do controller antes de ler o model. É o que
  // mantém "quem lê o quê" em um lugar só: revogar `read:game:all` do anônimo
  // derruba a API e esta página juntas (ver `infra/controller.js`).
  const { anonymousCan } = await import("@/infra/controller");
  if (!anonymousCan("read:game:all")) return { notFound: true };

  const game = (await import("@/models/game")).default;
  const gameGenre = (await import("@/models/gameGenre")).default;
  const gameTag = (await import("@/models/gameTag")).default;

  const [rows, genreTree, popularTags] = await Promise.all([
    game.findAll({ page: 1, limit: LIMIT }),
    // Catálogo e tags vêm no servidor junto da primeira página: o `<select>`
    // precisa das opções no HTML servido, e buscar no cliente deixaria o filtro
    // vazio no primeiro paint.
    gameGenre.findTree(),
    gameTag.findPopular(20),
  ]);

  // `JSON.parse(JSON.stringify(...))` nos três: `created_at`/`updated_at` chegam
  // como `Date` (node-pg) e o Next não serializa — a página respondia 500 com
  // "Error serializing `.genreTree[0].created_at`". É a mesma armadilha já
  // documentada para a ficha de jogo de mesa.
  return {
    props: {
      initialGames: JSON.parse(JSON.stringify(rows)),
      genreTree: JSON.parse(JSON.stringify(genreTree)),
      popularTags: JSON.parse(JSON.stringify(popularTags)),
    },
  };
}

export default function JogosPage({ initialGames, genreTree = [], popularTags = [] }) {
  const router = useRouter();
  const { user } = useUser();
  const [tab, setTab] = useState("all");

  // aba "Descubra"
  const [allGames, setAllGames] = useState(initialGames);
  const [allLoading, setAllLoading] = useState(false);
  const [allPage, setAllPage] = useState(1);
  const [allHasMore, setAllHasMore] = useState(initialGames.length === LIMIT);
  const [search, setSearch] = useState(() => queryFilter(router.query, "search"));
  const [genre, setGenre] = useState(() => queryFilter(router.query, "genre"));
  const [tag, setTag] = useState(() => queryFilter(router.query, "tag"));
  const [stage, setStage] = useState(() => queryFilter(router.query, "stage"));
  const [contentRating, setContentRating] = useState("");
  const [aiLevel, setAiLevel] = useState("");

  // aba "Seguindo"
  const [followingGames, setFollowingGames] = useState([]);
  const [followingLoading, setFollowingLoading] = useState(false);

  const loadAll = useCallback(async (pageNum, searchQuery, genreQuery, stageQuery, ratingQuery, aiQuery, tagQuery = "") => {
    setAllLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum,
        limit: LIMIT,
        search: searchQuery,
        genre: genreQuery,
        stage: stageQuery,
        tag: tagQuery,
        content_rating: ratingQuery,
        ai_level: aiQuery,
      });
      const res = await fetch(`/api/v1/games?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setAllGames((prev) => (pageNum === 1 ? data : [...prev, ...data]));
      setAllHasMore(data.length === LIMIT);
    } finally {
      setAllLoading(false);
    }
  }, []);

  // A primeira página já veio do servidor. O efeito de filtros roda também na
  // montagem, e refazer ali a mesma busca jogaria `allLoading` para `true` —
  // trocando os cards do HTML servido por um spinner bem na primeira passada do
  // rastreador. Só a primeira execução (com os filtros ainda vazios) é pulada;
  // qualquer digitação posterior carrega normalmente.
  const skipInitialLoad = useRef(true);

  // Debounce filters for "Descubra"
  useEffect(() => {
    const t = setTimeout(() => {
      setAllPage(1);

      if (skipInitialLoad.current) {
        skipInitialLoad.current = false;
        if (!search && !genre && !tag && !stage && !contentRating && !aiLevel) return;
      }

      loadAll(1, search, genre, stage, contentRating, aiLevel, tag);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, genre, tag, stage, contentRating, aiLevel]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (allPage > 1) loadAll(allPage, search, genre, stage, contentRating, aiLevel, tag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPage]);

  // Load followed games when user logs in
  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFollowingLoading(true);
    fetch("/api/v1/games?isfollowing=true", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setFollowingGames(Array.isArray(data) ? data : []))
      .catch(() => setFollowingGames([]))
      .finally(() => setFollowingLoading(false));
  }, [user]);

  const activeList = tab === "following" ? followingGames : allGames;
  const isLoading = tab === "following" ? followingLoading : allLoading;

  const countNum = activeList.length;
  const countStr = countNum.toLocaleString("pt-BR");
  const countWord = countNum === 1 ? "jogo" : "jogos";

  let emptyTitle;
  if (tab === "following") {
    emptyTitle = "Você ainda não segue nenhum jogo";
  } else if (search || genre || tag || stage || contentRating || aiLevel) {
    emptyTitle = "Nenhum jogo encontrado";
  } else {
    emptyTitle = "Ainda não há jogos cadastrados";
  }

  // O estado vazio sem conteúdo mostra o caminho de publicação, não um convite
  // sem destino: "cadastre o seu jogo" não existe sem um estúdio, e é o
  // `StudioPublishNotice` que explica isso e leva ao lugar certo.
  const hasFilters = Boolean(search || genre || tag || stage || contentRating || aiLevel);

  return (
    <PageShell width="wide">
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} />

      <PageHeader
        eyebrow="Descobrir"
        title="Jogos"
        badge={isLoading ? null : `${countStr} ${countWord}`}
        subtitle="Descubra projetos de desenvolvedores indie brasileiros."
        tabs={user ? <TabBar ariaLabel="Filtros de jogos" items={FEED_TABS} value={tab} onChange={setTab} /> : null}
      >
        {tab === "all" && (
          <>
            <TextInput
              aria-label="Pesquisar jogos"
              placeholder="Pesquisar por nome, descrição ou tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leadingVisual="search"
              className={styles.searchInput}
            />
            <div className={styles.selectRow}>
              {/*
               * Gênero › subgênero em `<optgroup>`: 75 nós em chips viram uma
               * parede. O pai aparece como opção **de propósito** — filtrar por
               * "Ação" devolve os jogos marcados com qualquer subgênero dele
               * (o SQL casa `name` ou `parent_name`).
               */}
              <select className={styles.select} value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Filtrar por gênero">
                <option value="">Todos os gêneros</option>
                {genreTree.map((parent) => (
                  <optgroup key={parent.name} label={parent.name}>
                    <option value={parent.name}>{parent.name} (tudo)</option>
                    {parent.children.map((child) => (
                      <option key={child.name} value={child.name}>
                        {child.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {popularTags.length > 0 && (
                <select className={styles.select} value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filtrar por tag">
                  <option value="">Todas as tags</option>
                  {popularTags.map((item) => (
                    <option key={item.name} value={item.name}>
                      #{item.name} ({item.game_count})
                    </option>
                  ))}
                </select>
              )}
              <select className={styles.select} value={stage} onChange={(e) => setStage(e.target.value)}>
                <option value="">Todas as fases</option>
                {Object.entries(STAGES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <select className={styles.select} value={contentRating} onChange={(e) => setContentRating(e.target.value)}>
                <option value="">Todas as classificações</option>
                {RATING_ORDER.map((rating) => (
                  <option key={rating} value={rating}>
                    {RATING_LABELS[rating]}
                  </option>
                ))}
                <option value="none">Não classificados</option>
              </select>
              <select className={styles.select} value={aiLevel} onChange={(e) => setAiLevel(e.target.value)}>
                <option value="">Todo uso de IA</option>
                {AI_USAGE_LEVELS.map((item) => (
                  <option key={item.level} value={String(item.level)}>
                    {formatAiLevelLabel(item.level)}
                  </option>
                ))}
                <option value="none">Não informado</option>
              </select>
            </div>
          </>
        )}
      </PageHeader>

      {/* A listagem é onde a intenção de publicar aparece — o aviso fica antes
          dos cards para não ser confundido com filtro (ver o componente). */}
      {tab === "all" && <StudioPublishNotice tab="games" />}

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
          <DeviceMobileIcon size={40} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>{emptyTitle}</p>
          {tab === "following" ? (
            <p className={styles.emptyDescription}>{'Vá para "Descubra" e comece a seguir!'}</p>
          ) : hasFilters ? (
            <p className={styles.emptyDescription}>Tente outros filtros.</p>
          ) : (
            <StudioPublishNotice variant="empty" tab="games" />
          )}
        </div>
      )}

      {/* GRID */}
      {!isLoading && activeList.length > 0 && (
        <>
          <div className={styles.grid}>
            {activeList.map((g, i) => (
              <GameCard key={g.id} game={g} priority={i === 0} />
            ))}
          </div>

          {tab === "all" && allHasMore && (
            <div className={styles.loadMoreWrapper}>
              <button className={styles.loadMore} disabled={allLoading} onClick={() => setAllPage((p) => p + 1)}>
                {allLoading ? <Spinner size="small" /> : "Carregar mais"}
              </button>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
