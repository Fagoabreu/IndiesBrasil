import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import Head from "next/head";
import { QRCodeSVG } from "qrcode.react";
import styles from "./press-kit.module.css";
import { SITE_URL } from "@/lib/seo";

/* =========================================================
 * Constants
 * ========================================================= */

const STAGE_LABELS = {
  concept: "Conceito",
  prototype: "Protótipo",
  alpha: "Alpha",
  beta: "Beta",
  early_access: "Acesso Antecipado",
  released: "Lançado",
  cancelled: "Cancelado",
};

const PLATFORM_LABELS = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  ps5: "PlayStation 5",
  ps4: "PlayStation 4",
  xbox_series: "Xbox Series X|S",
  xbox_one: "Xbox One",
  switch: "Nintendo Switch",
  ios: "iOS",
  android: "Android",
  browser: "Navegador",
};

const BOOK_TYPE_LABELS = {
  book: "Livro",
  comic: "Quadrinho",
  manga: "Mangá",
  artbook: "Artbook",
  guide: "Guia",
  zine: "Zine",
};

const SOCIAL_ICONS = {
  youtube: "▶",
  twitch: "📺",
  twitter: "𝕏",
  instagram: "📷",
  discord: "💬",
  tiktok: "🎵",
  facebook: "📘",
  linkedin: "💼",
  github: "⌨",
  website: "🌐",
  email: "✉",
  steam: "🎮",
  itch: "🕹",
};

/* =========================================================
 * Helpers
 * ========================================================= */

function formatDateBR(dateStr) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr));
}

function formatCNPJ(raw) {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function buildAddressLines(addr) {
  if (!addr) return [];
  const line1 = [addr.street, addr.number, addr.complement]
    .filter(Boolean)
    .join(", ");
  const line2 = [addr.neighborhood, addr.city, addr.state]
    .filter(Boolean)
    .join(", ");
  const line3 = [addr.zip_code, addr.country].filter(Boolean).join(" — ");
  return [line1, line2, line3].filter(Boolean);
}

function getContactIcon(contact) {
  if (!contact?.icon_key) return null;
  const key = contact.icon_key.toLowerCase();
  for (const [pattern, emoji] of Object.entries(SOCIAL_ICONS)) {
    if (key.includes(pattern)) return emoji;
  }
  return "🔗";
}

function getVideoId(url) {
  if (!url) return null;
  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (ytMatch) return { type: "youtube", id: ytMatch[1] };
  // Vimeo
  const vmMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vmMatch) return { type: "vimeo", id: vmMatch[1] };
  return null;
}

function getFeaturesList(featuresString) {
  if (!featuresString) return [];
  return featuresString
    .split("\n")
    .map((f) => f.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean);
}

/* =========================================================
 * Fallback card components (shown while rich data loads)
 * ========================================================= */

function GameCard({ game }) {
  const genres = game.genre ? game.genre.split(",").map((g) => g.trim()) : [];
  return (
    <article className={styles.gameCard}>
      {game.cover_url && (
        <div className={styles.gameCoverWrap}>
          <Image
            src={game.cover_url}
            alt={game.name}
            fill
            sizes="120px"
            className={styles.gameCover}
            unoptimized={
              game.cover_url.startsWith("data:") ||
              game.cover_url.startsWith("blob:")
            }
          />
        </div>
      )}
      <div className={styles.gameInfo}>
        <h3 className={styles.gameName}>{game.name}</h3>
        <div className={styles.gameMeta}>
          {game.stage && (
            <span className={styles.gameStage}>
              {STAGE_LABELS[game.stage] || game.stage}
            </span>
          )}
          {genres.length > 0 && (
            <span className={styles.gameGenre}>{genres.join(" · ")}</span>
          )}
        </div>
        {game.short_description && (
          <p className={styles.gameDesc}>{game.short_description}</p>
        )}
        {game.release_date && (
          <span className={styles.gameRelease}>
            Lançamento: {formatDateBR(game.release_date)}
          </span>
        )}
      </div>
    </article>
  );
}

