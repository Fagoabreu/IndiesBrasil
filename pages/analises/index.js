import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import styles from "./analises.module.css";

const CONTENT_TYPE_LABELS = {
  game: "Jogo",
  boardgame: "Jogo de Mesa",
  book: "Livro/Quadrinho",
};

function StarRating({ value }) {
  if (!value) return null;
  return (
    <span className={styles.stars} aria-label={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={value >= s ? styles.starFilled : styles.starEmpty}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function AnalisesPage() {
  const [analises, setAnalises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const fetchAnalises = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filter) params.set("content_type", filter);
      const res = await fetch(`/api/v1/analises?${params}`, { credentials: "include" });
      if (res.ok) {
        setAnalises(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetchAnalises();
  }, [fetchAnalises]);

  return (
    <>
      <Head>
        <title>Análises — Indies Brasil</title>
        <meta name="description" content="Análises e reviews de jogos, jogos de mesa e livros feitas pela comunidade Indies Brasil." />
      </Head>

      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Análises</h1>
          <p className={styles.subtitle}>Reviews da comunidade sobre jogos, jogos de mesa e livros</p>
        </header>

        <div className={styles.toolbar}>
          <div className={styles.filters}>
            {["", "game", "boardgame", "book"].map((t) => (
              <button
                key={t}
                type="button"
                className={`${styles.filterBtn} ${filter === t ? styles.filterActive : ""}`}
                onClick={() => {
                  setFilter(t);
                  setPage(1);
                }}
              >
                {t === "" ? "Todos" : CONTENT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
          </div>
        ) : analises.length === 0 ? (
          <div className={styles.empty}>
            <p>Nenhuma análise encontrada.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {analises.map((a) => (
              <Link key={a.id} href={`/analises/${a.slug}`} className={styles.card}>
                <div className={styles.cardImageWrap}>
                  {a.cover_url ? (
                    <Image src={a.cover_url} alt={a.title} fill sizes="400px" className={styles.cardImage} />
                  ) : (
                    <div className={styles.cardImagePlaceholder}>
                      <span>📝</span>
                    </div>
                  )}
                </div>
                <div className={styles.cardBody}>
                  <span className={styles.cardBadge}>{CONTENT_TYPE_LABELS[a.content_type] || a.content_type}</span>
                  <h2 className={styles.cardTitle}>{a.title}</h2>
                  {a.rating && (
                    <div className={styles.cardRating}>
                      <StarRating value={a.rating} />
                    </div>
                  )}
                  {a.content_name && (
                    <div className={styles.cardContentRef}>
                      <div className={styles.cardContentThumb}>
                        {a.content_cover_url ? (
                          <Image
                            src={a.content_cover_url}
                            alt={a.content_name}
                            width={32}
                            height={32}
                            className={styles.cardContentThumbImg}
                            unoptimized={a.content_cover_url.startsWith("data:") || a.content_cover_url.startsWith("blob:")}
                          />
                        ) : (
                          <span className={styles.cardContentThumbPlaceholder}>📦</span>
                        )}
                      </div>
                      <span className={styles.cardContentName}>{a.content_name}</span>
                    </div>
                  )}
                  <div className={styles.cardMeta}>
                    {a.author_avatar_url ? (
                      <Image
                        src={a.author_avatar_url}
                        alt={a.author_username}
                        width={18}
                        height={18}
                        className={styles.cardAuthorAvatar}
                        unoptimized={a.author_avatar_url.startsWith("data:") || a.author_avatar_url.startsWith("blob:")}
                      />
                    ) : (
                      <span className={styles.cardAuthorAvatarPlaceholder}>👤</span>
                    )}
                    <span>Por {a.author_username}</span>
                    <span>{new Date(a.published_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
