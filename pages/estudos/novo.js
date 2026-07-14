"use client";
import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Heading, Spinner, Button } from "@primer/react";
import { ArrowLeftIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { SITE_URL } from "@/lib/seo";
import styles from "./[slug]/curso.module.css";

const PAGE_TITLE = "Criar curso — Indies Brasil";
const PAGE_URL = `${SITE_URL}/estudos/novo`;

const SUGGESTED_TAGS = [
  "Jogo",
  "Unity",
  "Godot",
  "Arte",
  "Som",
  "Programação",
  "Design",
  "Marketing",
];

export default function NovoCursoPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTag, setCustomTag] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggleTag(tag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function addCustomTag() {
    const trimmed = customTag.trim().toLowerCase();
    if (trimmed.length < 2 || selectedTags.includes(trimmed)) {
      setCustomTag("");
      return;
    }
    setSelectedTags((prev) => [...prev, trimmed]);
    setCustomTag("");
  }

  function handleCustomTagKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomTag();
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!title.trim() || title.trim().length < 3) {
      setError("O título do curso deve ter pelo menos 3 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || "",
          tags: selectedTags,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Erro ao criar o curso.");
        return;
      }

      const course = await res.json();
      router.push(`/estudos/${course.slug}`);
    } catch {
      setError("Erro de conexão ao criar o curso.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <SeoHead
        title={PAGE_TITLE}
        canonical={PAGE_URL}
        openGraph={{ title: PAGE_TITLE, url: PAGE_URL }}
      />

      <Link href="/estudos" className={styles.backLink}>
        <ArrowLeftIcon size={14} /> Voltar para cursos
      </Link>

      <Heading as="h1" className={styles.formTitle}>
        Criar curso
      </Heading>

      {error && (
        <div className={styles.formError} role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Title */}
        <div className={styles.field}>
          <label htmlFor="course-title" className={styles.label}>
            Título <span className={styles.required}>*</span>
          </label>
          <input
            id="course-title"
            type="text"
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Introdução ao Unity para iniciantes"
            maxLength={200}
            required
            disabled={submitting}
          />
          <span className={styles.hint}>{title.length}/200 caracteres</span>
        </div>

        {/* Description */}
        <div className={styles.field}>
          <label htmlFor="course-desc" className={styles.label}>
            Descrição
          </label>
          <textarea
            id="course-desc"
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva o que será abordado no curso..."
            rows={4}
            disabled={submitting}
          />
        </div>

        {/* Tags */}
        <div className={styles.field}>
          <span className={styles.label}>Tags</span>
          <div className={styles.tagRow}>
            {SUGGESTED_TAGS.map((tag) => {
              const tagLower = tag.toLowerCase();
              const isActive = selectedTags.includes(tagLower);
              return (
                <button
                  key={tag}
                  type="button"
                  className={`${styles.tagChip} ${isActive ? styles.tagChipActive : ""}`}
                  onClick={() => toggleTag(tagLower)}
                  disabled={submitting}
                  aria-pressed={isActive}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          <div className={styles.customTagRow}>
            <input
              type="text"
              className={styles.input}
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={handleCustomTagKeyDown}
              placeholder="Adicionar tag personalizada..."
              disabled={submitting}
            />
            <Button
              type="button"
              variant="default"
              onClick={addCustomTag}
              disabled={submitting || customTag.trim().length < 2}
            >
              Adicionar
            </Button>
          </div>

          {selectedTags.length > 0 && (
            <div className={styles.selectedTags}>
              {selectedTags.map((tag) => (
                <span key={tag} className={styles.selectedTagItem}>
                  {tag}
                  <button
                    type="button"
                    className={styles.removeTagBtn}
                    onClick={() => toggleTag(tag)}
                    disabled={submitting}
                    aria-label={`Remover tag ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className={styles.formActions}>
          <Link href="/estudos" className={styles.btnOutline}>
            Cancelar
          </Link>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Spinner size="small" /> Criando...
              </>
            ) : (
              "Criar curso"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