function BookCard({ book }) {
  const bookType =
    BOOK_TYPE_LABELS[book.book_type] || book.book_type || "Livro";
  return (
    <article className={styles.gameCard}>
      {book.cover_url && (
        <div className={styles.gameCoverWrap}>
          <Image
            src={book.cover_url}
            alt={book.title}
            fill
            sizes="120px"
            className={styles.gameCover}
            unoptimized={
              book.cover_url.startsWith("data:") ||
              book.cover_url.startsWith("blob:")
            }
          />
        </div>
      )}
      <div className={styles.gameInfo}>
        <h3 className={styles.gameName}>{book.title}</h3>
        {book.subtitle && (
          <p className={styles.bookSubtitle}>{book.subtitle}</p>
        )}
        <div className={styles.gameMeta}>
          <span className={styles.gameStage}>{bookType}</span>
          {book.stage && (
            <span className={styles.gameGenre}>
              {STAGE_LABELS[book.stage] || book.stage}
            </span>
          )}
          {book.publisher && (
            <span className={styles.gameGenre}>{book.publisher}</span>
          )}
        </div>
        {book.short_description && (
          <p className={styles.gameDesc}>{book.short_description}</p>
        )}
        {book.release_date && (
          <span className={styles.gameRelease}>
            Publicação: {formatDateBR(book.release_date)}
          </span>
        )}
      </div>
    </article>
  );
}

/* =========================================================
 * Shared sub-components
 * ========================================================= */

