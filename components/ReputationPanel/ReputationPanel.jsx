import { useEffect, useState } from "react";
import PropTypes from "prop-types";

import { REPUTATION_ACTIONS } from "@/lib/reputation-constants";

import styles from "./ReputationPanel.module.css";

function formatDateBR(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

ReputationPanel.propTypes = {
  username: PropTypes.string.isRequired,
};

export default function ReputationPanel({ username }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/users/${username}/reputation`, {
          credentials: "include",
        });
        const json = await res.json();
        if (!cancelled) {
          if (res.ok) setData(json);
          else setError(json?.message || "Não foi possível carregar a reputação.");
        }
      } catch {
        if (!cancelled) setError("Não foi possível carregar a reputação.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (error) return <p className={styles.error}>{error}</p>;
  if (!data) return null;

  const events = Array.isArray(data.events) ? data.events : [];

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Reputação</span>
        <span className={styles.score}>{data.reputation ?? 0}</span>
      </div>

      {events.length === 0 ? (
        <p className={styles.empty}>Nenhum evento de pontuação ainda.</p>
      ) : (
        <ul className={styles.list}>
          {events.map((event) => (
            <li key={`${event.action}-${event.reference_id}-${event.created_at}`} className={styles.item}>
              <span className={styles.label}>{REPUTATION_ACTIONS[event.action]?.label || event.action}</span>
              <span className={`${styles.points} ${event.points < 0 ? styles.negative : styles.positive}`}>
                {event.points > 0 ? "+" : ""}
                {event.points}
              </span>
              <span className={styles.date}>{formatDateBR(event.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
