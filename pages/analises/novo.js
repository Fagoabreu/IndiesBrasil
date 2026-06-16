"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";
import { useUser } from "@/context/UserContext";
import styles from "./novo.module.css";

const CONTENT_TYPE_OPTIONS = [
  { value: "game", label: "Jogo" },
  { value: "boardgame", label: "Jogo de Mesa" },
  { value: "book", label: "Livro/Quadrinho" },
];

const RATINGS = [1, 2, 3, 4, 5];

function emptySection(type = "text") {
  const base = { type, subtitle: "" };
  if (type === "text") base.content = "";
  if (type === "image") base.image_url = "";
  if (type === "video") base.embed_url = "";
  return base;
}

export default function NovaAnalisePage() {
  const router = useRouter();
  const { user, loadingUser } = useUser();
  const { tipo, content_id, edit } = router.query;

  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState("");
  const [contentId, setContentId] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [rating, setRating] = useState(null);
  const [sections, setSections] = useState([emptySection("text")]);
  const [positivePoints, setPositivePoints] = useState([""]);
  const [negativePoints, setNegativePoints] = useState([""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingSlug, setEditingSlug] = useState("");

  // Preencher content_type e content_id dos query params
  useEffect(() => {
    if (tipo && CONTENT_TYPE_OPTIONS.find((o) => o.value === tipo)) {
      setContentType(tipo);
    }
    if (content_id) {
      setContentId(content_id);
    }
  }, [tipo, content_id]);

  // Carregar dados para edição
  const fetchForEdit = useCallback(async () => {
    if (!edit) return;
    try {
      const res = await fetch(`/api/v1/analises/${edit}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setTitle(data.title);
      setContentType(data.content_type);
      setContentId(data.content_id);
      setCoverImageUrl(data.cover_url || "");
      setRating(data.rating);
      setSections(data.sections?.length ? data.sections : [emptySection("text")]);
      setPositivePoints(data.positive_points?.length ? data.positive_points : [""]);
      setNegativePoints(data.negative_points?.length ? data.negative_points : [""]);
      setIsEditing(true);
      setEditingSlug(data.slug);
    } catch {
      // ignore
    }
  }, [edit]);

  useEffect(() => {
    fetchForEdit();
  }, [fetchForEdit]);

  // Redirecionar se não logado
  useEffect(() => {
    if (!loadingUser && !user) {
      router.push("/login");
    }
  }, [user, loadingUser, router]);

  function updateSection(index, field, value) {
    setSections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addSection(type = "text") {
    setSections((prev) => [...prev, emptySection(type)]);
  }

  function removeSection(index) {
    if (sections.length <= 1) return;
    setSections((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePoint(arr, setter, index, value) {
    setter((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function addPoint(arr, setter) {
    setter((prev) => [...prev, ""]);
  }

  function removePoint(arr, setter, index) {
    if (arr.length <= 1) return;
    setter((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Título é obrigatório.");
      return;
    }
    if (!contentType) {
      setError("Selecione o tipo de conteúdo.");
      return;
    }
    if (!contentId) {
      setError("Informe o conteúdo (jogo/boardgame/livro) que está sendo analisado.");
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        title: title.trim(),
        content_type: contentType,
        content_id: contentId,
        cover_url: coverImageUrl.trim() || null,
        rating,
        sections: sections.filter((s) => {
          if (s.type === "text") return s.subtitle || s.content;
          if (s.type === "image") return s.image_url;
          if (s.type === "video") return s.embed_url;
          return false;
        }),
        positive_points: positivePoints.filter(Boolean),
        negative_points: negativePoints.filter(Boolean),
      };

      let res;
      if (isEditing) {
        res = await fetch(`/api/v1/analises/${editingSlug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/v1/analises", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Erro ao salvar análise.");
        return;
      }

      router.push(`/analises/${data.slug}`);
    } catch {
      setError("Erro de conexão ao salvar.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingUser || !user) {
    return (
      <div className={styles.loadingPage}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{isEditing ? "Editar Análise" : "Nova Análise"} — Indies Brasil</title>
      </Head>

      <div className={styles.page}>
        <h1 className={styles.pageTitle}>{isEditing ? "Editar Análise" : "Nova Análise"}</h1>

        {error && <div className={styles.error}>{error}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Campos básicos */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Título *</label>
            <input
              type="text"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Digite o título da análise..."
              maxLength={255}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Tipo de Conteúdo *</label>
              <select className={styles.select} value={contentType} onChange={(e) => setContentType(e.target.value)} disabled={!!tipo}>
                <option value="">Selecione...</option>
                {CONTENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Nota (1–5)</label>
              <div className={styles.ratingPicker}>
                {RATINGS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`${styles.ratingBtn} ${rating === r ? styles.ratingActive : ""}`}
                    onClick={() => setRating(rating === r ? null : r)}
                  >
                    {r} ★
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>ID do Conteúdo (UUID) *</label>
            <input
              type="text"
              className={styles.input}
              value={contentId}
              onChange={(e) => setContentId(e.target.value)}
              placeholder="UUID do jogo, boardgame ou livro"
              disabled={!!content_id}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>URL da Imagem de Capa</label>
            <input
              type="text"
              className={styles.input}
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://... (URL da imagem de capa)"
            />
            {coverImageUrl && (
              <div className={styles.coverPreview}>
                <Image
                  src={coverImageUrl}
                  alt="Preview da capa"
                  fill
                  sizes="400px"
                  className={styles.coverPreviewImg}
                  unoptimized={coverImageUrl.startsWith("data:") || coverImageUrl.startsWith("blob:")}
                />
              </div>
            )}
          </div>

          {/* Seções */}
          <div className={styles.sectionsHeader}>
            <h2 className={styles.sectionTitle}>Seções do Conteúdo</h2>
            <div className={styles.addSectionBtns}>
              <button type="button" className={styles.addBtn} onClick={() => addSection("text")}>
                + Texto
              </button>
              <button type="button" className={styles.addBtn} onClick={() => addSection("image")}>
                + Imagem
              </button>
              <button type="button" className={styles.addBtn} onClick={() => addSection("video")}>
                + Vídeo
              </button>
            </div>
          </div>

          {sections.map((section, i) => (
            <div key={i} className={styles.sectionCard}>
              <div className={styles.sectionCardHeader}>
                <span className={styles.sectionBadge}>
                  {section.type === "text" ? "📝 Texto" : section.type === "image" ? "🖼️ Imagem" : "🎬 Vídeo"}
                </span>
                {sections.length > 1 && (
                  <button type="button" className={styles.removeBtn} onClick={() => removeSection(i)}>
                    ✕ Remover
                  </button>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Subtítulo da seção</label>
                <input
                  type="text"
                  className={styles.input}
                  value={section.subtitle}
                  onChange={(e) => updateSection(i, "subtitle", e.target.value)}
                  placeholder="Ex: A história funciona até para quem não conhece 007"
                />
              </div>

              {section.type === "text" && (
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Conteúdo</label>
                  <textarea
                    className={styles.textarea}
                    value={section.content}
                    onChange={(e) => updateSection(i, "content", e.target.value)}
                    placeholder="Escreva o conteúdo da seção..."
                    rows={8}
                  />
                </div>
              )}

              {section.type === "image" && (
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>URL da Imagem</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={section.image_url}
                    onChange={(e) => updateSection(i, "image_url", e.target.value)}
                    placeholder="https://... (URL da imagem)"
                  />
                  {section.image_url && (
                    <div className={styles.coverPreview}>
                      <Image src={section.image_url} alt="Preview" fill sizes="400px" className={styles.coverPreviewImg} unoptimized />
                    </div>
                  )}
                </div>
              )}

              {section.type === "video" && (
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>URL de Embed do Vídeo</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={section.embed_url}
                    onChange={(e) => updateSection(i, "embed_url", e.target.value)}
                    placeholder="https://www.youtube.com/embed/VIDEO_ID"
                  />
                  {section.embed_url && <p className={styles.hint}>Cole a URL de embed (ex: YouTube embed, não a URL normal do vídeo).</p>}
                </div>
              )}
            </div>
          ))}

          {/* Pontos Positivos */}
          <div className={styles.pointsSection}>
            <h2 className={styles.sectionTitle}>✅ Pontos Positivos</h2>
            {positivePoints.map((p, i) => (
              <div key={i} className={styles.pointRow}>
                <input
                  type="text"
                  className={styles.input}
                  value={p}
                  onChange={(e) => updatePoint(positivePoints, setPositivePoints, i, e.target.value)}
                  placeholder="Descreva um ponto positivo..."
                />
                {positivePoints.length > 1 && (
                  <button type="button" className={styles.removeBtn} onClick={() => removePoint(positivePoints, setPositivePoints, i)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button type="button" className={styles.addBtn} onClick={() => addPoint(positivePoints, setPositivePoints)}>
              + Adicionar ponto positivo
            </button>
          </div>

          {/* Pontos Negativos */}
          <div className={styles.pointsSection}>
            <h2 className={styles.sectionTitle}>❌ Pontos Negativos</h2>
            {negativePoints.map((p, i) => (
              <div key={i} className={styles.pointRow}>
                <input
                  type="text"
                  className={styles.input}
                  value={p}
                  onChange={(e) => updatePoint(negativePoints, setNegativePoints, i, e.target.value)}
                  placeholder="Descreva um ponto negativo..."
                />
                {negativePoints.length > 1 && (
                  <button type="button" className={styles.removeBtn} onClick={() => removePoint(negativePoints, setNegativePoints, i)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button type="button" className={styles.addBtn} onClick={() => addPoint(negativePoints, setNegativePoints)}>
              + Adicionar ponto negativo
            </button>
          </div>

          {/* Submit */}
          <div className={styles.submitRow}>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? "Salvando..." : isEditing ? "Atualizar Análise" : "Publicar Análise"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
