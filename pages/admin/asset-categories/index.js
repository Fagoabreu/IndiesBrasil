import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { PageLayout, Heading, Flash, Button, Spinner } from "@primer/react";
import { ListUnorderedIcon } from "@primer/octicons-react";

import { useUser } from "@/context/UserContext";
import { ASSET_GROUPS } from "@/lib/assetGroups";
import styles from "./index.module.css";

/**
 * Cadastro das categorias de asset — a taxonomia que o estúdio usa para
 * classificar o que cadastra.
 *
 * Mesmo padrão de Profissões e Tipos de Contato: catálogo pequeno, curado pelo
 * administrador. A diferença é o `is_active`: uma categoria que sai de uso é
 * **desativada** (some do seletor e dos filtros, continua nos assets que já a
 * tinham), e a exclusão só é aceita quando nenhum asset a usa — a API responde
 * 400 com a contagem e a tela mostra a mensagem.
 */
export default function AssetCategoriesAdminPage() {
  const router = useRouter();
  const { user, loadingUser } = useUser();
  const isAdmin = Boolean(user?.features?.includes("read:admin"));

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupKey, setGroupKey] = useState(ASSET_GROUPS[0].key);
  const [displayOrder, setDisplayOrder] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (loadingUser) return;
    // Sem acesso, a tela mostra o aviso e não há o que carregar. `loading`
    // continua `true` e é irrelevante nesse caminho — o aviso renderiza antes.
    if (!isAdmin) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/v1/asset-categories?include_inactive=true", { credentials: "include" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Erro ao carregar categorias.");
        }

        if (!cancelled) setCategories(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, loadingUser]);

  async function reload() {
    const response = await fetch("/api/v1/asset-categories?include_inactive=true", { credentials: "include" });
    if (!response.ok) return;
    const data = await response.json();
    setCategories(Array.isArray(data) ? data : []);
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError("O nome da categoria é obrigatório.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/asset-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          group_key: groupKey,
          display_order: Number.parseInt(displayOrder, 10) || 0,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao criar categoria.");
      }

      setName("");
      setDescription("");
      setDisplayOrder("0");
      setSuccess(`Categoria "${data.name}" criada.`);
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(category) {
    setEditingId(category.id);
    setEditForm({
      name: category.name,
      description: category.description || "",
      group_key: category.group_key,
      display_order: String(category.display_order ?? 0),
    });
  }

  async function handleSaveEdit(event) {
    event.preventDefault();
    if (!editForm) return;

    setError(null);
    setSuccess(null);
    setSavingEdit(true);

    try {
      const response = await fetch(`/api/v1/asset-categories/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
          group_key: editForm.group_key,
          display_order: Number.parseInt(editForm.display_order, 10) || 0,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao salvar categoria.");
      }

      setEditingId(null);
      setEditForm(null);
      setSuccess("Categoria atualizada.");
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleActive(category) {
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/v1/asset-categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: !category.is_active }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao alterar a categoria.");
      }

      setSuccess(category.is_active ? `"${category.name}" desativada.` : `"${category.name}" reativada.`);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(category) {
    if (!confirm(`Excluir a categoria "${category.name}"?`)) return;

    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/v1/asset-categories/${category.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao excluir categoria.");
      }

      setSuccess(`Categoria "${data.name}" excluída.`);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loadingUser) {
    return (
      <div className={styles.loading}>
        <Spinner size="large" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <PageLayout>
        <PageLayout.Content width="medium">
          <Heading as="h2">Categorias de Assets</Heading>
          <Flash variant="danger">Acesso restrito a administradores.</Flash>
          <Button onClick={() => router.push("/")}>Voltar para a home</Button>
        </PageLayout.Content>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.Content width="large">
        <div className={styles.header}>
          <ListUnorderedIcon size={20} />
          <Heading as="h2">Categorias de Assets</Heading>
        </div>
        <p className={styles.hint}>
          A taxonomia é fixa em dois níveis: os seis grupos abaixo não mudam, e as categorias de cada grupo são cadastradas aqui. Um asset pode ter
          várias categorias. Categoria em uso não pode ser excluída — desative-a.
        </p>

        {error && <Flash variant="danger">{error}</Flash>}
        {success && <Flash variant="success">{success}</Flash>}

        <form onSubmit={handleCreate} className={styles.createForm}>
          <input
            type="text"
            className={styles.input}
            placeholder="Nome da categoria (ex: Sprites)"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            aria-label="Nome da categoria"
          />
          <input
            type="text"
            className={styles.input}
            placeholder="Descrição (opcional)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={255}
            aria-label="Descrição da categoria"
          />
          <select className={styles.input} value={groupKey} onChange={(event) => setGroupKey(event.target.value)} aria-label="Grupo da categoria">
            {ASSET_GROUPS.map((group) => (
              <option key={group.key} value={group.key}>
                {group.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            className={`${styles.input} ${styles.orderInput}`}
            value={displayOrder}
            onChange={(event) => setDisplayOrder(event.target.value)}
            min="0"
            aria-label="Ordem de exibição"
          />
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Adicionando…" : "Adicionar"}
          </Button>
        </form>

        {loading ? (
          <div className={styles.loading}>
            <Spinner size="small" />
          </div>
        ) : (
          ASSET_GROUPS.map((group) => {
            const items = categories
              .filter((category) => category.group_key === group.key)
              .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "pt-BR"));

            if (items.length === 0) return null;

            return (
              <section key={group.key} className={styles.group}>
                <h3 className={styles.groupTitle}>{group.label}</h3>

                <ul className={styles.list}>
                  {items.map((category) => (
                    <li key={category.id} className={styles.item}>
                      {editingId === category.id ? (
                        <form onSubmit={handleSaveEdit} className={styles.editForm}>
                          <input
                            type="text"
                            className={styles.input}
                            value={editForm.name}
                            onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                            maxLength={80}
                            aria-label="Nome da categoria"
                            required
                          />
                          <input
                            type="text"
                            className={styles.input}
                            value={editForm.description}
                            onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                            maxLength={255}
                            placeholder="Descrição"
                            aria-label="Descrição da categoria"
                          />
                          <select
                            className={styles.input}
                            value={editForm.group_key}
                            onChange={(event) => setEditForm((current) => ({ ...current, group_key: event.target.value }))}
                            aria-label="Grupo da categoria"
                          >
                            {ASSET_GROUPS.map((option) => (
                              <option key={option.key} value={option.key}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            className={`${styles.input} ${styles.orderInput}`}
                            value={editForm.display_order}
                            onChange={(event) => setEditForm((current) => ({ ...current, display_order: event.target.value }))}
                            min="0"
                            aria-label="Ordem de exibição"
                          />
                          <div className={styles.itemActions}>
                            <Button type="submit" variant="primary" disabled={savingEdit}>
                              {savingEdit ? "Salvando…" : "Salvar"}
                            </Button>
                            <Button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setEditForm(null);
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className={styles.itemInfo}>
                            <strong className={styles.itemName}>{category.name}</strong>
                            <code className={styles.itemSlug}>{category.slug}</code>
                            {category.description && <span className={styles.itemDescription}>{category.description}</span>}
                          </div>

                          <div className={styles.itemBadges}>
                            <span className={`${styles.badge} ${category.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                              {category.is_active ? "Ativa" : "Inativa"}
                            </span>
                            <span className={styles.badge} title="Assets classificados com esta categoria">
                              {category.usage_count ?? 0} {category.usage_count === 1 ? "asset" : "assets"}
                            </span>
                          </div>

                          <div className={styles.itemActions}>
                            <Button type="button" size="small" onClick={() => startEdit(category)}>
                              Editar
                            </Button>
                            <Button type="button" size="small" onClick={() => toggleActive(category)}>
                              {category.is_active ? "Desativar" : "Reativar"}
                            </Button>
                            <Button type="button" size="small" variant="danger" onClick={() => handleDelete(category)}>
                              Excluir
                            </Button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </PageLayout.Content>
    </PageLayout>
  );
}
