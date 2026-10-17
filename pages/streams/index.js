import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import Image from "next/image";
import Link from "next/link";
import { Heading, Spinner } from "@primer/react";
import { ArrowUpRightIcon, BroadcastIcon, PersonIcon, SyncIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import LiveBadge from "@/components/Streams/LiveBadge";
import PlatformBadge from "@/components/Streams/PlatformBadge";
import { useUser } from "@/context/UserContext";
import { SITE_URL } from "@/lib/seo";
import { formatViewerCount, getPlatformLabel, getWatchUrl, resolvePlatformId } from "@/lib/streams";
import styles from "./index.module.css";

const PAGE_TITLE = "Streams — Indies Brasil";
const PAGE_DESCRIPTION = "Assista aos estúdios de jogos indie brasileiros ao vivo na Twitch e YouTube.";
const PAGE_URL = `${SITE_URL}/streams`;

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // auto-refresh every 5 minutes

/**
 * A listagem monta no servidor.
 *
 * O HTML precisa sair com `<a href="/streams/<slug>">` para cada canal: é na
 * página de assistir que o player vive, e nem o Google nem um preview de link
 * executam JavaScript para descobri-la (mesma escolha de `pages/jogos/index.js`).
 * O gate é `anonymousCan("read:studio")`, a feature da rota espelhada
 * (`GET /api/v1/streams`) — `getServerSideProps` não passa por middleware nenhum.
 */
export async function getServerSideProps() {
  const { anonymousCan } = await import("@/infra/controller");
  if (!anonymousCan("read:studio")) return { notFound: true };

  try {
    const stream = (await import("@/models/stream")).default;
    const studios = await stream.getStudiosWithStreams();

    return { props: { initialStudios: JSON.parse(JSON.stringify(studios)) } };
  } catch {
    // Banco indisponível: o cliente ainda tenta buscar em `/api/v1/streams` no
    // primeiro render, em vez de a página responder 500.
    return { props: { initialStudios: [] } };
  }
}

const studioPropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  slug: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  pitch: PropTypes.string,
  logo_url: PropTypes.string,
  twitch_channel: PropTypes.string,
  youtube_channel_id: PropTypes.string,
  is_live: PropTypes.bool,
  active_platform: PropTypes.oneOf(["twitch", "youtube", null]),
  viewer_count: PropTypes.number,
  stream_title: PropTypes.string,
  thumbnail_url: PropTypes.string,
  category_name: PropTypes.string,
});

function StreamCard({ studio, featured }) {
  const platformLabel = getPlatformLabel(studio);
  const watchUrl = getWatchUrl(studio);
  const avatarSize = featured ? 44 : 36;

  const avatar = studio.logo_url ? (
    <Image src={studio.logo_url} alt={studio.name} width={avatarSize} height={avatarSize} className={styles.avatarImg} />
  ) : (
    <div className={styles.avatarPlaceholder} style={{ width: avatarSize, height: avatarSize }}>
      {studio.name[0]}
    </div>
  );

  return (
    <div className={featured ? styles.featuredCard : styles.streamCard}>
      {/* Dois links para o mesmo destino (miniatura e ficha) em vez de um `<a>`
          envolvendo o card: o botão do canal original fica na linha da ficha e
          não pode ficar aninhado dentro do link da página de assistir. */}
      <Link href={`/streams/${studio.slug}`} className={styles.thumbLink}>
        <div className={featured ? styles.featuredThumb : styles.streamThumb}>
          {studio.thumbnail_url ? (
            <Image
              src={studio.thumbnail_url}
              alt={`Miniatura da transmissão de ${studio.name}`}
              fill
              sizes={featured ? "(max-width: 900px) 100vw, 640px" : "(max-width: 600px) 100vw, 320px"}
              className={styles.thumbImg}
            />
          ) : (
            <div className={styles.thumbPlaceholder}>
              <BroadcastIcon size={featured ? 40 : 24} />
            </div>
          )}
          {studio.is_live && (
            <span className={styles.thumbBadge}>
              <LiveBadge />
            </span>
          )}
          {studio.viewer_count != null && (
            <span className={styles.viewerBadge}>
              <PersonIcon size={12} />
              {formatViewerCount(studio.viewer_count)}
            </span>
          )}
          <span className={styles.thumbOverlay}>
            <span className={styles.playIcon}>▶</span>
            <span>{studio.is_live ? "Assistir ao vivo" : "Ver canal"}</span>
          </span>
        </div>
      </Link>

      <div className={styles.streamInfo}>
        <Link href={`/streams/${studio.slug}`} className={styles.streamInfoLink}>
          <div className={styles.streamAvatar}>{avatar}</div>
          <div className={styles.streamMeta}>
            <p className={styles.streamTitle}>{studio.stream_title || (studio.is_live ? "Transmissão ao vivo" : "Offline")}</p>
            <p className={styles.streamStudio}>{studio.name}</p>
            {studio.category_name && <span className={styles.categoryTag}>{studio.category_name}</span>}
            <PlatformBadge platform={resolvePlatformId(studio)} />
          </div>
        </Link>

        {watchUrl && (
          <a
            className={styles.externalBtn}
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={`Abrir canal na ${platformLabel}`}
            aria-label={`Abrir canal de ${studio.name} na ${platformLabel}`}
          >
            <ArrowUpRightIcon size={14} />
          </a>
        )}
      </div>
    </div>
  );
}

