import { useState } from "react";
import styles from "./PollComponent.module.css";

export default function PollComponent({ postId, question, options, userVote, endedAt, isAuthor }) {
  const [voteData, setVoteData] = useState(userVote || null);
  const [results, setResults] = useState(options);
  const [ended, setEnded] = useState(!!endedAt);

  const totalVotes = results.reduce((sum, o) => sum + o.votes_count, 0);

  const handleVote = async (optionId) => {
    const previousVote = voteData;
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

      // Atualiza contagens localmente conforme a ação
      setResults((prev) =>
        prev.map((o) => {
          if (data.voted) {
            // Novo voto: +1 na opção clicada, -1 na anterior (se diferente)
            if (o.id === optionId) return { ...o, votes_count: o.votes_count + 1 };
            if (o.id === previousVote && previousVote !== optionId) return { ...o, votes_count: o.votes_count - 1 };
            return o;
          }
          // Toggle off (mesma opção): apenas -1
          if (o.id === optionId) return { ...o, votes_count: o.votes_count - 1 };
          return o;
        }),
      );
    }
  };

  const handleEndPoll = async () => {
    const res = await fetch(`/api/v1/posts/${postId}/poll`, {
      method: "PUT",
      credentials: "include",
    });
    if (res.ok) setEnded(true);
  };

  const lockedByEnd = ended;
  const hasVoted = !!voteData;

  return (
    <div className={styles.poll}>
      {question && <p className={styles.question}>{question}</p>}
      {results.map((opt) => {
        const pct = totalVotes > 0 ? Math.round((opt.votes_count / totalVotes) * 100) : 0;
        const isSelected = voteData === opt.id;
        // Enquete encerrada: só mostra resultados, sem clique
        // Enquete ativa SEM voto: mostra opções clicáveis (modo votação)
        // Enquete ativa COM voto: mostra resultados + permite trocar de opção
        const clickable = !lockedByEnd;

        return (
          <button
            key={opt.id}
            type="button"
            className={`${styles.option} ${hasVoted || lockedByEnd ? styles.optionResult : ""} ${isSelected ? styles.selected : ""} ${clickable && hasVoted && !isSelected ? styles.changeable : ""}`}
            onClick={() => clickable && handleVote(opt.id)}
            disabled={!clickable}
          >
            {hasVoted || lockedByEnd ? (
              <div className={styles.resultBar}>
                <div className={styles.resultFill} style={{ width: `${pct}%` }} />
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

      {!hasVoted && !lockedByEnd && totalVotes > 0 && (
        <p className={styles.hint}>
          {totalVotes} voto{totalVotes !== 1 ? "s" : ""}
        </p>
      )}

      {hasVoted && !lockedByEnd && (
        <p className={styles.hint}>
          {totalVotes} voto{totalVotes !== 1 ? "s" : ""} &middot; Clique em outra opção para mudar seu voto
        </p>
      )}

      {lockedByEnd && (
        <p className={styles.total}>
          {totalVotes} voto{totalVotes !== 1 ? "s" : ""} &middot; Enquete encerrada
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
