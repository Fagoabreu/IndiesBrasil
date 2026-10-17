import { EVENT_TIME_ZONE } from "@/lib/eventFormat";
import { normalizeHostname, siteHostname } from "@/lib/seo";

/**
 * Registro único das plataformas de transmissão.
 *
 * Cada plataforma declara como abrir e como embutir o canal do estúdio, e o
 * resto do site consulta por aqui: nenhuma tela monta endereço de player nem
 * decide rótulo de plataforma por conta própria. Antes, `pages/streams/index.js`
 * fazia as quatro traduções sozinha (`getStreamUrl`, `getPlatformLabel`,
 * `getPlatformStyleClass`, `getEmbedSrc`) e a página de assistir seria a segunda
 * cópia — as duas divergiriam no primeiro ajuste (o `parent` do player da Twitch
 * é o host de quem renderiza, que no SSR vem da requisição, não do navegador).
 *
 * Adicionar a **Kick** é acrescentar uma entrada em `STREAM_PLATFORMS` (rótulo,
 * `channelField`, `watchUrl`, `embedUrl`) e a coluna do canal em `organizations`
 * — nada de `if (platform === ...)` espalhado pelas telas. A plataforma própria
 * do site (a webconferência em `galene/`) entra do mesmo jeito: uma entrada cujo
 * `embedUrl` aponta para o nosso player.
 */

/**
 * Tamanho da miniatura que pedimos às APIs — é o mesmo número que a página de
 * assistir declara em `og:image:width/height`, para o número e o arquivo não
 * divergirem (ver `lib/seo.js`, `ogImageSizeFromPreset`).
 */
export const STREAM_THUMBNAIL_SIZE = { width: 440, height: 248 };

const STREAM_PLATFORMS = {
  twitch: {
    id: "twitch",
    label: "Twitch",
    channelField: "twitch_channel",
    watchUrl: (studio) => `https://www.twitch.tv/${studio.twitch_channel}`,
    // O player da Twitch abre o canal mesmo offline (mostra a própria tela de
    // offline da Twitch), então não depende de `is_live`.
    embedWhenOffline: true,
    embedUrl: ({ studio, hostname }) => `https://player.twitch.tv/?channel=${studio.twitch_channel}&parent=${hostname}&autoplay=true&muted=true`,
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    channelField: "youtube_channel_id",
    watchUrl: (studio) => `https://www.youtube.com/channel/${studio.youtube_channel_id}`,
    // `embed/live_stream` só existe enquanto há transmissão: offline o iframe
    // fica vazio e a página passa a mostrar o estado offline.
    embedWhenOffline: false,
    embedUrl: ({ studio }) => `https://www.youtube.com/embed/live_stream?channel=${studio.youtube_channel_id}&autoplay=1&mute=1`,
  },
};

/** Metadados da plataforma; `null` para identificador desconhecido. */
export function getPlatform(platformId) {
  return STREAM_PLATFORMS[platformId] ?? null;
}

/**
 * Canais que o estúdio tem cadastrado, na ordem de preferência do site
 * (a ordem das chaves de `STREAM_PLATFORMS`: Twitch antes de YouTube).
 */
export function listStudioChannels(studio) {
  return Object.entries(STREAM_PLATFORMS)
    .filter(([, meta]) => studio[meta.channelField])
    .map(([id, meta]) => ({ id, label: meta.label, url: meta.watchUrl(studio) }));
}

/**
 * Plataforma da transmissão.
 *
 * Ao vivo, quem manda é `active_platform` — a rota escolhe a partir de quem está
 * de fato transmitindo. Offline não existe transmissão: vale o primeiro canal
 * cadastrado, que é a Twitch quando o estúdio tem os dois.
 */
export function resolvePlatformId(studio) {
  if (getPlatform(studio.active_platform)) return studio.active_platform;
  return listStudioChannels(studio)[0]?.id ?? null;
}

/** Rótulo da plataforma resolvida, para texto de interface. */
export function getPlatformLabel(studio) {
  return getPlatform(resolvePlatformId(studio))?.label ?? null;
}

/** Endereço público do canal — para quem preferir assistir (e seguir) lá. */
export function getWatchUrl(studio) {
  const meta = getPlatform(resolvePlatformId(studio));
  return meta ? meta.watchUrl(studio) : null;
}

/**
 * Endereço do player embutido, ou `null` quando não há o que embutir.
 *
 * `hostname` é o host da página, **sem porta e sem esquema**: o player da
 * Twitch recusa o embed quando o `parent` não bate com quem o carrega. O valor
 * passa por `normalizeHostname` porque a origem é `headers.host` (que pode vir
 * com porta) ou a configuração do ambiente (que pode vir como URL completa) —
 * `parent=http://localhost:3000` é embed inválido.
 */
export function getEmbedUrl(studio, hostname) {
  const meta = getPlatform(resolvePlatformId(studio));
  if (!meta) return null;
  if (!meta.embedWhenOffline && !studio.is_live) return null;
  return meta.embedUrl({ studio, hostname: normalizeHostname(hostname) || siteHostname() });
}

/** Espectadores no formato curto dos cards ("42.5k"), ou `null` sem audiência. */
export function formatViewerCount(count) {
  if (!count) return null;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

/**
 * Data e hora da última verificação, no fuso do site ("16/10, 21:35").
 *
 * O `timeZone` é obrigatório: o SSR roda em UTC e o navegador em Brasília, e sem
 * ele o mesmo horário sairia diferente no HTML servido e na hidratação (mesma
 * razão de `EVENT_TIME_ZONE`, de onde o fuso vem). A data entra junto porque o
 * status é cacheado a cada 5 minutos — só "21:35" faria um dado de ontem parecer
 * de agora.
 */
export function formatCheckedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: EVENT_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Miniatura da Twitch no tamanho que pedimos (`STREAM_THUMBNAIL_SIZE`).
 *
 * A API devolve a URL com `{width}`/`{height}` como placeholder — quem monta a
 * URL final é aqui, porque é este o número que declaramos no `og:image`.
 */
export function twitchThumbnailUrl(url, size = STREAM_THUMBNAIL_SIZE) {
  if (!url) return null;
  return url.replace("{width}", String(size.width)).replace("{height}", String(size.height));
}
