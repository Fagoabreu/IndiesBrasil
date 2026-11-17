import Link from "next/link";
import PropTypes from "prop-types";
import styles from "./CommunityFeed.module.css";

/**
 * Prévia do feed na home.
 *
 * A página se apresenta como "a rede social dos jogos independentes
 * brasileiros" e não mostrava um único post: portas de entrada e vitrine
 * cobriam o catálogo, não a conversa. Aqui ficam os três posts mais recentes,
 * como links — sem curtir, comentar ou responder (para isso existe `/posts`).
 * O objetivo é provar que a comunidade está ativa, não substituir o feed.
 *
 * Os dados chegam do `getServerSideProps` da home: o HTML sai com
 * `href="/posts/<id>"`, como os destaques.
 */
const EXCERPT_LENGTH = 160;

// Fuso fixo: o SSR roda em UTC e o navegador em BRT — sem `timeZone` a mesma
// data sairia diferente nos dois lados (mismatch de hidratação), e o padrão do
// projeto é exibir horário de Brasília.
const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
});

function excerptOf(content) {
  const flat = String(content ?? "")
    .replace(/\s+/g, " ")
    .trim();

  return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH).trimEnd()}…` : flat;
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return DATE_FORMAT.format(date);
}

function reactionsOf(post) {
  const likes = Number.parseInt(post.likes_count, 10) || 0;
  const comments = Number.parseInt(post.comments_count, 10) || 0;
  const parts = [];

  // "0 curtidas" é ruído: só entra o que existe.
  if (likes > 0) parts.push(`${likes} ${likes === 1 ? "curtida" : "curtidas"}`);
  if (comments > 0) parts.push(`${comments} ${comments === 1 ? "comentário" : "comentários"}`);

  return parts.join(" · ");
}

export default function CommunityFeed({ posts = [] }) {
  if (!posts.length) return null;

  return (
    <ul className={styles.list}>
      {posts.map((post) => {
        const reactions = reactionsOf(post);

        return (
          <li key={post.id}>
            <Link href={`/posts/${post.id}`} className={styles.item}>
              <span className={styles.meta}>
                <span className={styles.author}>@{post.author_username}</span>
                <span className={styles.date}>{formatDate(post.created_at)}</span>
              </span>
              <span className={styles.excerpt}>{excerptOf(post.content)}</span>
              {reactions && <span className={styles.reactions}>{reactions}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

CommunityFeed.propTypes = {
  posts: PropTypes.arrayOf(
    PropTypes.shape({
      // `posts.id` é inteiro (serial), mas o card aceita string também: o valor
      // atravessa `JSON.parse(JSON.stringify())` no `getServerSideProps`.
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      content: PropTypes.string,
      created_at: PropTypes.string,
      author_username: PropTypes.string,
      likes_count: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      comments_count: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }),
  ),
};
