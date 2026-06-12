import Link from "next/link";
import Image from "next/image";
import { StarFillIcon, CommentDiscussionIcon, PeopleIcon } from "@primer/octicons-react";
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
    <article className={styles.card}>
      <Link href={`/noticias/${news.id}`} className={styles.coverLink}>
        {hasImage ? (
          <Image src={news.img_url} alt={news.title} fill className={styles.coverImg} sizes="(max-width: 600px) 100vw, 400px" />
        ) : (
          <div className={styles.coverPlaceholder}>{firstLetter}</div>
        )}
      </Link>

      <div className={styles.body}>
        <Link href={`/noticias/${news.id}`} style={{ textDecoration: "none", color: "inherit" }}>
          <h3 className={styles.title}>{news.title}</h3>
        </Link>

        <p className={styles.summary}>{news.summary}</p>

        <div className={styles.meta}>
          <div className={styles.author}>
            {news.author_avatar_url ? (
              <Image src={news.author_avatar_url} alt={news.author_username} width={20} height={20} className={styles.avatar} />
            ) : (
              <div className={styles.avatarPlaceholder}>{news.author_username?.[0]?.toUpperCase() || "?"}</div>
            )}
            <span>{news.author_username}</span>
          </div>
          <span className={styles.date}>
            {new Date(news.created_at).toLocaleDateString("pt-BR", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>

        <div className={styles.stats}>
          <span className={styles.rating}>
            <StarFillIcon size={14} />
            {Number(news.avg_rating).toFixed(1)}
          </span>
          <span className={styles.statItem}>
            <CommentDiscussionIcon size={13} />
            {news.comment_count}
          </span>
          <span className={styles.statItem}>
            <PeopleIcon size={13} />
            {news.factcheck_count + news.fake_count}
          </span>
          <span
            className={`${styles.factcheckBadge} ${
              factcheckStatus === "ok" ? styles.factcheckOk : factcheckStatus === "warning" ? styles.factcheckWarning : styles.factcheckNeutral
            }`}
          >
            {factcheckLabel}
          </span>
        </div>
      </div>
    </article>
  );
}
