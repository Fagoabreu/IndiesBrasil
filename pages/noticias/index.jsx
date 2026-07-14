import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Heading } from "@primer/react";
import { PlusIcon, XIcon, ImageIcon } from "@primer/octicons-react";
import SeoHead from "@/components/SeoHead";
import { useUser } from "@/context/UserContext";
import NewsCard from "@/components/NewsCard/NewsCard";
import { SITE_URL } from "@/lib/seo";
import styles from "./NewsPage.module.css";

const PAGE_TITLE = "Notícias | Indies Brasil";
const PAGE_DESCRIPTION =
  "Fique por dentro das últimas notícias, novidades e atualizações do cenário indie brasileiro.";
const PAGE_URL = `${SITE_URL}/noticias`;

export default function NewsPage() {
  const { user, loadingUser } = useUser();
  const [newsList, setNewsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Formulário
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/news", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setNewsList(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!loadingUser) fetchNews();
  }, [fetchNews, loadingUser]);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !summary.trim() || !body.trim()) return;
    setSaving(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("summary", summary.trim());
      formData.append("body", body.trim());
      if (sourceUrl.trim()) formData.append("source_url", sourceUrl.trim());
      if (sourceLabel.trim())
        formData.append("source_label", sourceLabel.trim());
      if (file) formData.append("file", file);

      const res = await fetch("/api/v1/news", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (res.ok) {
        const created = await res.json();
        setNewsList((prev) => [created, ...prev]);
        resetForm();
      } else {
        const data = await res.json().catch(() => ({}));
        setSubmitError(
          data?.error?.message ||
            data?.message ||
            `Erro ao publicar (${res.status})`,
        );
      }
    } catch {
      setSubmitError(
        "Erro de conexão. Verifique sua internet e tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setTitle("");
    setSummary("");
    setBody("");
    setSourceUrl("");
    setSourceLabel("");
    setFile(null);
    setPreview(null);
    setSubmitError(null);
  };

  return (
    <div className={styles.page}>
      <SeoHead
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        canonical={PAGE_URL}
      />

      <div className={styles.header}>
        <Heading as="h2" className={styles.headerTitle}>
          Notícias
        </Heading>
        <p className={styles.headerDesc}>
          Fique por dentro das últimas notícias, novidades e atualizações do
          cenário indie brasileiro.
        </p>
      </div>

      {/* Criar notícia */}
      {user && (
        <div className={styles.createArea}>
          {!showForm ? (
            <button
              className={styles.btnPrimary}
              onClick={() => {
                setShowForm(true);
                setSubmitError(null);
              }}
            >
              <PlusIcon size={14} /> Criar notícia
            </button>
          ) : (
            <div className={styles.createCard}>
              <h3>Nova notícia</h3>

              <input
                className={styles.input}
                placeholder="Título da notícia"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <textarea
                className={styles.textarea}
                placeholder="Resumo breve (aparece no card)"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={2}
              />

              <textarea
                className={styles.textarea}
                placeholder="Corpo da notícia (texto completo)"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
              />

              <div className={styles.sourceRow}>
                <input
                  className={styles.input}
                  placeholder="URL da fonte externa (opcional)"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                />
                <input
                  className={styles.input}
                  placeholder="Nome da fonte (opcional)"
                  value={sourceLabel}
                  onChange={(e) => setSourceLabel(e.target.value)}
                  style={{ maxWidth: 180 }}
                />
              </div>

              <div>
                <label className={styles.fileInput}>
                  <ImageIcon size={14} /> Imagem de capa (opcional)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    hidden
                  />
                </label>
                {preview && (
                  <div className={styles.imagePreviewArea}>
                    <Image
                      src={preview}
                      alt="Preview"
                      className={styles.previewImage}
                      width={300}
                      height={200}
                      unoptimized
                    />
                    <button
                      className={styles.removeImage}
                      onClick={() => {
                        setFile(null);
                        setPreview(null);
                      }}
                    >
                      <XIcon size={12} />
                    </button>
                  </div>
                )}
              </div>

              {submitError && (
                <div className={styles.errorMessage}>{submitError}</div>
              )}

              <div className={styles.actions}>
                <button className={styles.btnSecondary} onClick={resetForm}>
                  Cancelar
                </button>
                <button
                  className={styles.btnPrimary}
                  onClick={handleSubmit}
                  disabled={
                    saving || !title.trim() || !summary.trim() || !body.trim()
                  }
                >
                  {saving ? "Publicando..." : "Publicar notícia"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className={styles.loading}>Carregando notícias...</div>
      ) : newsList.length === 0 ? (
        <div className={styles.empty}>
          <h3>Nenhuma notícia publicada</h3>
          <p>Seja o primeiro a compartilhar uma notícia com a comunidade!</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {newsList.map((n) => (
            <NewsCard key={n.id} news={n} />
          ))}
        </div>
      )}
    </div>
  );
}
