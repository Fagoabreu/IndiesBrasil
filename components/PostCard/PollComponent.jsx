import { useState } from "react";
import styles from "./PollComponent.module.css";

export default function PollComponent({
  postId,
  question,
  options,
  userVote,
  endedAt,
  isAuthor,
}) {
  const [voteData, setVoteData] = useState(userVote || null);
  const [results, setResults] = useState(options);
  const [ended, setEnded] = useState(!!endedAt);

  const totalVotes = results.reduce((sum, o) => sum + o.votes_count, 0);

  const handleVote = async (optionId) => {
    const formData = new FormData();
    formData.append("poll_option_id", optionId);

    const res = await fetch(`/api/v1/posts/${postId}/poll`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      setVoteData(data.voted ? optionId : null);
      // Recarrega resultados
      const updated = results.map((o) => ({
        ...o,
        votes_count:
          o.id === optionId
            ? data.voted
              ? o.votes_count + 1
              : o.votes_count - 1
            : o.votes_count,
      }));
      setResults(updated);
    }
  };

  const handleEndPoll = async () => {
    const res = await fetch(`/api/v1/posts/${postId}/poll`, {
      method: "PUT",
      credentials: "include",
    });
    if (res.ok) setEnded(true);
  };

  const showResults = ended || !!voteData;

  return (
    <div className={styles.poll}>
      {question && <p className={styles.question}>{question}</p>}
      {results.map((opt) => {
        const pct =
          totalVotes > 0 ? Math.round((opt.votes_count / totalVotes) * 100) : 0;
        const isSelected = voteData === opt.id;

        return (
          <button
            key={opt.id}
            type="button"
            className={`${styles.option} ${showResults ? styles.optionResult : ""} ${isSelected ? styles.selected : ""}`}
            onClick={() => !showResults && handleVote(opt.id)}
            disabled={showResults}
          >
            {showResults ? (
              <div className={styles.resultBar}>
                <div
                  className={styles.resultFill}
                  style={{ width: `${pct}%` }}
                />
                <span className={styles.resultLabel}>
                  {opt.label}
                  <span className={styles.resultPct}>{pct}%</span>
                </span>
              </div>
            ) : (
              <span className={styles.optionLabel}>{opt.label}</span>
            )}
          </button>
        );
      })}

      {!showResults && totalVotes > 0 && (
        <p className={styles.hint}>
          {totalVotes} voto{totalVotes !== 1 ? "s" : ""}
        </p>
      )}

      {showResults && (
        <p className={styles.total}>
          {totalVotes} voto{totalVotes !== 1 ? "s" : ""}
        </p>
      )}

      {isAuthor && !ended && (
        <button type="button" className={styles.endBtn} onClick={handleEndPoll}>
          Encerrar enquete
        </button>
      )}
    </div>
  );
}
