"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import Image from "next/image";
import Link from "next/link";
import { Heading, Spinner } from "@primer/react";
import { BroadcastIcon, PersonIcon, SyncIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import { SITE_URL } from "@/lib/seo";
import styles from "./index.module.css";

const PAGE_TITLE = "Streams — Indies Brasil";
const PAGE_DESCRIPTION =
  "Assista aos estúdios de jogos indie brasileiros ao vivo na Twitch e YouTube.";
const PAGE_URL = `${SITE_URL}/streams`;

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // auto-refresh every 5 minutes

function formatViewerCount(count) {
  if (!count) return null;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
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

function getStreamUrl(studio) {
  if (studio.active_platform === "twitch")
    return `https://twitch.tv/${studio.twitch_channel}`;
  if (studio.active_platform === "youtube")
    return `https://youtube.com/channel/${studio.youtube_channel_id}`;
  if (studio.twitch_channel)
    return `https://twitch.tv/${studio.twitch_channel}`;
  return `https://youtube.com/channel/${studio.youtube_channel_id}`;
}

function getPlatformLabel(studio) {
  if (studio.active_platform === "twitch") return "Twitch";
  if (studio.active_platform === "youtube") return "YouTube";
  if (studio.twitch_channel && !studio.youtube_channel_id) return "Twitch";
  if (studio.youtube_channel_id && !studio.twitch_channel) return "YouTube";
  return "Twitch";
}

function getPlatformStyleClass(studio) {
  const platform =
    studio.active_platform ?? (studio.twitch_channel ? "twitch" : "youtube");
  return styles[`platform_${platform}`];
}

function getEmbedSrc(studio, hostname) {
  const platform =
    studio.active_platform ?? (studio.twitch_channel ? "twitch" : "youtube");
  if (platform === "twitch" && studio.twitch_channel) {
    return `https://player.twitch.tv/?channel=${studio.twitch_channel}&parent=${hostname}&muted=1`;
  }
  if (platform === "youtube" && studio.youtube_channel_id && studio.is_live) {
    return `https://www.youtube.com/embed/live_stream?channel=${studio.youtube_channel_id}&autoplay=1&mute=1`;
  }
  return null;
}

function ThumbnailArea({ studio, featured, embedSrc, onPlay }) {
  return (
    <>
      {studio.thumbnail_url ? (
        <Image
          src={studio.thumbnail_url}
          alt={`Thumbnail de ${studio.name}`}
          fill
          sizes={
            featured
              ? "(max-width: 900px) 100vw, 640px"
              : "(max-width: 600px) 100vw, 320px"
          }
          className={styles.thumbImg}
        />
      ) : (
        <div className={styles.thumbPlaceholder}>
          <BroadcastIcon size={featured ? 40 : 24} />
        </div>
      )}
      {studio.is_live && <span className={styles.liveBadge}>AO VIVO</span>}
      {studio.viewer_count != null && (
        <span className={styles.viewerBadge}>
          <PersonIcon size={12} />
          {formatViewerCount(studio.viewer_count)}
        </span>
      )}
      {embedSrc && (
        <button
          className={styles.playBtn}
          onClick={onPlay}
          aria-label={`${studio.is_live ? "Assistir live" : "Abrir canal"} de ${studio.name}`}
        >
          <span className={styles.playIcon}>▶</span>
          <span>{studio.is_live ? "Assistir ao vivo" : "Abrir canal"}</span>
        </button>
      )}
    </>
  );
}

ThumbnailArea.propTypes = {
  studio: studioPropType.isRequired,
  featured: PropTypes.bool,
  embedSrc: PropTypes.string,
  onPlay: PropTypes.func.isRequired,
};

ThumbnailArea.defaultProps = {
  featured: false,
  embedSrc: null,
};

function StreamCard({ studio, featured, hostname }) {
  const [playing, setPlaying] = useState(false);
  const streamUrl = getStreamUrl(studio);
  const platformLabel = getPlatformLabel(studio);
  const platformClass = getPlatformStyleClass(studio);
  const avatarSize = featured ? 44 : 36;
  const embedSrc = getEmbedSrc(studio, hostname);

  const avatar = studio.logo_url ? (
    <Image
      src={studio.logo_url}
      alt={studio.name}
      width={avatarSize}
      height={avatarSize}
      className={styles.avatarImg}
    />
  ) : (
    <div
      className={styles.avatarPlaceholder}
      style={{ width: avatarSize, height: avatarSize }}
    >
      {studio.name[0]}
    </div>
  );

  const thumbContent =
    playing && embedSrc ? (
      <iframe
        src={embedSrc}
        title={
          studio.is_live
            ? `Transmissão ao vivo de ${studio.name}`
            : `Canal de ${studio.name}`
        }
        allow="autoplay; fullscreen"
        allowFullScreen
        className={styles.embedFrame}
      />
    ) : (
      <ThumbnailArea
        studio={studio}
        featured={featured}
        embedSrc={embedSrc}
        onPlay={() => setPlaying(true)}
      />
    );

  return (
    <div className={featured ? styles.featuredCard : styles.streamCard}>
      <div className={featured ? styles.featuredThumb : styles.streamThumb}>
        {thumbContent}
      </div>

      <div className={styles.streamInfo}>
        <a
          href={streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.streamInfoLink}
        >
          <div className={styles.streamAvatar}>{avatar}</div>
          <div className={styles.streamMeta}>
            <p className={styles.streamTitle}>
              {studio.stream_title ||
                (studio.is_live ? "Transmissão ao vivo" : "Offline")}
            </p>
            <p className={styles.streamStudio}>{studio.name}</p>
            {studio.category_name && (
              <span className={styles.categoryTag}>{studio.category_name}</span>
            )}
            <span className={`${styles.platformBadge} ${platformClass}`}>
              {platformLabel}
            </span>
          </div>
        </a>
        {playing && (
          <button
            className={styles.stopBtn}
            onClick={() => setPlaying(false)}
            aria-label="Fechar player"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

StreamCard.propTypes = {
  studio: studioPropType.isRequired,
  featured: PropTypes.bool,
  hostname: PropTypes.string,
};

StreamCard.defaultProps = {
  featured: false,
  hostname: "localhost",
};

export default function StreamsPage() {
  useUser();
  const [studios, setStudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [hostname] = useState(() => globalThis.location.hostname);
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
      <SeoHead
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        url={PAGE_URL}
      />

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
            <p className={styles.pageSubtitle}>
              Estúdios brasileiros transmitindo ao vivo agora
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              className={styles.refreshBtn}
              onClick={handleRefresh}
              disabled={refreshing}
              title="Atualizar status das transmissões"
            >
              <SyncIcon
                size={14}
                className={refreshing ? styles.spinning : ""}
              />
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
              <span className={styles.liveDot} /> Canais ao vivo que achamos que
              você vai gostar
            </h2>

            {/* Featured (first live stream) */}
            {featuredStudio && (
              <div className={styles.featuredRow}>
                <StreamCard
                  studio={featuredStudio}
                  featured
                  hostname={hostname}
                />
              </div>
            )}

            {/* Rest of live streams grid */}
            {otherLive.length > 0 && (
              <div className={styles.streamsGrid}>
                {otherLive.map((s) => (
                  <StreamCard key={s.id} studio={s} hostname={hostname} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ---- No live streams ---- */}
        {!loading && liveStudios.length === 0 && studios.length > 0 && (
          <div className={styles.noLiveSection}>
            <BroadcastIcon size={32} className={styles.noLiveIcon} />
            <p className={styles.noLiveTitle}>
              Nenhum canal ao vivo no momento
            </p>
            <p className={styles.noLiveDesc}>
              Quando um estúdio iniciar uma transmissão, ela aparecerá aqui em
              destaque.
            </p>
          </div>
        )}

        {/* ---- Empty (no studios registered) ---- */}
        {!loading && studios.length === 0 && (
          <div className={styles.emptyState}>
            <BroadcastIcon size={40} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>
              Nenhum estúdio com canal cadastrado ainda
            </p>
            <p className={styles.emptyDescription}>
              Estúdios podem cadastrar seus canais da Twitch ou YouTube nas
              configurações do estúdio.
            </p>
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
                <StreamCard key={s.id} studio={s} hostname={hostname} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
