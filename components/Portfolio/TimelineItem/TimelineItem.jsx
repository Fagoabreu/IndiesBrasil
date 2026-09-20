import PropTypes from "prop-types";
import DateUtils from "@/utils/DateUtils";
import styles from "./TimelineItem.module.css";

/**
 * Item de currículo com período — usado pelo histórico profissional e pela
 * formação acadêmica.
 *
 * Antes eram dois componentes (`HistoricoItem` e `FormacaoItem`) com o mesmo
 * desenho e dois CSS Modules quase idênticos, que só diferiam nos nomes dos
 * campos. A diferença entre cargo/empresa e curso/instituição é de dado, não de
 * layout, então virou prop.
 *
 * @param {string}   title    - Cargo ou curso.
 * @param {string}   startDate - Início (ISO).
 * @param {string}   [endDate] - Término (ISO). Vazio = "Atual".
 * @param {string}   [subtitle] - Empresa/instituição e local, já formatados.
 * @param {string[]} [entries] - Atribuições/bullets.
 */
export default function TimelineItem({ title, startDate, endDate, subtitle, entries }) {
  const period = formatPeriod(startDate, endDate);

  return (
    <div className={styles.item}>
      <div className={styles.header}>
        <strong className={styles.title}>{title}</strong>
        {period && <span className={styles.period}>{period}</span>}
      </div>

      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}

      {Array.isArray(entries) && entries.length > 0 && (
        <ul className={styles.entries}>
          {entries.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "03/2020 — Atual". Devolve "" quando não há data de início. */
function formatPeriod(startDate, endDate) {
  if (!startDate) return "";
  const start = DateUtils.formatMonthYear(startDate);
  const end = endDate ? DateUtils.formatMonthYear(endDate) : "Atual";
  return `${start} — ${end}`;
}

TimelineItem.propTypes = {
  title: PropTypes.string.isRequired,
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  subtitle: PropTypes.string,
  entries: PropTypes.arrayOf(PropTypes.string),
};