function MediaGallery({ media, title }) {
  const images = (media || []).filter((m) => m.media_type === "image");
  if (images.length === 0) return null;
  return (
    <div className={styles.mediaGallery}>
      <h4 className={styles.detailSubtitle}>{title || "Screenshots"}</h4>
      <div className={styles.mediaGrid}>
        {images.map((item) => (
          <div key={item.id} className={styles.mediaItem}>
            <Image
              src={item.url}
              alt={item.caption || ""}
              width={320}
              height={180}
              className={styles.mediaImg}
              unoptimized
            />
            {item.caption && (
              <span className={styles.mediaCaption}>{item.caption}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StoreTable({ stores }) {
  if (!stores || stores.length === 0) return null;
  return (
    <div className={styles.storeSection}>
      <h4 className={styles.detailSubtitle}>Onde comprar</h4>
      <table className={styles.storeTable}>
        <thead>
          <tr>
            <th>Loja</th>
            <th>Preço</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>
          {stores.map((s) => (
            <tr key={s.id}>
              <td>{s.store_name}</td>
              <td>
                {s.price
                  ? `R$ ${Number(s.price).toFixed(2).replace(".", ",")}`
                  : "—"}
              </td>
              <td>
                <a
                  href={s.page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.storeLink}
                >
                  {s.page_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SpecRow({ label, value }) {
  if (!value) return null;
  return (
    <div className={styles.specRow}>
      <dt className={styles.specLabel}>{label}</dt>
      <dd className={styles.specValue}>{value}</dd>
    </div>
  );
}

/* =========================================================
 * GameDetail — per-game presskit entry
 * ========================================================= */

function GameDetail({ game }) {
  const genres = game.genre ? game.genre.split(",").map((g) => g.trim()) : [];
  const platforms = game.platforms || [];
  const media = game.media || [];
  const team = game.team || [];
  const storePages = game.store_pages || [];
  const tags = game.tags || [];
  const videoInfo = getVideoId(game.trailer_url);

  return (
    <article className={styles.detailSection}>
      {/* Header: cover + info */}
      <div className={styles.detailHeader}>
        {game.cover_url && (
          <div className={styles.detailCoverWrap}>
            <Image
              src={game.cover_url}
              alt={game.name}
              fill
              sizes="160px"
              className={styles.detailCover}
              unoptimized={
                game.cover_url.startsWith("data:") ||
                game.cover_url.startsWith("blob:")
              }
            />
          </div>
        )}
        <div className={styles.detailHeaderInfo}>
          <h3 className={styles.detailName}>{game.name}</h3>
          <div className={styles.detailMeta}>
            {game.stage && (
              <span className={styles.detailStage}>
                {STAGE_LABELS[game.stage] || game.stage}
              </span>
            )}
            {genres.map((g) => (
              <span key={g} className={styles.detailTag}>
                {g}
              </span>
            ))}
          </div>
          {game.short_description && (
            <p className={styles.detailShortDesc}>{game.short_description}</p>
          )}
        </div>
      </div>

      {/* Full description */}
      {game.description && (
        <div className={styles.detailDesc}>
          <p className={styles.bodyText}>{game.description}</p>
        </div>
      )}

      {/* Technical specs */}
      <dl className={styles.specList}>
        {platforms.length > 0 && (
          <SpecRow
            label="Plataformas"
            value={platforms.map((p) => PLATFORM_LABELS[p] || p).join(", ")}
          />
        )}
        <SpecRow label="Lançamento" value={formatDateBR(game.release_date)} />
        <SpecRow label="Engine" value={game.engine} />
        <SpecRow
          label="Website"
          value={
            game.website_url ? (
              <a
                href={game.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.detailLink}
              >
                {game.website_url
                  .replace(/^https?:\/\//, "")
                  .replace(/\/$/, "")}
              </a>
            ) : null
          }
        />
        {tags.length > 0 && (
          <SpecRow label="Tags" value={tags.map((t) => t.name).join(", ")} />
        )}
      </dl>

      {/* Trailer */}
      {videoInfo && (
        <div className={styles.detailTrailer}>
          <h4 className={styles.detailSubtitle}>Trailer</h4>
          <div className={styles.videoWrap}>
            {videoInfo.type === "youtube" ? (
              <iframe
                src={`https://www.youtube.com/embed/${videoInfo.id}`}
                title="Trailer"
                className={styles.videoIframe}
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            ) : (
              <iframe
                src={`https://player.vimeo.com/video/${videoInfo.id}`}
                title="Trailer"
                className={styles.videoIframe}
                allowFullScreen
              />
            )}
          </div>
        </div>
      )}

      {/* Screenshots & media */}
      <MediaGallery media={media} title="Mídia" />

      {/* Store pages */}
      <StoreTable stores={storePages} />

      {/* Team */}
      {team.length > 0 && (
        <div className={styles.detailTeam}>
          <h4 className={styles.detailSubtitle}>Equipe</h4>
          <div className={styles.teamGrid}>
            {team.map((m) => (
              <div key={m.id} className={styles.teamCard}>
                {m.avatar_url && (
                  <Image
                    src={m.avatar_url}
                    alt={m.display_name || m.username}
                    width={40}
                    height={40}
                    className={styles.teamAvatar}
                    unoptimized
                  />
                )}
                <div className={styles.teamInfo}>
                  <span className={styles.teamName}>
                    {m.display_name || m.username}
                  </span>
                  {m.roles && (
                    <span className={styles.teamRole}>{m.roles}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

/* =========================================================
 * BoardgameDetail — per-boardgame presskit entry
 * ========================================================= */

function BoardgameDetail({ boardgame }) {
  const mechanics = boardgame.mechanics || [];
  const media = boardgame.media || [];
  const playerRange =
    boardgame.player_count_min || boardgame.player_count_max
      ? [boardgame.player_count_min, boardgame.player_count_max]
          .filter((v) => v != null)
          .join("–")
      : null;
  const playTimeRange =
    boardgame.play_time_min || boardgame.play_time_max
      ? [boardgame.play_time_min, boardgame.play_time_max]
          .filter((v) => v != null)
          .join("–") + " min"
      : null;

  return (
    <article className={styles.detailSection}>
      {/* Header */}
      <div className={styles.detailHeader}>
        {boardgame.cover_url && (
          <div className={styles.detailCoverWrap}>
            <Image
              src={boardgame.cover_url}
              alt={boardgame.name}
              fill
              sizes="160px"
              className={styles.detailCover}
              unoptimized={
                boardgame.cover_url.startsWith("data:") ||
                boardgame.cover_url.startsWith("blob:")
              }
            />
          </div>
        )}
        <div className={styles.detailHeaderInfo}>
          <h3 className={styles.detailName}>{boardgame.name}</h3>
          <div className={styles.detailMeta}>
            {boardgame.stage && (
              <span className={styles.detailStage}>
                {STAGE_LABELS[boardgame.stage] || boardgame.stage}
              </span>
            )}
            {boardgame.category && (
              <span className={styles.detailTag}>{boardgame.category}</span>
            )}
          </div>
          {boardgame.short_description && (
            <p className={styles.detailShortDesc}>
              {boardgame.short_description}
            </p>
          )}
        </div>
      </div>

      {/* Full description */}
      {boardgame.description && (
        <div className={styles.detailDesc}>
          <p className={styles.bodyText}>{boardgame.description}</p>
        </div>
      )}

      {/* Specs */}
      <dl className={styles.specList}>
        <SpecRow label="Jogadores" value={playerRange} />
        <SpecRow label="Tempo de jogo" value={playTimeRange} />
        <SpecRow
          label="Idade mínima"
          value={boardgame.age_rating ? `${boardgame.age_rating}+` : null}
        />
        <SpecRow
          label="Peso (BGG)"
          value={
            boardgame.weight
              ? `${Number(boardgame.weight).toFixed(1)} / 5`
              : null
          }
        />
        <SpecRow
          label="Lançamento"
          value={formatDateBR(boardgame.release_date)}
        />
        {mechanics.length > 0 && (
          <SpecRow label="Mecânicas" value={mechanics.join(", ")} />
        )}
        <SpecRow
          label="Website"
          value={
            boardgame.website_url ? (
              <a
                href={boardgame.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.detailLink}
              >
                {boardgame.website_url
                  .replace(/^https?:\/\//, "")
                  .replace(/\/$/, "")}
              </a>
            ) : null
          }
        />
      </dl>

      {/* Media gallery */}
      <MediaGallery media={media} title="Imagens" />
    </article>
  );
}

/* =========================================================
 * BookDetail — per-book presskit entry
 * ========================================================= */

function BookDetail({ book }) {
  const storePages = book.store_pages || [];

  return (
    <article className={styles.detailSection}>
      {/* Header */}
      <div className={styles.detailHeader}>
        {book.cover_url && (
          <div className={styles.detailCoverWrap}>
            <Image
              src={book.cover_url}
              alt={book.title}
              fill
              sizes="160px"
              className={styles.detailCover}
              unoptimized={
                book.cover_url.startsWith("data:") ||
                book.cover_url.startsWith("blob:")
              }
            />
          </div>
        )}
        <div className={styles.detailHeaderInfo}>
          <h3 className={styles.detailName}>{book.title}</h3>
          {book.subtitle && (
            <p className={styles.bookSubtitle}>{book.subtitle}</p>
          )}
          <div className={styles.detailMeta}>
            {book.book_type && (
              <span className={styles.detailStage}>
                {BOOK_TYPE_LABELS[book.book_type] || book.book_type}
              </span>
            )}
            {book.stage && (
              <span className={styles.detailTag}>
                {STAGE_LABELS[book.stage] || book.stage}
              </span>
            )}
            {book.publisher && (
              <span className={styles.detailTag}>{book.publisher}</span>
            )}
          </div>
          {book.short_description && (
            <p className={styles.detailShortDesc}>{book.short_description}</p>
          )}
        </div>
      </div>

      {/* Full description */}
      {book.description && (
        <div className={styles.detailDesc}>
          <p className={styles.bodyText}>{book.description}</p>
        </div>
      )}

      {/* Specs */}
      <dl className={styles.specList}>
        <SpecRow label="ISBN" value={book.isbn} />
        <SpecRow label="Editora" value={book.publisher} />
        <SpecRow label="Edição" value={book.edition} />
        <SpecRow label="Páginas" value={book.pages} />
        <SpecRow label="Idioma" value={book.language} />
        <SpecRow label="Publicação" value={formatDateBR(book.release_date)} />
        <SpecRow
          label="Website"
          value={
            book.website_url ? (
              <a
                href={book.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.detailLink}
              >
                {book.website_url
                  .replace(/^https?:\/\//, "")
                  .replace(/\/$/, "")}
              </a>
            ) : null
          }
        />
        <SpecRow
          label="Comprar"
          value={
            book.buy_url ? (
              <a
                href={book.buy_url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.detailLink}
              >
                {book.buy_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            ) : null
          }
        />
        {book.pdf_url && (
          <SpecRow
            label="PDF"
            value={
              <a
                href={book.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.detailLink}
              >
                Download
              </a>
            }
          />
        )}
      </dl>

      {/* Store pages */}
      <StoreTable stores={storePages} />
    </article>
  );
}

/* =========================================================
 * Page
 * ========================================================= */

export default function PressKitPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [studio, setStudio] = useState(null);
  const [games, setGames] = useState([]);
  const [boardGames, setBoardGames] = useState([]);
  const [books, setBooks] = useState([]);
  const [richGames, setRichGames] = useState(null);
  const [richBoardgames, setRichBoardgames] = useState(null);
  const [richBooks, setRichBooks] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const studioUrl = `/api/v1/studios/${slug}`;
    const gamesUrl = `/api/v1/studios/${slug}/games`;
    const boardGamesUrl = `/api/v1/studios/${slug}/boardgames`;
    const booksUrl = `/api/v1/studios/${slug}/books`;

    Promise.all([
      fetch(studioUrl, { credentials: "include" }).then((r) => r.json()),
      fetch(gamesUrl, { credentials: "include" })
        .then((r) => r.json())
        .catch(() => []),
      fetch(boardGamesUrl, { credentials: "include" })
        .then((r) => r.json())
        .catch(() => []),
      fetch(booksUrl, { credentials: "include" })
        .then((r) => r.json())
        .catch(() => []),
    ])
      .then(([studioData, gamesData, bgData, booksData]) => {
        setStudio(studioData);
        setGames(Array.isArray(gamesData) ? gamesData : []);
        setBoardGames(Array.isArray(bgData) ? bgData : []);
        setBooks(Array.isArray(booksData) ? booksData : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  // Fetch rich details for each game, boardgame, and book
  useEffect(() => {
    if (!games.length && !boardGames.length && !books.length) return;

    const gameFetches = games.map((g) =>
      fetch(`/api/v1/games/${g.slug}`, { credentials: "include" })
        .then((r) => r.json())
        .catch(() => null),
    );

    const bgFetches = boardGames.map((bg) =>
      Promise.all([
        fetch(`/api/v1/boardgames/${bg.slug}`, { credentials: "include" })
          .then((r) => r.json())
          .catch(() => null),
        fetch(`/api/v1/boardgames/${bg.slug}/media`, { credentials: "include" })
          .then((r) => r.json())
          .catch(() => []),
      ]).then(([data, media]) =>
        data ? { ...data, media: Array.isArray(media) ? media : [] } : null,
      ),
    );

    const bookFetches = books.map((b) =>
      fetch(`/api/v1/books/${b.slug}`, { credentials: "include" })
        .then((r) => r.json())
        .catch(() => null),
    );

    Promise.all([
      Promise.all(gameFetches).then((results) =>
        setRichGames(results.filter(Boolean)),
      ),
      Promise.all(bgFetches).then((results) =>
        setRichBoardgames(results.filter(Boolean)),
      ),
      Promise.all(bookFetches).then((results) =>
        setRichBooks(results.filter(Boolean)),
      ),
    ]);
  }, [games, boardGames, books]);

  if (loading) {
    return <div className={styles.loading}>Carregando press kit...</div>;
  }

  if (!studio || studio.status_code) {
    return <div className={styles.loading}>Estúdio não encontrado.</div>;
  }

  const studioUrl = `${SITE_URL}/estudios/${slug}`;
  const members = studio.members ?? [];
  const addressLines = buildAddressLines(studio.address);
  const contacts = studio.contacts ?? [];
  const featuresList = getFeaturesList(studio.features);
  const videoInfo = getVideoId(studio.banner_video_url);
  const allContent = [...games, ...boardGames, ...books];

  // Collect platforms from rich game data
  const allPlatforms =
    richGames !== null
      ? [
          ...new Set(
            richGames.flatMap((g) =>
              (g.platforms || []).map((p) => PLATFORM_LABELS[p] || p),
            ),
          ),
        ].sort()
      : [];

  // Separate contacts by type
  const socialContacts = contacts.filter((c) => {
    const key = (c.icon_key || "").toLowerCase();
    return [
      "youtube",
      "twitch",
      "twitter",
      "instagram",
      "discord",
      "tiktok",
      "facebook",
      "linkedin",
      "github",
      "steam",
      "itch",
    ].some((s) => key.includes(s));
  });
  const otherContacts = contacts.filter((c) => !socialContacts.includes(c));

  function handlePrint() {
    const prev = document.title;
    document.title = `Press Kit — ${studio.name}`;
    globalThis.print();
    document.title = prev;
  }

  return (
    <>
      <Head>
        <title>Press Kit — {studio.name}</title>
        <meta name="robots" content="noindex" />
      </Head>

      {/* Barra de ação — oculta no print */}
      <div className={styles.printBar}>
        <p className={styles.printHint}>
          Press Kit de <strong>{studio.name}</strong> ·{" "}
          <a href={studioUrl} target="_blank" rel="noopener noreferrer">
            ver página
          </a>
        </p>
        <button type="button" className={styles.printBtn} onClick={handlePrint}>
          ⬇ Imprimir / Salvar PDF
        </button>
      </div>

      {/* Documento do press kit */}
      <div className={styles.page}>
        {/* CABEÇALHO HERO */}
        <header className={styles.pkHeader}>
          {studio.logo_url && (
            <Image
              src={studio.logo_url}
              alt={`Logo de ${studio.name}`}
              width={96}
              height={96}
              className={styles.pkLogo}
              style={{ objectFit: "contain" }}
            />
          )}
          <div className={styles.pkHeaderText}>
            <h1 className={styles.pkName}>{studio.name}</h1>
            {studio.pitch && <p className={styles.pkPitch}>{studio.pitch}</p>}
          </div>
        </header>

        {/* CORPO: conteúdo principal + factsheet */}
        <div className={styles.body}>
          {/* COLUNA PRINCIPAL */}
          <main className={styles.mainCol}>
            {/* Descrição */}
            {studio.description && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Sobre</h2>
                <p className={styles.bodyText}>{studio.description}</p>
              </section>
            )}

            {/* Destaques / Features */}
            {featuresList.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Destaques</h2>
                <ul className={styles.featuresList}>
                  {featuresList.map((f, i) => (
                    <li key={i} className={styles.featureItem}>
                      {f}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Trailers */}
            {videoInfo && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Trailer</h2>
                <div className={styles.videoWrap}>
                  {videoInfo.type === "youtube" ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${videoInfo.id}`}
                      title="Trailer"
                      className={styles.videoIframe}
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  ) : (
                    <iframe
                      src={`https://player.vimeo.com/video/${videoInfo.id}`}
                      title="Trailer"
                      className={styles.videoIframe}
                      allowFullScreen
                    />
                  )}
                </div>
              </section>
            )}

            {/* História */}
            {studio.history && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>História</h2>
                <p className={styles.bodyText}>{studio.history}</p>
              </section>
            )}

            {/* Equipe */}
            {members.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Equipe</h2>
                <ul className={styles.memberList}>
                  {members.map((m) => (
                    <li key={m.user_id ?? m.id} className={styles.memberItem}>
                      <span className={styles.memberName}>
                        {m.display_name || m.username}
                      </span>
                      {m.roles?.length > 0 && (
                        <span className={styles.memberRole}>
                          {m.roles.join(", ")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Logos e assets */}
            {studio.logo_url && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Logos e Assets</h2>
                <p className={styles.assetsIntro}>
                  Os arquivos abaixo podem ser utilizados para cobertura da
                  imprensa. Para baixar a logo em alta resolução, clique com o
                  botão direito e selecione &ldquo;Salvar imagem
                  como&hellip;&rdquo;.
                </p>
                <div className={styles.assetsGrid}>
                  <div className={styles.assetItem}>
                    <div className={styles.assetPreview}>
                      <Image
                        src={studio.logo_url}
                        alt={`Logo de ${studio.name}`}
                        width={200}
                        height={80}
                        className={styles.assetImg}
                        style={{ objectFit: "contain" }}
                      />
                    </div>
                    <span className={styles.assetLabel}>Logo principal</span>
                  </div>
                  {studio.banner_url && (
                    <div className={styles.assetItem}>
                      <div className={styles.assetPreview}>
                        <Image
                          src={studio.banner_url}
                          alt={`Banner de ${studio.name}`}
                          width={240}
                          height={60}
                          className={styles.assetImg}
                          style={{ objectFit: "cover" }}
                        />
                      </div>
                      <span className={styles.assetLabel}>
                        Banner / Key Art
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Redes sociais */}
            {socialContacts.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Redes Sociais</h2>
                <div className={styles.socialGrid}>
                  {socialContacts.map((c) => (
                    <a
                      key={c.id ?? c.contact_value}
                      href={c.contact_value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.socialLink}
                    >
                      <span className={styles.socialIcon}>
                        {getContactIcon(c)}
                      </span>
                      <span className={styles.socialLabel}>
                        {c.icon_key
                          ? c.icon_key.charAt(0).toUpperCase() +
                            c.icon_key.slice(1)
                          : "Link"}
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Jogos digitais */}
            {games.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Jogos</h2>
                <div className={styles.detailList}>
                  {(richGames !== null ? richGames : games).map((item) =>
                    richGames !== null ? (
                      <GameDetail key={item.id} game={item} />
                    ) : (
                      <GameCard key={item.id} game={item} />
                    ),
                  )}
                </div>
              </section>
            )}

            {/* Jogos de mesa */}
            {boardGames.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Jogos de Mesa</h2>
                <div className={styles.detailList}>
                  {(richBoardgames !== null ? richBoardgames : boardGames).map(
                    (item) =>
                      richBoardgames !== null ? (
                        <BoardgameDetail key={item.id} boardgame={item} />
                      ) : (
                        <GameCard key={item.id} game={item} />
                      ),
                  )}
                </div>
              </section>
            )}

            {/* Livros e Quadrinhos */}
            {books.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Livros e Quadrinhos</h2>
                <div className={styles.detailList}>
                  {(richBooks !== null ? richBooks : books).map((item) =>
                    richBooks !== null ? (
                      <BookDetail key={item.id} book={item} />
                    ) : (
                      <BookCard key={item.id} book={item} />
                    ),
                  )}
                </div>
              </section>
            )}

            {/* Placeholder quando não há jogos */}
            {allContent.length === 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Jogos</h2>
                <p className={styles.emptyHint}>
                  Os jogos do estúdio serão listados aqui em breve.
                </p>
              </section>
            )}
          </main>

          {/* FACTSHEET LATERAL */}
          <aside className={styles.factsheet}>
            <h2 className={styles.factsheetTitle}>Factsheet</h2>

            <dl className={styles.factList}>
              <div className={styles.factRow}>
                <dt>Desenvolvedor</dt>
                <dd>{studio.name}</dd>
              </div>

              {studio.founded_at && (
                <div className={styles.factRow}>
                  <dt>Fundação</dt>
                  <dd>{formatDateBR(studio.founded_at)}</dd>
                </div>
              )}

              {studio.website && (
                <div className={styles.factRow}>
                  <dt>Website</dt>
                  <dd>
                    <a
                      href={studio.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.factLink}
                    >
                      {studio.website
                        .replace(/^https?:\/\//, "")
                        .replace(/\/$/, "")}
                    </a>
                  </dd>
                </div>
              )}

              {allPlatforms.length > 0 && (
                <div className={styles.factRow}>
                  <dt>Plataformas</dt>
                  <dd>{allPlatforms.join(", ")}</dd>
                </div>
              )}

              {addressLines.length > 0 && (
                <div className={styles.factRow}>
                  <dt>Localização</dt>
                  <dd>
                    {addressLines.map((line) => (
                      <span key={line} className={styles.addrLine}>
                        {line}
                      </span>
                    ))}
                  </dd>
                </div>
              )}

              {studio.cnpj && (
                <div className={styles.factRow}>
                  <dt>CNPJ</dt>
                  <dd>{formatCNPJ(studio.cnpj)}</dd>
                </div>
              )}

              {otherContacts.length > 0 && (
                <div className={styles.factRow}>
                  <dt>Contato</dt>
                  <dd>
                    {otherContacts.map((c) => (
                      <span
                        key={c.id ?? c.contact_value}
                        className={styles.factContactRow}
                      >
                        {c.contact_value}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>

            {/* QR Code */}
            <div className={styles.qrBlock}>
              <QRCodeSVG
                value={studioUrl}
                size={96}
                bgColor="#ffffff"
                fgColor="#1a1a2e"
              />
              <span className={styles.qrLabel}>{studioUrl}</span>
            </div>
          </aside>
        </div>

        {/* RODAPÉ */}
        <footer className={styles.pkFooter}>
          <span>
            Gerado em {new Intl.DateTimeFormat("pt-BR").format(new Date())}
          </span>
          <span>{studioUrl}</span>
        </footer>
      </div>
    </>
  );
}
