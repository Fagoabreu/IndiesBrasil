import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useUser } from "@/context/UserContext";
import useInView from "@/hooks/useInView";
import { MAX_TESTIMONIAL_CONTENT_LENGTH, MAX_TESTIMONIAL_ROLE_LENGTH } from "@/lib/testimonial";
import styles from "./TestimonialsSection.module.css";

/**
 * Seção de depoimentos da comunidade.
 *
 * - Lista apenas depoimentos aprovados (vindos de `/api/v1/testimonials`).
 * - **Um depoimento por pessoa**: quem já escreveu recebe o formulário
 *   pré-preenchido para editar e um botão para excluir; quem ainda não escreveu
 *   vê o formulário de envio. O servidor recusa um segundo depoimento e explica
 *   que o caminho é editar o existente.
 * - Não renderiza nada enquanto não houver depoimentos e o visitante não
 *   estiver logado.
 */
export default function TestimonialsSection() {
  const { user } = useUser();
  const [ref, isVisible] = useInView({ threshold: 0.08, once: true });
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [role, setRole] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  // Depoimento do próprio usuário (null = ainda não escreveu).
  const [mine, setMine] = useState(null);

  const isLoggedIn = Boolean(user?.id);

  const refreshTestimonials = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/testimonials", { credentials: "include" });
      if (response.ok) {
        setTestimonials(await response.json());
      }
    } catch {
      // Lista pública indisponível não impede o formulário do próprio usuário.
    }
  }, []);

  const refreshMine = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/testimonials/mine", { credentials: "include" });
      if (!response.ok) return null;

      const data = await response.json();
      setMine(data);

      // Preenche o editor com o que já está publicado — é o que transforma o
      // formulário de envio em formulário de edição. Forma funcional de
      // propósito: só preenche campo ainda vazio, para uma resposta tardia não
      // sobrescrever o que a pessoa começou a digitar.
      if (data) {
        setContent((current) => current || data.content || "");
        setRole((current) => current || data.role || "");
      }

      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const response = await fetch("/api/v1/testimonials", { credentials: "include" });
        if (response.ok && !ignore) {
          setTestimonials(await response.json());
        }
      } catch {
        // Sem lista, a seção ainda mostra o formulário de quem está logado.
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, []);

  // O depoimento próprio só existe com sessão; ao sair (logout) o estado é
  // zerado para o formulário não continuar preenchido com dado de outra sessão.
  // `Promise.resolve().then` mantém o `setState` fora do corpo do efeito —
  // `react-hooks/set-state-in-effect` acusa chamada síncrona aqui.
  useEffect(() => {
    Promise.resolve().then(() => {
      if (!isLoggedIn) {
        setMine(null);
        setContent("");
        setRole("");
        return;
      }

      return refreshMine();
    });
  }, [isLoggedIn, refreshMine]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!content.trim()) {
      setFeedback({ type: "error", text: "Escreva seu depoimento antes de enviar." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const isEditing = Boolean(mine);

    try {
      const response = await fetch(isEditing ? "/api/v1/testimonials/mine" : "/api/v1/testimonials", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: content.trim(), role: role.trim() || null }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFeedback({ type: "error", text: data.message || "Não foi possível salvar o depoimento." });

        // Outra aba (ou um envio anterior) pode ter criado o depoimento: adota
        // o existente em vez de deixar o formulário preso no modo de criação.
        if (!isEditing && data.message?.includes("já tem um depoimento")) {
          await refreshMine();
        }

        return;
      }

      setMine(data);
      setFeedback({
        type: "success",
        text: isEditing ? "Depoimento atualizado!" : "Depoimento enviado! Obrigado por contribuir com a comunidade.",
      });
      await refreshTestimonials();
    } catch {
      setFeedback({ type: "error", text: "Não foi possível salvar o depoimento. Tente novamente." });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Excluir seu depoimento? Ele sai da página inicial imediatamente.")) {
      return;
    }

    setRemoving(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/v1/testimonials/mine", {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setFeedback({ type: "error", text: data.message || "Não foi possível excluir o depoimento." });
        return;
      }

      setMine(null);
      setContent("");
      setRole("");
      setFeedback({ type: "success", text: "Depoimento excluído." });
      await refreshTestimonials();
    } catch {
      setFeedback({ type: "error", text: "Não foi possível excluir o depoimento. Tente novamente." });
    } finally {
      setRemoving(false);
    }
  }

  if (loading) {
    return null;
  }

  if (testimonials.length === 0 && !isLoggedIn) {
    return null;
  }

  const busy = submitting || removing;

  return (
    <section ref={ref} className={`${styles.section} ${isVisible ? styles.visible : ""}`}>
      <header className={styles.header}>
        <p className={styles.label}>Comunidade</p>
        <h2 className={styles.title}>Quem vive a cena indie recomenda</h2>
        <p className={styles.sub}>Depoimentos de membros que fazem parte da Indies Brasil.</p>
      </header>

      {testimonials.length > 0 && (
        <div className={styles.grid}>
          {testimonials.map((testimonial) => (
            <figure key={testimonial.id} className={styles.card}>
              <blockquote className={styles.quote}>“{testimonial.content}”</blockquote>
              <figcaption className={styles.author}>
                {testimonial.avatar_image ? (
                  <Image src={testimonial.avatar_image} alt={`Avatar de ${testimonial.username}`} width={44} height={44} className={styles.avatar} />
                ) : (
                  <span className={styles.avatarFallback}>{(testimonial.username || "?").charAt(0).toUpperCase()}</span>
                )}
                <span className={styles.authorMeta}>
                  <span className={styles.authorName}>{testimonial.resumo || testimonial.username}</span>
                  {testimonial.role && <span className={styles.authorRole}>{testimonial.role}</span>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {isLoggedIn && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formHeader}>
            <p className={styles.formTitle}>{mine ? "Seu depoimento" : "Deixe seu depoimento"}</p>
            <p className={styles.formHint}>
              {mine
                ? "Você pode editar o texto ou excluir o depoimento a qualquer momento."
                : "Conte como a comunidade impactou sua jornada. É um depoimento por pessoa."}
            </p>
          </div>

          <textarea
            className={styles.textarea}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={MAX_TESTIMONIAL_CONTENT_LENGTH}
            rows={3}
            placeholder="Escreva seu depoimento..."
            aria-label="Seu depoimento"
            disabled={busy}
          />

          <div className={styles.formRow}>
            <input
              className={styles.input}
              value={role}
              onChange={(event) => setRole(event.target.value)}
              maxLength={MAX_TESTIMONIAL_ROLE_LENGTH}
              placeholder="Sua função (ex.: Desenvolvedor, Artista) — opcional"
              aria-label="Sua função"
              disabled={busy}
            />
            <button type="submit" className={styles.submitBtn} disabled={busy}>
              {submitting ? "Salvando..." : mine ? "Salvar alterações" : "Enviar depoimento"}
            </button>
            {mine && (
              <button type="button" className={styles.removeBtn} onClick={handleRemove} disabled={busy}>
                {removing ? "Excluindo..." : "Excluir"}
              </button>
            )}
          </div>

          <p className={styles.counter}>
            {content.length}/{MAX_TESTIMONIAL_CONTENT_LENGTH}
          </p>

          {feedback && <p className={feedback.type === "success" ? styles.feedbackSuccess : styles.feedbackError}>{feedback.text}</p>}
        </form>
      )}
    </section>
  );
}
