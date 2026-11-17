import Link from "next/link";
import PropTypes from "prop-types";
import {
  ArchiveIcon,
  BookIcon,
  BroadcastIcon,
  CodeReviewIcon,
  LightBulbIcon,
  MilestoneIcon,
  OrganizationIcon,
  PaperAirplaneIcon,
  PeopleIcon,
  TableIcon,
  ToolsIcon,
  VideoIcon,
} from "@primer/octicons-react";
import { LANDING_CATEGORIES, parseSummaryCount } from "@/lib/landing";
import styles from "./CategoryTiles.module.css";

/**
 * O mapa do produto na primeira rolagem.
 *
 * Responde à pergunta que o hero sozinho não responde — "o que existe aí
 * dentro?" — com o rótulo do que a pessoa encontra em cada listagem, e não com
 * um número solto. A contagem vem de `/api/v1/status/summary` e é opcional de
 * propósito: a porta (link + rótulo) funciona sem JavaScript e sem número.
 * Categoria vazia não mostra "0" — um zero na vitrine desencoraja a visita.
 */
const ICONS = {
  game: VideoIcon,
  table: TableIcon,
  book: BookIcon,
  asset: ArchiveIcon,
  studio: OrganizationIcon,
  service: ToolsIcon,
  community: PeopleIcon,
  news: PaperAirplaneIcon,
  review: CodeReviewIcon,
  course: LightBulbIcon,
  live: BroadcastIcon,
  event: MilestoneIcon,
};

function countOf(summary, state, metric) {
  if (!metric || state !== "ready" || !summary) return null;

  return parseSummaryCount(summary[metric]);
}

export default function CategoryTiles({ categories = LANDING_CATEGORIES, summary = null, state = "loading" }) {
  return (
    // `aria-busy` avisa a tecnologia assistiva que os números ainda estão
    // chegando: as portas já estão navegáveis, o contador não.
    <ul className={styles.grid} aria-busy={state === "loading"}>
      {categories.map((category) => {
        const Icon = ICONS[category.icon] || ArchiveIcon;
        const count = countOf(summary, state, category.metric);

        return (
          <li key={category.href} className={styles.item}>
            <Link href={category.href} className={styles.tile}>
              <span className={styles.icon} aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className={styles.body}>
                <span className={styles.label}>{category.label}</span>
                <span className={styles.hint}>{category.hint}</span>
              </span>
              {count !== null && <span className={styles.count}>{count}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

CategoryTiles.propTypes = {
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      href: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      hint: PropTypes.string,
      icon: PropTypes.string,
      metric: PropTypes.string,
    }),
  ),
  summary: PropTypes.object,
  state: PropTypes.oneOf(["loading", "ready", "error"]),
};
