import Link from "next/link";
import Image from "next/image";
import { StarFillIcon, CommentDiscussionIcon, CheckIcon, XIcon } from "@primer/octicons-react";
import cardStyles from "@/components/Card/cardBase.module.css";
import styles from "./NewsCard.module.css";

export default function NewsCard({ news }) {
  const hasImage = news.img_url;
  const firstLetter = (news.title || "N")[0].toUpperCase();

  const fakePct = news.factcheck_count + news.fake_count > 0 ? Math.round((news.fake_count / (news.factcheck_count + news.fake_count)) * 100) : null;

  let factcheckStatus = "neutral";
  let factcheckLabel = "Sem verificação";
  if (fakePct !== null) {
    if (fakePct >= 50) {
      factcheckStatus = "warning";
      factcheckLabel = "Possível Fake News";
    } else if (news.factcheck_count >= 2) {
      factcheckStatus = "ok";
      factcheckLabel = "Verificado";
    } else {
      factcheckStatus = "neutral";
      factcheckLabel = "Poucos votos";
    }
  }

  return (
    /* Card editorial: usa a carcaça compartilhada, mas SEM `interactive` —
       o `<article>` não é clicável por inteiro, e levantar no hover um elemento
       que não responde ao clique é promessa falsa. */
    <article className={cardStyles.card}>
      <Link href={`/noticias/${news.id}`} className={`${cardStyles.cover} ${styles.cardCover}`}>
        <div className={cardStyles.coverInner}>
          {hasImage ? (
            <Image src={news.img_url} alt={news.title} fill className={cardStyles.coverImg} sizes="(max-width: 600px) 100vw, 400px" />
          ) : (
            <div className={cardStyles.coverPlaceholder}>{firstLetter}</div>
          )}
        </div>
      </Link>

      <div className={cardStyles.body}>
        <Link href={`/noticias/${news.id}`} className={styles.titleLink}>
          <h3 className={cardStyles.title}>{news.title}</h3>
        </Link>

        <p className={cardStyles.desc}>{news.summary}</p>

        {/* Zona 3 — selo de checagem, o "estado" da notícia. */}
        <div className={cardStyles.badges}>
          <span
            className={`${styles.factcheckBadge} ${
              factcheckStatus === "ok" ? styles.factcheckOk : factcheckStatus === "warning" ? styles.factcheckWarning : styles.factcheckNeutral
            }`}
          >
            {factcheckLabel}
          </span>
        </div>

        {/* Zona 4 — autoria à esquerda, engajamento à direita. */}
        <div className={cardStyles.footer}>
          <span className={styles.author}>
            {news.author_avatar_url ? (
              <Image src={news.author_avatar_url} alt={news.author_username} width={20} height={20} className={styles.avatar} />
            ) : (
              <div className={styles.avatarPlaceholder}>{news.author_username?.[0]?.toUpperCase() || "?"}</div>
            )}
            <span className={cardStyles.identity}>{news.author_username}</span>
            <span className={styles.date}>
              ·{" "}
              {new Date(news.created_at).toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </span>

          <span className={cardStyles.metrics}>
            <span className={cardStyles.rating}>
              <StarFillIcon size={14} />
              {Number(news.avg_rating).toFixed(1)}
            </span>
            <span className={styles.statItem}>
              <CommentDiscussionIcon size={13} />
              {news.comment_count}
            </span>
            <span className={`${styles.statItem} ${styles.statCheck}`}>
              <CheckIcon size={13} />
              {news.factcheck_count}
            </span>
            <span className={`${styles.statItem} ${styles.statFake}`}>
              <XIcon size={13} />
              {news.fake_count}
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}
