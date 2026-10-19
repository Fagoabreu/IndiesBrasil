import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Spinner } from "@primer/react";
import PropTypes from "prop-types";
import AssetForm from "./AssetForm";
import AssetCategoryPicker from "./AssetCategoryPicker";
import StatusMessageComponent from "@/components/StatusMessage/StatusMessageComponent";
import ImageUploader from "@/components/ImageTools/ImageUploader/ImageUploader";
import AssetCategoryChips from "@/components/Asset/AssetCategoryChips";
import { MAX_ASSET_CATEGORIES } from "@/lib/assetGroups";
import { isValidAssetUrl } from "@/lib/assetUrl";
import styles from "./AssetEditor.module.css";

/**
 * Aba "Assets" das configurações do estúdio.
 *
 * O asset é **referenciado**, não armazenado: o formulário pede o endereço
 * público (itch.io, Kenney, OpenGameArt…) e a capa é opcional. Por isso a
 * criação pede só nome, URL e categorias; o resto (licença, créditos, formato,
 * capa) é preenchido no painel de edição que abre logo depois.
 */
export default function AssetEditor({ slug }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newCategoryIds, setNewCategoryIds] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState({ type: null, text: "" });

  const [editingSlug, setEditingSlug] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMsg, setEditMsg] = useState({ type: null, text: "" });
  const [coverBusy, setCoverBusy] = useState(false);
  const [deletingSlug, setDeletingSlug] = useState(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    fetch(`/api/v1/studios/${slug}/assets`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (!cancelled) setAssets(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setAssets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    fetch("/api/v1/asset-categories", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (!cancelled) setCategories(Array.isArray(data) ? data : []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function refreshAssets() {
    const response = await fetch(`/api/v1/studios/${slug}/assets`, { credentials: "include" });
    if (!response.ok) return;
    const data = await response.json();
    setAssets(Array.isArray(data) ? data : []);
  }

  /**
   * Categorias do seletor = ativas + as que o asset já tem.
   *
   * A lista pública só devolve ativas; um asset pode continuar classificado com
   * uma categoria que o admin aposentou, e sem este merge o checkbox dela
   * simplesmente não existiria — salvar o formulário apagaria a classificação.
   */
  function categoriesForPicker(asset) {
    const byId = new Map(categories.map((category) => [category.id, category]));

    for (const category of asset?.categories ?? []) {
      if (!byId.has(category.id)) {
        byId.set(category.id, {
          ...category,
          display_order: Number.MAX_SAFE_INTEGER,
          is_active: false,
        });
      }
    }

    return [...byId.values()];
  }

  function buildForm(asset) {
    return {
      name: asset.name || "",
      external_url: asset.external_url || "",
      short_description: asset.short_description || "",
      description: asset.description || "",
      source_name: asset.source_name || "",
      credit: asset.credit || "",
      license: asset.license || "unknown",
      is_free: asset.is_free !== false,
      price: asset.price == null ? "" : String(asset.price),
      file_format: asset.file_format || "",
      category_ids: (asset.categories ?? []).map((category) => category.id),
      // Guardadas para o seletor conseguir mostrar categorias que o admin
      // desativou depois — a lista pública não as devolve.
      categories: asset.categories ?? [],
      cover_url: asset.cover_url ?? null,
      cover_image_id: asset.cover_image_id ?? null,
    };
  }

  async function handleCreate(event) {
    event.preventDefault();
    setCreateMsg({ type: null, text: "" });

    if (!isValidAssetUrl(newUrl)) {
      setCreateMsg({ type: "error", text: "Informe uma URL válida, começando com http:// ou https://." });
      return;
    }

    if (newCategoryIds.length === 0) {
      setCreateMsg({ type: "error", text: "Selecione ao menos uma categoria." });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`/api/v1/studios/${slug}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newName.trim(),
          external_url: newUrl.trim(),
          category_ids: newCategoryIds,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setCreateMsg({ type: "error", text: data.message || "Erro ao criar asset." });
        return;
      }

      setNewName("");
      setNewUrl("");
      setNewCategoryIds([]);
      setCreateMsg({ type: "success", text: `Asset "${data.name}" criado.` });
      await refreshAssets();
      openEditWith(data);
    } catch {
      setCreateMsg({ type: "error", text: "Erro inesperado. Tente novamente." });
    } finally {
      setCreating(false);
    }
  }

  function openEditWith(asset) {
    setEditingSlug(asset.slug);
    setEditForm(buildForm(asset));
    setEditMsg({ type: null, text: "" });
  }

  async function handleOpenEdit(assetSlug) {
    if (editingSlug === assetSlug) {
      setEditingSlug(null);
      setEditForm(null);
      setEditMsg({ type: null, text: "" });
      return;
    }

    setLoadingEdit(true);
    setEditMsg({ type: null, text: "" });
    try {
      const response = await fetch(`/api/v1/assets/${assetSlug}`, { credentials: "include" });
      const data = await response.json();

      if (!response.ok) {
        setEditMsg({ type: "error", text: data.message || "Erro ao carregar asset." });
        return;
      }

      openEditWith(data);
    } catch {
      setEditMsg({ type: "error", text: "Erro ao carregar asset." });
    } finally {
      setLoadingEdit(false);
    }
  }

  function handleFormChange(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!editForm) return;

    setEditMsg({ type: null, text: "" });

    if (!isValidAssetUrl(editForm.external_url)) {
      setEditMsg({ type: "error", text: "Informe uma URL válida, começando com http:// ou https://." });
      return;
    }

    if (editForm.category_ids.length === 0) {
      setEditMsg({ type: "error", text: "Selecione ao menos uma categoria." });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/v1/assets/${editingSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editForm.name.trim(),
          external_url: editForm.external_url.trim(),
          short_description: editForm.short_description,
          description: editForm.description,
          source_name: editForm.source_name,
          credit: editForm.credit,
          license: editForm.license,
          is_free: editForm.is_free,
          price: editForm.is_free ? null : editForm.price,
          file_format: editForm.file_format,
          category_ids: editForm.category_ids,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setEditMsg({ type: "error", text: data.message || "Erro ao salvar asset." });
        return;
      }

      setEditMsg({ type: "success", text: "Asset atualizado." });
      setEditingSlug(data.slug);
      setEditForm(buildForm(data));
      await refreshAssets();
    } catch {
      setEditMsg({ type: "error", text: "Erro inesperado. Tente novamente." });
    } finally {
      setSaving(false);
    }
  }

  async function handleCover(dataUrl) {
    if (!editingSlug) return;

    setCoverBusy(true);
    setEditMsg({ type: null, text: "" });
    try {
      const response = await fetch(`/api/v1/assets/${editingSlug}/cover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await response.json();

      if (!response.ok) {
        setEditMsg({ type: "error", text: data.message || "Erro ao enviar a capa." });
        return;
      }

      setEditForm((current) => ({ ...current, cover_url: data.cover_url, cover_image_id: data.cover_image_id }));
      await refreshAssets();
    } catch {
      setEditMsg({ type: "error", text: "Erro ao enviar a capa." });
    } finally {
      setCoverBusy(false);
    }
  }

  async function handleRemoveCover() {
    if (!editingSlug) return;

    setCoverBusy(true);
    try {
      const response = await fetch(`/api/v1/assets/${editingSlug}/cover`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        setEditMsg({ type: "error", text: "Erro ao remover a capa." });
        return;
      }

      setEditForm((current) => ({ ...current, cover_url: null, cover_image_id: null }));
      await refreshAssets();
    } catch {
      setEditMsg({ type: "error", text: "Erro ao remover a capa." });
    } finally {
      setCoverBusy(false);
    }
  }

  async function handleDelete(asset) {
    if (!confirm(`Tem certeza que deseja excluir "${asset.name}"?\n\nO asset sai do site; o arquivo continua no endereço externo.`)) {
      return;
    }

    setDeletingSlug(asset.slug);
    setEditMsg({ type: null, text: "" });
    try {
      const response = await fetch(`/api/v1/assets/${asset.slug}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setEditMsg({ type: "error", text: data.message || "Erro ao excluir asset." });
        return;
      }

      if (editingSlug === asset.slug) {
        setEditingSlug(null);
        setEditForm(null);
      }

      setCreateMsg({ type: "success", text: `"${asset.name}" excluído.` });
      await refreshAssets();
    } finally {
      setDeletingSlug(null);
    }
  }

  return (
    <section className={styles.wrapper}>
      <h2 className={styles.title}>Assets</h2>
      <p className={styles.hint}>
        Referencie pacotes de arte, áudio, UI, VFX e código publicados em outros sites (itch.io, Kenney, OpenGameArt, Unity Asset Store…). O arquivo
        continua onde está — o Indies Brasil publica a ficha e o link.
      </p>

      {loading ? (
        <div className={styles.loading}>
          <Spinner size="small" />
        </div>
      ) : (
        assets.length > 0 && (
          <ul className={styles.list}>
            {assets.map((item) => (
              <li key={item.id} className={styles.listItem}>
                <div className={styles.itemRow}>
                  <Link href={`/assets/${item.slug}`} className={styles.itemLink} target="_blank" rel="noopener noreferrer">
                    {item.name}
                  </Link>

                  <span className={`${styles.tag} ${item.is_free ? styles.tagFree : styles.tagPaid}`}>{item.is_free ? "Gratuito" : "Pago"}</span>

                  <AssetCategoryChips categories={item.categories} limit={3} as="span" className={styles.itemChips} />

                  <span className={styles.itemActions}>
                    <button type="button" className={styles.btnSecondarySmall} onClick={() => handleOpenEdit(item.slug)} disabled={loadingEdit}>
                      {editingSlug === item.slug ? "Fechar" : "Editar"}
                    </button>
                    <button type="button" className={styles.btnDangerSmall} onClick={() => handleDelete(item)} disabled={deletingSlug === item.slug}>
                      {deletingSlug === item.slug ? "…" : "Excluir"}
                    </button>
                  </span>
                </div>

                {editingSlug === item.slug && (
                  <div className={styles.editPanel}>
                    {loadingEdit && !editForm ? (
                      <div className={styles.loading}>
                        <Spinner size="small" />
                      </div>
                    ) : (
                      editForm && (
                        <AssetForm
                          value={editForm}
                          onChange={handleFormChange}
                          categories={categoriesForPicker(editForm)}
                          onSubmit={handleSave}
                          onCancel={() => {
                            setEditingSlug(null);
                            setEditForm(null);
                          }}
                          saving={saving}
                          message={editMsg}
                        >
                          <ImageUploader preset="mediaCover" onCropped={({ dataUrl }) => handleCover(dataUrl)}>
                            {({ open, disabled }) => (
                              <div className={styles.coverRow}>
                                <div className={styles.coverPreview}>
                                  {editForm.cover_url ? (
                                    <Image src={editForm.cover_url} alt="Capa do asset" width={320} height={180} className={styles.coverImage} />
                                  ) : (
                                    <span className={styles.coverPlaceholder}>Sem capa</span>
                                  )}
                                </div>
                                <div className={styles.coverActions}>
                                  <button type="button" className={styles.btnSecondarySmall} onClick={open} disabled={disabled || coverBusy}>
                                    {editForm.cover_url ? "Trocar capa" : "Enviar capa"}
                                  </button>
                                  {editForm.cover_url && (
                                    <button type="button" className={styles.btnDangerSmall} onClick={handleRemoveCover} disabled={coverBusy}>
                                      Remover capa
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </ImageUploader>
                        </AssetForm>
                      )
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      )}

      <form onSubmit={handleCreate} className={styles.createForm}>
        <p className={styles.createTitle}>Cadastrar asset</p>

        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>
              Nome <span className={styles.required}>*</span>
            </span>
            <input
              type="text"
              className={styles.input}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              maxLength={255}
              placeholder="Ex: Pacote de sprites de plataforma"
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>
              URL do asset <span className={styles.required}>*</span>
            </span>
            <input
              type="url"
              className={styles.input}
              value={newUrl}
              onChange={(event) => setNewUrl(event.target.value)}
              maxLength={1024}
              placeholder="https://exemplo.itch.io/pacote"
              required
            />
          </label>
        </div>

        {categories.length > 0 ? (
          <AssetCategoryPicker categories={categories} selected={newCategoryIds} onChange={setNewCategoryIds} />
        ) : (
          <p className={styles.hint}>Nenhuma categoria cadastrada. Peça ao administrador para cadastrar em /admin/asset-categories.</p>
        )}

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={creating || !newName.trim() || !newUrl.trim() || newCategoryIds.length === 0 || newCategoryIds.length > MAX_ASSET_CATEGORIES}
          >
            {creating ? <Spinner size="small" /> : "Cadastrar asset"}
          </button>
        </div>

        {createMsg.text && <StatusMessageComponent type={createMsg.type} message={createMsg.text} />}
      </form>

      {editMsg.text && !editForm && <StatusMessageComponent type={editMsg.type} message={editMsg.text} />}
    </section>
  );
}

AssetEditor.propTypes = {
  slug: PropTypes.string.isRequired,
};
