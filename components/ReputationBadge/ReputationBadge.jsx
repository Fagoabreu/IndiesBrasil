import { ShieldCheckIcon } from "@primer/octicons-react";
import PropTypes from "prop-types";

import { getReputationLevel } from "@/lib/reputation-constants";

import styles from "./ReputationBadge.module.css";

ReputationBadge.propTypes = {
  value: PropTypes.number,
  showLevel: PropTypes.bool,
};

export default function ReputationBadge({ value = 0, showLevel = false }) {
  const level = getReputationLevel(value);

  return (
    <span className={styles.badge} title={`Reputação: ${value} pontos — Nível: ${level.label}`}>
      <ShieldCheckIcon size={14} />
      <span className={styles.value}>{value}</span>
      {showLevel && <span className={styles.level}>{level.label}</span>}
    </span>
  );
}