StreamCard.propTypes = {
  studio: studioPropType.isRequired,
  featured: PropTypes.bool,
};

export default function StreamsPage({ initialStudios }) {
  useUser();
  const [studios, setStudios] = useState(initialStudios);
  // Sem nada vindo do servidor o spinner faz sentido; com a lista pronta, não —
  // repetir o "Verificando canais ao vivo…" a cada navegação trocaria conteúdo
  // que já está na tela (mesmo padrão de `skipInitialLoad` em `pages/jogos`).
  const [loading, setLoading] = useState(initialStudios.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const refreshTimerRef = useRef(null);
  const didInitialRefreshRef = useRef(false);

  const fetchStudios = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/streams");
      if (res.ok) {
        setStudios(await res.json());
        setLastRefreshed(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetch("/api/v1/streams/refresh", {
        method: "POST",
        credentials: "include",
      });
      await fetchStudios();
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, fetchStudios]);

  useEffect(() => {
    // On first mount: call handleRefresh so Twitch/YouTube APIs are queried
    // immediately and live status is accurate from the start.
    // The ref guard prevents a re-call every time handleRefresh is recreated
    // (which happens on every refreshing state change).
    if (!didInitialRefreshRef.current) {
      didInitialRefreshRef.current = true;
      handleRefresh();
    }
    refreshTimerRef.current = setInterval(handleRefresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(refreshTimerRef.current);
  }, [handleRefresh]);

  const liveStudios = studios.filter((s) => s.is_live);
  const offlineStudios = studios.filter((s) => !s.is_live);

  const [featuredStudio, ...otherLive] = liveStudios;

  return (
    <>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} url={PAGE_URL} />

      <div className={styles.page}>
        {/* ---- Header ---- */}
        <div className={styles.pageHeader}>
          <div className={styles.headerBlock}>
            <div className={styles.headerTitle}>
              <Heading as="h1" sx={undefined} className={styles.heading}>
                Streams
              </Heading>
              {liveStudios.length > 0 && (
                <span className={styles.liveCount}>
                  <span className={styles.liveDot} />
                  {liveStudios.length} ao vivo
                </span>
              )}
            </div>
            <p className={styles.pageSubtitle}>Estúdios brasileiros transmitindo ao vivo agora</p>
          </div>

          <div className={styles.headerActions}>
            <button className={styles.refreshBtn} onClick={handleRefresh} disabled={refreshing} title="Atualizar status das transmissões">
              <SyncIcon size={14} className={refreshing ? styles.spinning : ""} />
              {refreshing ? "Atualizando…" : "Atualizar"}
            </button>
            {lastRefreshed && (
              <span className={styles.lastRefreshed}>
                Atualizado às{" "}
                {lastRefreshed.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>

        {/* ---- Loading ---- */}
        {loading && (
          <div className={styles.loadingState}>
            <Spinner size="medium" />
            <span>Verificando canais ao vivo…</span>
          </div>
        )}

        {/* ---- Live streams ---- */}
        {!loading && liveStudios.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.liveDot} /> Canais ao vivo que achamos que você vai gostar
            </h2>

            {/* Featured (first live stream) */}
            {featuredStudio && (
              <div className={styles.featuredRow}>
                <StreamCard studio={featuredStudio} featured />
              </div>
            )}

            {/* Rest of live streams grid */}
            {otherLive.length > 0 && (
              <div className={styles.streamsGrid}>
                {otherLive.map((s) => (
                  <StreamCard key={s.id} studio={s} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ---- No live streams ---- */}
        {!loading && liveStudios.length === 0 && studios.length > 0 && (
          <div className={styles.noLiveSection}>
            <BroadcastIcon size={32} className={styles.noLiveIcon} />
            <p className={styles.noLiveTitle}>Nenhum canal ao vivo no momento</p>
            <p className={styles.noLiveDesc}>Quando um estúdio iniciar uma transmissão, ela aparecerá aqui em destaque.</p>
          </div>
        )}

        {/* ---- Empty (no studios registered) ---- */}
        {!loading && studios.length === 0 && (
          <div className={styles.emptyState}>
            <BroadcastIcon size={40} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>Nenhum estúdio com canal cadastrado ainda</p>
            <p className={styles.emptyDescription}>Estúdios podem cadastrar seus canais da Twitch ou YouTube nas configurações do estúdio.</p>
            <Link href="/estudios" className={styles.emptyLink}>
              Ver estúdios
            </Link>
          </div>
        )}

        {/* ---- Offline studios ---- */}
        {!loading && offlineStudios.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Canais offline</h2>
            <div className={styles.streamsGrid}>
              {offlineStudios.map((s) => (
                <StreamCard key={s.id} studio={s} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

StreamsPage.propTypes = {
  initialStudios: PropTypes.arrayOf(studioPropType).isRequired,
};
