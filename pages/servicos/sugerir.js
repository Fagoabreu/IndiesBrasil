import { useState } from "react";
import Link from "next/link";
import { Heading, Flash, Button } from "@primer/react";
import { ArrowLeftIcon } from "@primer/octicons-react";

import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import styles from "./sugerir.module.css";

/**
 * Sugestão de serviço para o catálogo.
 *
 * Página própria (e não modal) porque o link circula — "faltou um serviço?
 * sugira" — e um modal não sobrevive a recarregar. Qualquer usuário autenticado
 * pode sugerir; o admin decide em `/admin/services`, e aprovar cria o serviço.
 *
 * `noIndex`: é formulário de operação, não conteúdo que se queira no buscador.
 */
export default function SugerirServicoPage() {
  const { user, loadingUser } = useUser();

  const [name, setName] = useState("");
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/v1/service-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), justification: justification.trim() || null }),
      });
      const data = await response.json();

      if (!response.ok) {
        // A API responde 400 dizendo **qual** serviço já existe — repetir a
        // mensagem é o que evita a pessoa tentar de novo com outro nome
        // parecido.
        setError(data.message || "Não foi possível enviar a sugestão.");
        return;
      }

      setSent(true);
      setName("");
      setJustification("");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SeoHead
        title="Sugerir um serviço — Indies Brasil"
        description="Sugira um serviço para o catálogo do Indies Brasil."
        canonical="https://jogos.social.br/servicos/sugerir"
        noIndex
      />

      <div className={styles.page}>
        <Link href="/servicos" className={styles.backLink}>
          <ArrowLeftIcon size={14} /> Serviços
        </Link>

        <Heading as="h1" className={styles.title}>
          Sugerir um serviço
        </Heading>
        <p className={styles.subtitle}>
          O catálogo de serviços é curado pela administração. Se falta algum que você presta ou gostaria de contratar, escreva aqui — a sugestão vai
          para a fila de decisão.
        </p>

        {!user && !loadingUser && (
          <Flash variant="warning">
            Você precisa estar logado para sugerir. <Link href="/login?next=%2Fservicos%2Fsugerir">Entrar</Link>
          </Flash>
        )}

        {sent && <Flash variant="success">Sugestão enviada. Obrigado — a administração vai avaliar.</Flash>}
        {error && <Flash variant="danger">{error}</Flash>}

        {user && (
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span className={styles.label}>
                Nome do serviço <span className={styles.required}>*</span>
              </span>
              <input
                type="text"
                className={styles.input}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="Ex: Captura de performance (mocap)"
                required
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Por que ele faz falta?</span>
              <textarea
                className={styles.textarea}
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Conte em uma ou duas frases o que esse serviço cobre e quem costuma precisar dele."
              />
              <span className={styles.hint}>
                {justification.length}/{500} caracteres
              </span>
            </label>

            <div className={styles.actions}>
              <Button type="submit" variant="primary" disabled={submitting || !name.trim()}>
                {submitting ? "Enviando…" : "Enviar sugestão"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
