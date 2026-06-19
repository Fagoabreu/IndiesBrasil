"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import Link from "next/link";
import { Spinner } from "@primer/react";
import { ArrowLeftIcon } from "@primer/octicons-react";

import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import StatusMessageComponent from "@/components/StatusMessage/StatusMessageComponent";
import styles from "./editar.module.css";

const SUGGESTED_TAGS = ["Jogo", "Unity", "Godot", "Arte", "Som", "Programação", "Design", "Marketing"];

export default function EditarCursoPage() {
  const router = useRouter();
  const { slug } = router.query;
  const { loadingUser } = useUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: null, text: "" });

  // Campos do curso
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTag, setCustomTag] = useState("");
  const [courseSlug, setCourseSlug] = useState("");

  // Tab navigation
  const [activeTab, setActiveTab] = useState("info");

  // Aulas
  const [lessons, setLessons] = useState([]);

  // Criar nova aula
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [creatingLesson, setCreatingLesson] = useState(false);
  const [lessonMsg, setLessonMsg] = useState({ type: null, text: "" });

  // Edição inline de aula
  const [editingLessonOrder, setEditingLessonOrder] = useState(null);
  const [editLessonForm, setEditLessonForm] = useState(null);
  const [savingLesson, setSavingLesson] = useState(false);
  const [deletingLessonOrder, setDeletingLessonOrder] = useState(null);
  const [editLessonMsg, setEditLessonMsg] = useState({ type: null, text: "" });

  const fetchCourse = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/v1/courses/${slug}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || data.status_code) {
        router.replace(`/estudos/${slug}`);
        return;
      }

      if (!data.viewer?.isOwner) {
        router.replace(`/estudos/${slug}`);
        return;
      }

      setTitle(data.title || "");
      setDescription(data.description || "");
      setCoverUrl(data.cover_url || null);
      setSelectedTags(data.tags?.map((t) => t.name) || []);
      setCourseSlug(data.slug);
      setLessons(data.lessons || []);
    } finally {
      setLoading(false);
    }
  }, [slug, router]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  function toggleTag(tag) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
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
    setStatusMsg({ type: null, text: "" });

    if (!title.trim()) {
      setStatusMsg({ type: "error", text: "O título do curso é obrigatório." });
      return;
    }

    if (title.trim().length < 3) {
      setStatusMsg({ type: "error", text: "O título do curso deve ter pelo menos 3 caracteres." });
      return;
    }

    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim(),
        tags: selectedTags,
      };

      const res = await fetch(`/api/v1/courses/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusMsg({ type: "error", text: data.message || "Erro ao salvar." });
        return;
      }

      setStatusMsg({ type: "success", text: "Curso atualizado com sucesso!" });

      if (data.slug && data.slug !== courseSlug) {
        setCourseSlug(data.slug);
        router.replace(`/estudos/${data.slug}/editar`, undefined, { shallow: true });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Erro inesperado. Tente novamente." });
    } finally {
      setSaving(false);
    }
  }

  // ---- Aulas ----

  async function handleCreateLesson(e) {
    e.preventDefault();
    if (!newLessonTitle.trim()) return;
    setLessonMsg({ type: null, text: "" });
    setCreatingLesson(true);
    try {
      const res = await fetch(`/api/v1/courses/${slug}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: newLessonTitle.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLessonMsg({ type: "error", text: data.message || "Erro ao criar aula." });
        return;
      }
      setNewLessonTitle("");
      setLessonMsg({ type: "success", text: `Aula "${data.title}" criada!` });
      const newLesson = { ...data };
      setLessons((prev) => [...prev, newLesson]);
      openLessonEditForLesson(newLesson);
    } catch {
      setLessonMsg({ type: "error", text: "Erro inesperado. Tente novamente." });
    } finally {
      setCreatingLesson(false);
    }
  }

  function openLessonEditForLesson(lesson) {
    setEditingLessonOrder(lesson.order_index);
    setEditLessonMsg({ type: null, text: "" });
    setEditLessonForm({
      title: lesson.title || "",
      description: lesson.description || "",
      video_url: lesson.video_url || "",
      reading_material: lesson.reading_material || "",
      order_index: lesson.order_index,
    });
  }

  async function handleOpenLessonEdit(orderIndex) {
    if (editingLessonOrder === orderIndex) {
      setEditingLessonOrder(null);
      setEditLessonForm(null);
      setEditLessonMsg({ type: null, text: "" });
      return;
    }

    const lesson = lessons.find((l) => l.order_index === orderIndex);
    if (!lesson) return;

    openLessonEditForLesson(lesson);
  }

  async function handleSaveLesson(e) {
    e.preventDefault();
    if (!editLessonForm?.title.trim()) return;
    setEditLessonMsg({ type: null, text: "" });
    setSavingLesson(true);
    try {
      const payload = {
        title: editLessonForm.title.trim(),
        description: editLessonForm.description.trim(),
        videoUrl: editLessonForm.video_url.trim(),
        readingMaterial: editLessonForm.reading_material.trim(),
        orderIndex: Number(editLessonForm.order_index),
      };

      const res = await fetch(`/api/v1/courses/${slug}/lessons/${editingLessonOrder}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditLessonMsg({ type: "error", text: data.message || "Erro ao salvar aula." });
        return;
      }
      setEditLessonMsg({ type: "success", text: "Aula atualizada!" });
      setLessons((prev) => prev.map((l) => (l.order_index === editingLessonOrder ? { ...l, ...data } : l)));
      setEditingLessonOrder(data.order_index);
    } catch {
      setEditLessonMsg({ type: "error", text: "Erro inesperado. Tente novamente." });
    } finally {
      setSavingLesson(false);
    }
  }

  async function handleDeleteLesson(orderIndex) {
    if (!confirm("Remover esta aula? Esta ação não pode ser desfeita.")) return;
    setDeletingLessonOrder(orderIndex);
    try {
      const res = await fetch(`/api/v1/courses/${slug}/lessons/${orderIndex}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setLessons((prev) => prev.filter((l) => l.order_index !== orderIndex));
        setEditingLessonOrder(null);
        setEditLessonForm(null);
        setEditLessonMsg({ type: "success", text: "Aula removida." });
      }
    } catch {
      setEditLessonMsg({ type: "error", text: "Erro ao remover aula." });
    } finally {
      setDeletingLessonOrder(null);
    }
  }

  if (loadingUser || loading) {
    return (
      <div className={styles.loading}>
        <Spinner size="large" />
      </div>
    );
  }

  return (
    <>
      <SeoHead title={`Editar — ${title || "Curso"} — Indies Brasil`} />

      <div className={styles.page}>
        <div className={styles.topBar}>
          <Link href={`/estudos/${courseSlug || slug}`} className={styles.backLink}>
            <ArrowLeftIcon size={14} /> Voltar para o curso
          </Link>
          <h1 className={styles.pageTitle}>Editar curso</h1>
        </div>

        {/* Tab navigation */}
        <nav className={styles.tabs}>
          {[
            { id: "info", label: "Informações" },
            { id: "lessons", label: `Aulas (${lessons.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* ---- TAB: Informações ---- */}
        {activeTab === "info" && (
          <>
            {statusMsg.text && <StatusMessageComponent type={statusMsg.type} message={statusMsg.text} />}

            <form onSubmit={handleSubmit} className={styles.form}>
              {/* Capa atual */}
              {coverUrl && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Capa</h2>
                  <div className={styles.coverPreview}>
                    <Image
                      src={coverUrl}
                      alt=""
                      fill
                      className={styles.coverImg}
                      sizes="(max-width: 720px) 100vw, 720px"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                </section>
              )}

              {/* Informações básicas */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Informações Básicas</h2>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="edit-title">
                    Título <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="edit-title"
                    type="text"
                    className={styles.input}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                    required
                    disabled={saving}
                    placeholder="Título do curso"
                  />
                  <span className={styles.hint}>{title.length}/200 caracteres</span>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="edit-description">
                    Descrição
                  </label>
                  <textarea
                    id="edit-description"
                    className={styles.textarea}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    disabled={saving}
                    placeholder="Descreva o que será abordado no curso..."
                  />
                </div>
              </section>

              {/* Tags */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Tags</h2>

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
                        disabled={saving}
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
                    disabled={saving}
                  />
                  <button type="button" className={styles.btnTagAdd} onClick={addCustomTag} disabled={saving || customTag.trim().length < 2}>
                    Adicionar
                  </button>
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
                          disabled={saving}
                          aria-label={`Remover tag ${tag}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <div className={styles.formActions}>
                <Link href={`/estudos/${courseSlug || slug}`} className={styles.btnCancel}>
                  Cancelar
                </Link>
                <button type="submit" className={styles.btnSave} disabled={saving}>
                  {saving ? <Spinner size="small" /> : "Salvar alterações"}
                </button>
              </div>
            </form>
          </>
        )}

        {/* ---- TAB: Aulas ---- */}
        {activeTab === "lessons" && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Aulas ({lessons.length})</h2>

            {/* Lista de aulas existentes */}
            {lessons.length > 0 && (
              <ul className={styles.lessonList}>
                {lessons.map((lesson) => (
                  <li key={lesson.id} className={styles.lessonListItem}>
                    <div className={styles.lessonListRow}>
                      <span className={styles.lessonOrderBadge}>#{lesson.order_index + 1}</span>
                      <Link
                        href={`/estudos/${courseSlug}/aulas/${lesson.order_index}`}
                        className={styles.lessonLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {lesson.title}
                      </Link>
                      <button
                        type="button"
                        className={`${styles.btnEditLesson} ${editingLessonOrder === lesson.order_index ? styles.btnEditLessonActive : ""}`}
                        onClick={() => handleOpenLessonEdit(lesson.order_index)}
                      >
                        {editingLessonOrder === lesson.order_index ? "Fechar" : "Editar"}
                      </button>
                    </div>

                    {/* Formulário de edição expandido */}
                    {editingLessonOrder === lesson.order_index && (
                      <div className={styles.lessonEditPanel}>
                        {editLessonForm && (
                          <form onSubmit={handleSaveLesson} className={styles.lessonEditForm}>
                            <div className={styles.lessonEditGrid}>
                              <label className={styles.fieldLabel}>
                                <span>Título *</span>
                                <input
                                  type="text"
                                  className={styles.input}
                                  value={editLessonForm.title}
                                  onChange={(e) =>
                                    setEditLessonForm((f) => ({
                                      ...f,
                                      title: e.target.value,
                                    }))
                                  }
                                  maxLength={255}
                                  required
                                />
                              </label>

                              <label className={styles.fieldLabel}>
                                <span>Ordem (0 = primeira)</span>
                                <input
                                  type="number"
                                  className={styles.input}
                                  min="0"
                                  value={editLessonForm.order_index}
                                  onChange={(e) =>
                                    setEditLessonForm((f) => ({
                                      ...f,
                                      order_index: e.target.value,
                                    }))
                                  }
                                />
                              </label>

                              <label className={styles.fieldLabel}>
                                <span>URL do vídeo</span>
                                <input
                                  type="url"
                                  className={styles.input}
                                  placeholder="https://youtube.com/..."
                                  value={editLessonForm.video_url}
                                  onChange={(e) =>
                                    setEditLessonForm((f) => ({
                                      ...f,
                                      video_url: e.target.value,
                                    }))
                                  }
                                  maxLength={512}
                                />
                              </label>

                              <label className={styles.fieldLabel}>
                                <span>Material de leitura</span>
                                <input
                                  type="url"
                                  className={styles.input}
                                  placeholder="https://..."
                                  value={editLessonForm.reading_material}
                                  onChange={(e) =>
                                    setEditLessonForm((f) => ({
                                      ...f,
                                      reading_material: e.target.value,
                                    }))
                                  }
                                  maxLength={512}
                                />
                              </label>

                              <label className={`${styles.fieldLabel} ${styles.fieldLabelFull}`}>
                                <span>Descrição da aula</span>
                                <textarea
                                  className={`${styles.input} ${styles.textarea}`}
                                  placeholder="Resumo do conteúdo da aula..."
                                  value={editLessonForm.description}
                                  onChange={(e) =>
                                    setEditLessonForm((f) => ({
                                      ...f,
                                      description: e.target.value,
                                    }))
                                  }
                                  rows={3}
                                />
                              </label>
                            </div>

                            {editLessonMsg.text && <StatusMessageComponent type={editLessonMsg.type} message={editLessonMsg.text} />}

                            <div className={styles.lessonEditActions}>
                              <button
                                type="button"
                                className={styles.btnDeleteLesson}
                                onClick={() => handleDeleteLesson(lesson.order_index)}
                                disabled={deletingLessonOrder === lesson.order_index}
                              >
                                {deletingLessonOrder === lesson.order_index ? <Spinner size="small" /> : "Remover aula"}
                              </button>
                              <button type="submit" className={styles.btnSave} disabled={savingLesson || !editLessonForm.title.trim()}>
                                {savingLesson ? <Spinner size="small" /> : "Salvar aula"}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Criar nova aula */}
            <form onSubmit={handleCreateLesson} className={styles.lessonForm}>
              <p className={styles.lessonFormTitle}>Criar nova aula</p>
              <input
                type="text"
                className={styles.input}
                placeholder="Título da aula"
                value={newLessonTitle}
                onChange={(e) => setNewLessonTitle(e.target.value)}
                maxLength={255}
                required
              />
              <button type="submit" className={styles.btnSave} disabled={creatingLesson || !newLessonTitle.trim()}>
                {creatingLesson ? <Spinner size="small" /> : "Criar aula"}
              </button>
            </form>

            {lessonMsg.text && (
              <div className={styles.lessonMsg}>
                <StatusMessageComponent type={lessonMsg.type} message={lessonMsg.text} />
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
