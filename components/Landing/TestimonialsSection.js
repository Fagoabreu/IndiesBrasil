import { useEffect, useState } from "react";
import Image from "next/image";
import { useUser } from "@/context/UserContext";
import useInView from "@/hooks/useInView";
import styles from "./TestimonialsSection.module.css";

const MAX_CONTENT_LENGTH = 500;

/**
 * Seção de depoimentos da comunidade.
 * - Lista apenas depoimentos aprovados (vindos de /api/v1/testimonials).
 * - Não renderiza nada enquanto não houver depoimentos e o visitante
 *   não estiver logado.
 * - Membros logados veem um formulário para deixar o próprio depoimento.
 */
export default function TestimonialsSection() {
  const { user } = useUser();
  const [ref, isVisible] = useInView({ threshold: 0.08 });
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [role, setRole] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function refreshTestimonials() {
    try {
      const response = await fetch("/api/v1/testimonials", { credentials: "include" });
      if (response.ok) {
        setTestimonials(await response.json());
      }
    } catch (error) {
      console.error("Erro ao buscar depoimentos:", error);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const response = await fetch("/api/v1/testimonials", { credentials: "include" });
        if (response.ok && !ignore) {
          setTestimonials(await response.json());
        }
      } catch (error) {
        console.error("Erro ao buscar depoimentos:", error);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!content.trim()) {
      setFeedback({ type: "error", text: "Escreva seu depoimento antes de enviar." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/v1/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: content.trim(), role: role.trim() || null }),
      });

      const data = await response.json();

      if (response.ok) {
        setContent("");
        setRole("");
        setFeedback({ type: "success", text: "Depoimento enviado! Obrigado por contribuir com a comunidade." });
        await refreshTestimonials();
      } else {
        setFeedback({ type: "error", text: data.message || "Não foi possível enviar o depoimento." });
      }
    } catch {
      setFeedback({ type: "error", text: "Não foi possível enviar o depoimento. Tente novamente." });
    } finally {
      setSubmitting(false);
    }
  }

  const isLoggedIn = Boolean(user?.id);

  if (loading) {
    return null;
  }

  if (testimonials.length === 0 && !isLoggedIn) {
    return null;
  }

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
            <p className={styles.formTitle}>Deixe seu depoimento</p>
            <p className={styles.formHint}>Conte como a comunidade impactou sua jornada.</p>
          </div>

          <textarea
            className={styles.textarea}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={MAX_CONTENT_LENGTH}
            rows={3}
            placeholder="Escreva seu depoimento..."
            disabled={submitting}
          />

          <div className={styles.formRow}>
            <input
              className={styles.input}
              value={role}
              onChange={(event) => setRole(event.target.value)}
              maxLength={80}
              placeholder="Sua função (ex.: Desenvolvedor, Artista) — opcional"
              disabled={submitting}
            />
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar depoimento"}
            </button>
          </div>

          {feedback && <p className={feedback.type === "success" ? styles.feedbackSuccess : styles.feedbackError}>{feedback.text}</p>}
        </form>
      )}
    </section>
  );
}
