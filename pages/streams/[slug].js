import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import PropTypes from "prop-types";
import { Heading } from "@primer/react";
import { ArrowLeftIcon, ArrowUpRightIcon, BroadcastIcon, PersonIcon, ShareIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import ShareModal from "@/components/ShareModal/ShareModal";
import LiveBadge from "@/components/Streams/LiveBadge";
import PlatformBadge from "@/components/Streams/PlatformBadge";
import StreamPlayer from "@/components/Streams/StreamPlayer";
import { SITE_URL } from "@/lib/seo";
import { breadcrumbList, graph } from "@/lib/structured-data";
import {
  STREAM_THUMBNAIL_SIZE,
  formatCheckedAt,
  formatViewerCount,
  getEmbedUrl,
  getPlatformLabel,
  getWatchUrl,
  listStudioChannels,
  resolvePlatformId,
} from "@/lib/streams";
import styles from "./[slug].module.css";

/**
 * Página de assistir a um canal de estúdio — o "watch page" no estilo YouTube,
 * Kick e Twitch: player grande, as informações e as ações do canal embaixo e a
 * lista de outros canais ao lado.
 *
 * O endereço é o do **estúdio** (`/streams/<slug>`), não o da transmissão: ele
 * pode estar ao vivo na Twitch hoje e no YouTube amanhã, e o endereço continua o
 * mesmo — é ele que circula em link e fica no histórico de quem assiste.
 *
 * Montada no servidor: o HTML precisa do `<iframe>` do player, do título e do
 * canonical (um preview de link no Discord ou WhatsApp não executa JavaScript).
 * `getServerSideProps` não passa por middleware nenhum, então o gate é o
 * `anonymousCan` — a mesma lista que a rota `GET /api/v1/streams` consulta.
 */
export async function getServerSideProps(context) {
  // Mesma feature da rota espelhada (`GET /api/v1/streams`) — ver `infra/controller.js`.
  const { anonymousCan } = await import("@/infra/controller");
  if (!anonymousCan("read:studio")) return { notFound: true };

  const { slug } = context.params;

  try {
    const stream = (await import("@/models/stream")).default;
    const [studio, studios] = await Promise.all([stream.findBySlug(slug), stream.getStudiosWithStreams()]);

    // Inexistente, sem canal cadastrado ou bloqueado pela moderação: os três são
    // o mesmo 404. Distinguir seria confirmar a existência de um estúdio que a
    // moderação tirou do ar.
    if (!studio) return { notFound: true };

    return {
      props: {
        // `Date` em props quebra a serialização do Next ("Error serializing
        // `.checked_at`") — ver `pages/jogos/index.js`.
        studio: JSON.parse(JSON.stringify(studio)),
        otherStudios: JSON.parse(JSON.stringify(studios.filter((s) => s.slug !== studio.slug))),
        // O `parent` do player da Twitch é o host da requisição: no servidor não
        // existe `window.location`, e hostname errado faz a Twitch recusar o embed.
        hostname: (context.req.headers.host || "").split(":")[0],
      },
    };
  } catch {
    return { notFound: true };
  }
}

/** Item da barra lateral: miniatura + título + plataforma/audiência. */
function ChannelLink({ studio }) {
  const viewerCount = formatViewerCount(studio.viewer_count);

  return (
    <Link href={`/streams/${studio.slug}`} className={styles.channel}>
      <span className={styles.channelThumb}>
        {studio.thumbnail_url ? (
          <Image src={studio.thumbnail_url} alt="" fill sizes="112px" className={styles.channelThumbImg} />
        ) : (
          <span className={styles.channelThumbPlaceholder}>
            <BroadcastIcon size={16} />
          </span>
        )}
      </span>
      <span className={styles.channelMeta}>
        <span className={styles.channelTitle}>{studio.stream_title || studio.name}</span>
        <span className={styles.channelStudio}>{studio.name}</span>
        <span className={styles.channelFooter}>
          <PlatformBadge platform={resolvePlatformId(studio)} />
          {viewerCount && (
            <span className={styles.channelViewers}>
              <PersonIcon size={12} />
              {viewerCount}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}

ChannelLink.propTypes = {
  studio: PropTypes.shape({
    slug: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    stream_title: PropTypes.string,
    thumbnail_url: PropTypes.string,
    is_live: PropTypes.bool,
    viewer_count: PropTypes.number,
  }).isRequired,
};

export default function StreamWatchPage({ studio, otherStudios, hostname }) {
  const [shareOpen, setShareOpen] = useState(false);

  const platformId = resolvePlatformId(studio);
  const platformLabel = getPlatformLabel(studio);
  const watchUrl = getWatchUrl(studio);
  const embedUrl = getEmbedUrl(studio, hostname);
  const viewerCount = formatViewerCount(studio.viewer_count);
  const checkedAt = formatCheckedAt(studio.checked_at);
  const alternativeChannels = listStudioChannels(studio).filter((channel) => channel.id !== platformId);
  const liveOthers = otherStudios.filter((s) => s.is_live);
  const offlineOthers = otherStudios.filter((s) => !s.is_live);

  const headline = studio.stream_title || (studio.is_live ? "Transmissão ao vivo" : `${studio.name} está offline agora`);
  const canonicalUrl = `${SITE_URL}/streams/${studio.slug}`;
  const pageTitle = `${studio.name}${studio.is_live ? " ao vivo" : ""} — Streams — Indies Brasil`;
  const description = studio.is_live
    ? `Assista ao vivo a ${studio.name}${studio.category_name ? ` — ${studio.category_name}` : ""}.${studio.stream_title ? ` ${studio.stream_title}.` : ""}`
    : `${studio.name} transmite em ${platformLabel}. Veja o canal, o status da transmissão e outros estúdios brasileiros ao vivo no Indies Brasil.`;

  // A miniatura da Twitch é a única cujo tamanho nós pedimos
  // (`STREAM_THUMBNAIL_SIZE`, usado em `models/stream.js`): a do YouTube vem
  // 16:9 em outro tamanho, e declarar 440x248 para ela faria a rede dimensionar
  // o card errado antes de baixar a imagem.
  const ogImage = studio.is_live && platformId === "twitch" ? studio.thumbnail_url : null;

  const avatar = studio.logo_url ? (
    <Image src={studio.logo_url} alt={studio.name} width={36} height={36} className={styles.avatarImg} />
  ) : (
    <span className={styles.avatarPlaceholder}>{studio.name[0]}</span>
  );

  return (
    <>
      <SeoHead
        title={pageTitle}
        description={description}
        canonical={canonicalUrl}
        ogImage={ogImage || undefined}
        ogImageWidth={ogImage ? STREAM_THUMBNAIL_SIZE.width : undefined}
        ogImageHeight={ogImage ? STREAM_THUMBNAIL_SIZE.height : undefined}
        jsonLd={graph(
          breadcrumbList([
            { name: "Streams", path: "/streams" },
            { name: studio.name, path: `/streams/${studio.slug}` },
          ]),
        )}
      />

      <div className={styles.page}>
        <Link href="/streams" className={styles.backLink}>
          <ArrowLeftIcon size={14} />
          Todos os canais
        </Link>

        <div className={styles.layout}>
          <div className={styles.main}>
            <StreamPlayer
              src={embedUrl}
              title={studio.is_live ? `Transmissão ao vivo de ${studio.name}` : `Canal de ${studio.name}`}
              platformLabel={platformLabel}
              watchUrl={watchUrl}
              offlineMessage={`${studio.name} está offline agora`}
            />

            <div className={styles.header}>
              <div className={styles.headerMain}>
                <div className={styles.badges}>
                  {studio.is_live ? <LiveBadge size="large" /> : <span className={styles.offlineBadge}>Offline</span>}
                  <PlatformBadge platform={platformId} size="large" />
                </div>

                <Heading as="h1" className={styles.title}>
                  {headline}
                </Heading>

                <div className={styles.metaRow}>
                  <span className={styles.avatar}>{avatar}</span>
                  <Link href={`/estudios/${studio.slug}`} className={styles.studioLink}>
                    {studio.name}
                  </Link>
                  {studio.category_name && (
                    <>
                      <span className={styles.separator}>·</span>
                      <span className={styles.category}>{studio.category_name}</span>
                    </>
                  )}
                  {viewerCount && (
                    <>
                      <span className={styles.separator}>·</span>
                      <span className={styles.viewers}>
                        <PersonIcon size={12} />
                        {viewerCount} assistindo
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.actions}>
                {watchUrl && (
                  <a className={styles.primaryAction} href={watchUrl} target="_blank" rel="noopener noreferrer">
                    Assistir na {platformLabel}
                    <ArrowUpRightIcon size={14} />
                  </a>
                )}
                <button type="button" className={styles.secondaryAction} onClick={() => setShareOpen(true)}>
                  <ShareIcon size={14} />
                  Compartilhar
                </button>
              </div>
            </div>

            {studio.pitch && <p className={styles.pitch}>{studio.pitch}</p>}

            <dl className={styles.facts}>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>Plataforma</dt>
                <dd className={styles.factValue}>{platformLabel || "—"}</dd>
              </div>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>Categoria</dt>
                <dd className={styles.factValue}>{studio.category_name || "—"}</dd>
              </div>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>Espectadores</dt>
                <dd className={styles.factValue}>{viewerCount ? `${viewerCount} assistindo` : "—"}</dd>
              </div>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>Última verificação</dt>
                <dd className={styles.factValue}>{checkedAt || "—"}</dd>
              </div>
            </dl>

            {alternativeChannels.length > 0 && (
              <p className={styles.alternatives}>
                Também transmite em{" "}
                {alternativeChannels.map((channel, index) => (
                  <span key={channel.id}>
                    {index > 0 && ", "}
                    <a href={channel.url} target="_blank" rel="noopener noreferrer" className={styles.alternativeLink}>
                      {channel.label}
                    </a>
                  </span>
                ))}
              </p>
            )}
          </div>

          <aside className={styles.sidebar} aria-label="Outros canais">
            <section className={styles.sidebarBlock}>
              <h2 className={styles.sidebarTitle}>
                <span className={styles.liveDot} />
                Ao vivo agora
              </h2>
              {liveOthers.length > 0 ? (
                <div className={styles.channelList}>
                  {liveOthers.map((other) => (
                    <ChannelLink key={other.id} studio={other} />
                  ))}
                </div>
              ) : (
                <p className={styles.sidebarEmpty}>Nenhum outro canal ao vivo neste momento.</p>
              )}
            </section>

            {offlineOthers.length > 0 && (
              <section className={styles.sidebarBlock}>
                <h2 className={styles.sidebarTitle}>Canais offline</h2>
                <div className={styles.channelList}>
                  {offlineOthers.map((other) => (
                    <ChannelLink key={other.id} studio={other} />
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>

      {shareOpen && (
        <ShareModal
          path={`/streams/${studio.slug}`}
          text={studio.is_live ? `${studio.name} está ao vivo agora!` : `Veja o canal de ${studio.name}`}
          hint="Mande o link para quem vai assistir com você."
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}
