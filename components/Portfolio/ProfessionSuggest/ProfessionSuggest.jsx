"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@primer/react";

import { MAX_PROFESSION_NAME_LENGTH, MAX_PROFESSION_SUGGESTION_LENGTH } from "@/lib/professionGroups";
import styles from "./ProfessionSuggest.module.css";

/**
 * "Não encontrou sua especialização? Sugira à administração."
 *
 * Fica **dentro** do editor de especializações em vez de numa página própria
 * porque não existe `/profissoes`: uma rota nova para o formulário deixaria o
 * usuário sem a tela onde ele estava cadastrando, e ele teria de voltar depois
 * para escolher a profissão (que só existe após a aprovação).
 *
 * Fechado por padrão (`<details>`): é saída para o caso de exceção, não o
 * caminho principal — o normal é escolher no seletor.
 *
 * O `name` pré-preenchido ajuda quando o usuário já digitou algo que não existe;
 * o componente aceita `initialName` para isso.
 */
export default function ProfessionSuggest({ initialName = "" }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [justification, setJustification] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState({ type: null, text: "" });

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage({ type: null, text: "" });

    if (!name.trim()) {
      setMessage({ type: "error", text: "Informe o nome da profissão." });
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/v1/profession-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), justification: justification.trim() || null }),
      });
      const data = await response.json();

      if (!response.ok) {
        // A API responde 400 dizendo **qual** profissão já existe — repetir a
        // mensagem evita a pessoa tentar de novo com um nome parecido.
        setMessage({ type: "error", text: data.message || "Não foi possível enviar a sugestão." });
        return;
      }

      setMessage({
        type: "success",
        text: "Sugestão enviada. A administração avalia e, se aprovada, ela aparece no seletor.",
      });
      setName("");
      setJustification("");
    } catch {
      setMessage({ type: "error", text: "Erro de conexão. Tente novamente." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.toggle} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {open ? "Fechar sugestão" : "Não encontrou? Sugira uma profissão"}
      </button>

      {open && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <p className={styles.intro}>A lista de profissões é curada pela administração. Diga qual falta — qualquer pessoa com conta pode sugerir.</p>

          <label className={styles.field}>
            <span className={styles.label}>Nome da profissão</span>
            <input
              type="text"
              className={styles.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={MAX_PROFESSION_NAME_LENGTH}
              placeholder="Ex: Roteirista de Missões"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Por que ela faz falta? (opcional)</span>
            <textarea
              className={styles.textarea}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              maxLength={MAX_PROFESSION_SUGGESTION_LENGTH}
              rows={3}
              placeholder="Uma ou duas frases sobre o que essa profissão cobre."
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

      <p className={styles.link}>
        Precisa de uma profissão nova agora? <Link href="/perfil">Veja o diretório de membros</Link> enquanto a sugestão é avaliada.
      </p>
    </div>
  );
}
