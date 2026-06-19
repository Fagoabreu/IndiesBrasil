"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import Link from "next/link";
import { Spinner } from "@primer/react";
import { ArrowLeftIcon } from "@primer/octicons-react";

import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import StatusMessageComponent from "@/components/StatusMessage/StatusMessageComponent";
import ImageCropModal from "@/components/ImageTools/ImageCropTool/ImageCropModal";
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
  const [modules, setModules] = useState([]);
  const [unassignedLessons, setUnassignedLessons] = useState([]);

  // Criar nova aula (inline per-module)
  const [activeAddLessonModule, setActiveAddLessonModule] = useState(null); // module id, "unassigned", or null
  const [addLessonTitle, setAddLessonTitle] = useState("");
  const [addingLesson, setAddingLesson] = useState(false);
  const [lessonMsg, setLessonMsg] = useState({ type: null, text: "" });

  // Edição inline de aula
  const [editingLessonOrder, setEditingLessonOrder] = useState(null);
  const [editLessonForm, setEditLessonForm] = useState(null);
  const [savingLesson, setSavingLesson] = useState(false);
  const [deletingLessonOrder, setDeletingLessonOrder] = useState(null);
  const [editLessonMsg, setEditLessonMsg] = useState({ type: null, text: "" });

  // Módulos
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [creatingModule, setCreatingModule] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState(null);
  const [editModuleTitle, setEditModuleTitle] = useState("");
  const [savingModule, setSavingModule] = useState(false);
  const [moduleMsg, setModuleMsg] = useState({ type: null, text: "" });

  // Upload de capa
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverCropSrc, setCoverCropSrc] = useState(null);
  const coverInputRef = useRef(null);

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
      // lessons are fetched via fetchModules which handles modules
    } finally {
      setLoading(false);
    }
  }, [slug, router]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  const fetchLessonList = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/courses/${courseSlug || slug}/lessons`);
      if (res.ok) {
        const data = await res.json();
        setLessons(data);
      }
    } catch {
      // silent
    }
  }, [courseSlug, slug]);

  const fetchModules = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/courses/${courseSlug || slug}/modules`);
      if (res.ok) {
        const data = await res.json();
        setModules(data.modules || []);
        setUnassignedLessons(data.unassignedLessons || []);
        setLessons([...data.modules.flatMap((m) => m.lessons || []), ...(data.unassignedLessons || [])]);
      }
    } catch {
      // silent
    }
  }, [courseSlug, slug]);

  useEffect(() => {
    if (courseSlug) {
      fetchLessonList();
      fetchModules();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseSlug]);

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

  function handleCoverFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = () => setCoverCropSrc(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleCoverCropConfirm(blob) {
    setCoverCropSrc(null);
    if (!blob) return;
    setUploadingCover(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });

      const res = await fetch(`/api/v1/courses/${slug}/cover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ image: base64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: "error", text: data.message || "Erro ao enviar capa." });
        return;
      }
      setCoverUrl(data.cover_url);
      setStatusMsg({ type: "success", text: "Capa atualizada!" });
    } catch {
      setStatusMsg({ type: "error", text: "Erro ao enviar capa." });
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleRemoveCover() {
    if (!confirm("Remover a capa do curso?")) return;
    setUploadingCover(true);
    try {
      const res = await fetch(`/api/v1/courses/${slug}/cover`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: "error", text: data.message || "Erro ao remover capa." });
        return;
      }
      setCoverUrl(null);
      setStatusMsg({ type: "success", text: "Capa removida." });
    } catch {
      setStatusMsg({ type: "error", text: "Erro ao remover capa." });
    } finally {
      setUploadingCover(false);
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

  function openAddLessonFor(moduleId) {
    setActiveAddLessonModule(moduleId);
    setAddLessonTitle("");
    setLessonMsg({ type: null, text: "" });
  }

  async function handleAddLesson(moduleId) {
    if (!addLessonTitle.trim()) return;
    setLessonMsg({ type: null, text: "" });
    setAddingLesson(true);
    try {
      const body = { title: addLessonTitle.trim(), moduleId: moduleId === "unassigned" ? null : moduleId };

      const res = await fetch(`/api/v1/courses/${slug}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setLessonMsg({ type: "error", text: data.message || "Erro ao criar aula." });
        return;
      }
      setAddLessonTitle("");
      setActiveAddLessonModule(null);
      setLessonMsg({ type: "success", text: `Aula "${data.title}" criada!` });
      openLessonEditForLesson(data);
      await fetchModules();
    } catch {
      setLessonMsg({ type: "error", text: "Erro inesperado. Tente novamente." });
    } finally {
      setAddingLesson(false);
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
      module_id: lesson.module_id || "",
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
        moduleId: editLessonForm.module_id?.trim() || null,
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
      setEditingLessonOrder(data.order_index);
      await fetchModules();
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
        setEditingLessonOrder(null);
        setEditLessonForm(null);
        setEditLessonMsg({ type: "success", text: "Aula removida." });
        await fetchModules();
      }
    } catch {
      setEditLessonMsg({ type: "error", text: "Erro ao remover aula." });
    } finally {
      setDeletingLessonOrder(null);
    }
  }

  // ---- Módulos ----

  async function handleCreateModule(e) {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;
    setModuleMsg({ type: null, text: "" });
    setCreatingModule(true);
    try {
      const res = await fetch(`/api/v1/courses/${slug}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: newModuleTitle.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModuleMsg({ type: "error", text: data.message || "Erro ao criar módulo." });
        return;
      }
      setNewModuleTitle("");
      setModuleMsg({ type: "success", text: `Módulo "${data.title}" criado!` });
      await fetchModules();
    } catch {
      setModuleMsg({ type: "error", text: "Erro inesperado. Tente novamente." });
    } finally {
      setCreatingModule(false);
    }
  }

  async function handleSaveModule(moduleId) {
    if (!editModuleTitle.trim()) return;
    setSavingModule(true);
    try {
      const res = await fetch(`/api/v1/courses/${slug}/modules`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ moduleId, title: editModuleTitle.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModuleMsg({ type: "error", text: data.message || "Erro ao salvar módulo." });
        return;
      }
      setEditingModuleId(null);
      setEditModuleTitle("");
      setModuleMsg({ type: "success", text: "Módulo atualizado!" });
      await fetchModules();
    } catch {
      setModuleMsg({ type: "error", text: "Erro inesperado. Tente novamente." });
    } finally {
      setSavingModule(false);
    }
  }

  async function handleDeleteModule(moduleId) {
    if (!confirm("Remover este módulo? As aulas dentro dele ficarão sem módulo.")) return;
    try {
      const res = await fetch(`/api/v1/courses/${slug}/modules`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ moduleId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setModuleMsg({ type: "error", text: data.message || "Erro ao remover módulo." });
        return;
      }
      setEditingModuleId(null);
      setEditModuleTitle("");
      setModuleMsg({ type: "success", text: "Módulo removido." });
      await fetchModules();
    } catch {
      setModuleMsg({ type: "error", text: "Erro inesperado. Tente novamente." });
    }
  }

  function renderLessonEditForm(lesson) {
    if (!editLessonForm) return null;

    return (
      <div className={styles.lessonEditPanel}>
        <form onSubmit={handleSaveLesson} className={styles.lessonEditForm}>
          <div className={styles.lessonEditGrid}>
            <label className={styles.fieldLabel}>
              <span>Título *</span>
              <input
                type="text"
                className={styles.input}
                value={editLessonForm.title}
                onChange={(e) => setEditLessonForm((f) => ({ ...f, title: e.target.value }))}
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
                onChange={(e) => setEditLessonForm((f) => ({ ...f, order_index: e.target.value }))}
              />
            </label>

            {modules.length > 0 && (
              <label className={styles.fieldLabel}>
                <span>Módulo</span>
                <select
                  className={styles.input}
                  value={editLessonForm.module_id}
                  onChange={(e) => setEditLessonForm((f) => ({ ...f, module_id: e.target.value }))}
                >
                  <option value="">Sem módulo</option>
                  {modules.map((mod) => (
                    <option key={mod.id} value={mod.id}>
                      {mod.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className={styles.fieldLabel}>
              <span>URL do vídeo</span>
              <input
                type="url"
                className={styles.input}
                placeholder="https://youtube.com/..."
                value={editLessonForm.video_url}
                onChange={(e) => setEditLessonForm((f) => ({ ...f, video_url: e.target.value }))}
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
                onChange={(e) => setEditLessonForm((f) => ({ ...f, reading_material: e.target.value }))}
                maxLength={512}
              />
            </label>

            <label className={`${styles.fieldLabel} ${styles.fieldLabelFull}`}>
              <span>Descrição da aula</span>
              <textarea
                className={`${styles.input} ${styles.textarea}`}
                placeholder="Resumo do conteúdo da aula..."
                value={editLessonForm.description}
                onChange={(e) => setEditLessonForm((f) => ({ ...f, description: e.target.value }))}
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
      </div>
    );
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
              {/* Capa */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Capa</h2>
                {coverUrl && (
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
                )}

                <input ref={coverInputRef} type="file" accept="image/*" className={styles.hiddenFileInput} onChange={handleCoverFileSelected} />

                <div className={styles.coverActions}>
                  <button type="button" className={styles.btnCoverUpload} onClick={() => coverInputRef.current?.click()} disabled={uploadingCover}>
                    {uploadingCover ? <Spinner size="small" /> : coverUrl ? "Alterar capa" : "Adicionar capa"}
                  </button>
                  {coverUrl && (
                    <button type="button" className={styles.btnCoverRemove} onClick={handleRemoveCover} disabled={uploadingCover}>
                      Remover capa
                    </button>
                  )}
                </div>
              </section>

              {coverCropSrc && (
                <ImageCropModal imageSrc={coverCropSrc} preset="cover" onConfirm={handleCoverCropConfirm} onClose={() => setCoverCropSrc(null)} />
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
            <h2 className={styles.sectionTitle}>Estrutura do curso</h2>

            {moduleMsg.text && <StatusMessageComponent type={moduleMsg.type} message={moduleMsg.text} />}
            {lessonMsg.text && !activeAddLessonModule && (
              <div className={styles.lessonMsg}>
                <StatusMessageComponent type={lessonMsg.type} message={lessonMsg.text} />
              </div>
            )}

            {/* ---- Criar módulo (topo) ---- */}
            <form onSubmit={handleCreateModule} className={styles.moduleForm}>
              <div className={styles.inlineAddRow}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Nome do novo módulo (ex: Introdução, Avançado)"
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                  maxLength={255}
                  required
                />
                <button type="submit" className={styles.btnSaveSmall} disabled={creatingModule || !newModuleTitle.trim()}>
                  {creatingModule ? <Spinner size="small" /> : "Criar módulo"}
                </button>
              </div>
            </form>

            {/* ---- Módulos ---- */}
            {modules.length > 0 && (
              <div className={styles.moduleList}>
                {modules.map((mod) => (
                  <div key={mod.id} className={styles.moduleCard}>
                    <div className={styles.moduleHeader}>
                      <div className={styles.moduleHeaderLeft}>
                        {editingModuleId === mod.id ? (
                          <input
                            type="text"
                            className={styles.input}
                            value={editModuleTitle}
                            onChange={(e) => setEditModuleTitle(e.target.value)}
                            maxLength={255}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveModule(mod.id);
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <h3 className={styles.moduleTitle}>
                            {mod.title}{" "}
                            <span className={styles.moduleLessonCount}>
                              ({mod.lesson_count || 0} aula{mod.lesson_count !== 1 ? "s" : ""})
                            </span>
                          </h3>
                        )}
                      </div>
                      <div className={styles.moduleActions}>
                        {editingModuleId === mod.id ? (
                          <>
                            <button
                              type="button"
                              className={styles.btnSaveSmall}
                              onClick={() => handleSaveModule(mod.id)}
                              disabled={savingModule || !editModuleTitle.trim()}
                            >
                              {savingModule ? <Spinner size="small" /> : "Salvar"}
                            </button>
                            <button
                              type="button"
                              className={styles.btnCancelSmall}
                              onClick={() => {
                                setEditingModuleId(null);
                                setEditModuleTitle("");
                              }}
                              disabled={savingModule}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className={styles.btnAddLesson} onClick={() => openAddLessonFor(mod.id)}>
                              + Aula
                            </button>
                            <button
                              type="button"
                              className={styles.btnEditModule}
                              onClick={() => {
                                setEditingModuleId(mod.id);
                                setEditModuleTitle(mod.title);
                              }}
                            >
                              Renomear
                            </button>
                            <button type="button" className={styles.btnDeleteModule} onClick={() => handleDeleteModule(mod.id)}>
                              Remover
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Inline "nova aula" dentro deste módulo */}
                    {activeAddLessonModule === mod.id && (
                      <div className={styles.inlineAddLesson}>
                        <input
                          type="text"
                          className={styles.input}
                          placeholder="Título da nova aula..."
                          value={addLessonTitle}
                          onChange={(e) => setAddLessonTitle(e.target.value)}
                          maxLength={255}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddLesson(mod.id);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className={styles.btnSaveSmall}
                          onClick={() => handleAddLesson(mod.id)}
                          disabled={addingLesson || !addLessonTitle.trim()}
                        >
                          {addingLesson ? <Spinner size="small" /> : "Adicionar"}
                        </button>
                        <button
                          type="button"
                          className={styles.btnCancelSmall}
                          onClick={() => {
                            setActiveAddLessonModule(null);
                            setAddLessonTitle("");
                          }}
                          disabled={addingLesson}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}

                    {/* Lessons in this module */}
                    {mod.lessons && mod.lessons.length > 0 && (
                      <ul className={styles.lessonList}>
                        {mod.lessons.map((lesson) => (
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

                            {editingLessonOrder === lesson.order_index && renderLessonEditForm(lesson)}
                          </li>
                        ))}
                      </ul>
                    )}

                    {(!mod.lessons || mod.lessons.length === 0) && !activeAddLessonModule && (
                      <p className={styles.moduleEmpty}>Nenhuma aula neste módulo ainda.</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ---- Unassigned Lessons ---- */}
            <div className={styles.unassignedSection}>
              <div className={styles.unassignedHeader}>
                <h3 className={styles.unassignedTitle}>
                  Sem módulo ({unassignedLessons.length} aula{unassignedLessons.length !== 1 ? "s" : ""})
                </h3>
                <button type="button" className={styles.btnAddLesson} onClick={() => openAddLessonFor("unassigned")}>
                  + Aula
                </button>
              </div>

              {/* Inline "nova aula" para a seção sem módulo */}
              {activeAddLessonModule === "unassigned" && (
                <div className={styles.inlineAddLesson}>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Título da nova aula..."
                    value={addLessonTitle}
                    onChange={(e) => setAddLessonTitle(e.target.value)}
                    maxLength={255}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddLesson("unassigned");
                      }
                    }}
                  />
                  <button
                    type="button"
                    className={styles.btnSaveSmall}
                    onClick={() => handleAddLesson("unassigned")}
                    disabled={addingLesson || !addLessonTitle.trim()}
                  >
                    {addingLesson ? <Spinner size="small" /> : "Adicionar"}
                  </button>
                  <button
                    type="button"
                    className={styles.btnCancelSmall}
                    onClick={() => {
                      setActiveAddLessonModule(null);
                      setAddLessonTitle("");
                    }}
                    disabled={addingLesson}
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {unassignedLessons.length > 0 && (
                <ul className={styles.lessonList}>
                  {unassignedLessons.map((lesson) => (
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

                      {editingLessonOrder === lesson.order_index && renderLessonEditForm(lesson)}
                    </li>
                  ))}
                </ul>
              )}

              {unassignedLessons.length === 0 && !activeAddLessonModule && modules.length === 0 && (
                <p className={styles.moduleEmpty}>Crie um módulo acima e depois adicione aulas dentro dele.</p>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
