"use client";
import { useState } from "react";
import { Button } from "@primer/react";

import { MAX_GENRE_NAME_LENGTH } from "@/lib/gameGenres";
import styles from "./GenreSuggest.module.css";

/**
 * "Não encontrou o gênero? Sugira à administração."
 *
 * Mesma forma de `ProfessionSuggest`: fechado por padrão (`<details>`), porque é
 * a saída para a exceção, não o caminho principal — o normal é escolher no
 * seletor.
 *
 * ## A diferença que importa
 *
 * A sugestão carrega `gameId`. Aprovada, o gênero é **vinculado àquele jogo**
 * (regra em `models/gameGenreSuggestion.review`): quem sugeriu já estava
 * classificando a obra, e obrigar a pessoa a voltar e remarcar o gênero novo
 * seria o passo que faz a fila nunca esvaziar. Sem `gameId` o formulário não
 * aparece — sugestão sem jogo de origem não tem onde ser aplicada.
 */
export default function GenreSuggest({ gameId, onSubmitted }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [justification, setJustification] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState({ type: null, text: "" });

  if (!gameId) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage({ type: null, text: "" });

    if (!name.trim()) {
      setMessage({ type: "error", text: "Informe o nome do gênero." });
      return;
    }

    setSending(true);

    try {
      const response = await fetch("/api/v1/game-genre-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          justification: justification.trim() || null,
          game_id: gameId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // A API responde 400 dizendo **qual** gênero já existe — repetir a
        // mensagem evita a pessoa tentar de novo com um nome parecido.
        setMessage({ type: "error", text: data.message || "Não foi possível enviar a sugestão." });
        return;
      }

      setMessage({
        type: "success",
        text: "Sugestão enviada. Se aprovada, o gênero entra no catálogo e é adicionado a este jogo automaticamente.",
      });
      setName("");
      setJustification("");
      onSubmitted?.(data);
    } catch {
      setMessage({ type: "error", text: "Erro de conexão. Tente novamente." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.toggle} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {open ? "Fechar sugestão" : "Não encontrou o gênero? Sugira um novo"}
      </button>

      {open && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <p className={styles.intro}>
            A lista de gêneros é curada pela administração. Diga qual falta — se for aprovado, ele é adicionado a este jogo automaticamente.
          </p>

          <label className={styles.field}>
            <span className={styles.label}>Nome do gênero</span>
            <input
              type="text"
              className={styles.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={MAX_GENRE_NAME_LENGTH}
              placeholder="Ex: Bullet Heaven"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Por que ele faz falta? (opcional)</span>
            <textarea
              className={styles.textarea}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Uma ou duas frases sobre o que esse gênero cobre e de qual gênero ele seria subgênero."
            />
          </label>

          <div className={styles.actions}>
            <Button type="submit" variant="primary" disabled={sending || !name.trim()}>
              {sending ? "Enviando…" : "Enviar sugestão"}
            </Button>
          </div>

          {message.text && (
            <p className={message.type === "success" ? styles.success : styles.error} role="status">
              {message.text}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
