import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { PageLayout, Heading, Flash, Button, Spinner } from "@primer/react";
import { ToolsIcon } from "@primer/octicons-react";

import { useUser } from "@/context/UserContext";
import { SERVICE_GROUPS } from "@/lib/serviceGroups";
import styles from "./index.module.css";

/**
 * Catálogo de serviços — o que os estúdios podem declarar que prestam.
 *
 * Mesmo padrão de Profissões, Tipos de Contato e Categorias de Asset: catálogo
 * pequeno, curado pelo administrador. A diferença é a **segunda seção**: a fila
 * de sugestões de usuários, que aqui é o insumo principal. Aprovar cria o
 * serviço na hora (a API faz isso), porque mandar o admin redigitar o nome que
 * acabou de ler é o passo que faz uma fila nunca ser esvaziada.
 *
 * `is_active` tem o mesmo papel das categorias: serviço que sai de uso é
 * **desativado** (some do seletor e dos filtros, continua nos estúdios que já o
 * declararam), e a exclusão só é aceita quando ninguém usa.
 */
export default function ServicesAdminPage() {
  const router = useRouter();
  const { user, loadingUser } = useUser();
  const isAdmin = Boolean(user?.features?.includes("read:admin"));

  const [services, setServices] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupKey, setGroupKey] = useState(SERVICE_GROUPS[0].key);
  const [displayOrder, setDisplayOrder] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Grupo escolhido ao aprovar cada sugestão (uma decisão por linha).
  const [approveGroup, setApproveGroup] = useState({});
  const [reviewingId, setReviewingId] = useState(null);

  const reload = useCallback(async () => {
    const [servicesRes, suggestionsRes] = await Promise.all([
      fetch("/api/v1/services?include_inactive=true", { credentials: "include" }),
      fetch("/api/v1/service-suggestions?status=pending", { credentials: "include" }),
    ]);

    if (servicesRes.ok) {
      const data = await servicesRes.json();
      setServices(Array.isArray(data) ? data : []);
    }

    if (suggestionsRes.ok) {
      const data = await suggestionsRes.json();
      setSuggestions(Array.isArray(data) ? data : []);
    }
  }, []);

  useEffect(() => {
    if (loadingUser) return;
    // Sem acesso, a tela mostra o aviso e não há o que carregar.
    if (!isAdmin) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await reload();
      } catch {
        if (!cancelled) setError("Erro ao carregar o catálogo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, loadingUser, reload]);

  async function handleCreate(event) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError("O nome do serviço é obrigatório.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/services", {
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

      if (!response.ok) throw new Error(data.message || "Erro ao criar serviço.");

      setName("");
      setDescription("");
      setDisplayOrder("0");
      setSuccess(`Serviço "${data.name}" criado.`);
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(service) {
    setEditingId(service.id);
    setEditForm({
      name: service.name,
      description: service.description || "",
      group_key: service.group_key,
      display_order: String(service.display_order ?? 0),
    });
  }

  async function handleSaveEdit(event) {
    event.preventDefault();
    if (!editForm) return;

    setError(null);
    setSuccess(null);
    setSavingEdit(true);

    try {
      const response = await fetch(`/api/v1/services/${editingId}`, {
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

      if (!response.ok) throw new Error(data.message || "Erro ao salvar serviço.");

      setEditingId(null);
      setEditForm(null);
      setSuccess("Serviço atualizado.");
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleActive(service) {
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/v1/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: !service.is_active }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Erro ao alterar o serviço.");

      setSuccess(service.is_active ? `"${service.name}" desativado.` : `"${service.name}" reativado.`);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(service) {
    if (!confirm(`Excluir o serviço "${service.name}"?`)) return;

    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/v1/services/${service.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        // A API responde 400 com a contagem: é ela que diz o tamanho do
        // problema, e a mensagem já orienta a desativar.
        throw new Error(data.message || "Erro ao excluir serviço.");
      }

      setSuccess(`Serviço "${service.name}" excluído.`);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function reviewSuggestion(suggestionId, status) {
    setError(null);
    setSuccess(null);
    setReviewingId(suggestionId);

    const body = { status };
    if (status === "approved") {
      body.group_key = approveGroup[suggestionId] || SERVICE_GROUPS[0].key;
    }

    try {
      const response = await fetch(`/api/v1/service-suggestions/${suggestionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Erro ao revisar a sugestão.");

      setSuccess(status === "approved" ? `"${data.name}" aprovado e criado no catálogo.` : `"${data.name}" recusado.`);
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setReviewingId(null);
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
          <Heading as="h2">Serviços</Heading>
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
          <ToolsIcon size={20} />
          <Heading as="h2">Serviços</Heading>
        </div>
        <p className={styles.hint}>
          Os cinco grupos são fixos (estrutura de apresentação); os serviços de cada grupo são cadastrados aqui. Serviço em uso por um estúdio não
          pode ser excluído — desative-o.
        </p>

        {error && <Flash variant="danger">{error}</Flash>}
        {success && <Flash variant="success">{success}</Flash>}

        {/* ---- Fila de sugestões ---- */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Sugestões pendentes
            {suggestions.length > 0 && <span className={styles.badge}>{suggestions.length}</span>}
          </h3>

          {suggestions.length === 0 ? (
            <p className={styles.emptyLine}>Nenhuma sugestão esperando decisão.</p>
          ) : (
            <ul className={styles.suggestionList}>
              {suggestions.map((suggestion) => (
                <li key={suggestion.id} className={styles.suggestionItem}>
                  <div className={styles.suggestionBody}>
                    <span className={styles.suggestionName}>{suggestion.name}</span>
                    <span className={styles.suggestionMeta}>sugerido por @{suggestion.suggested_by_username}</span>
                    {suggestion.justification && <p className={styles.suggestionWhy}>{suggestion.justification}</p>}
                  </div>

                  <div className={styles.suggestionActions}>
                    <select
                      className={styles.select}
                      value={approveGroup[suggestion.id] || SERVICE_GROUPS[0].key}
                      onChange={(event) => setApproveGroup((current) => ({ ...current, [suggestion.id]: event.target.value }))}
                      aria-label={`Grupo para ${suggestion.name}`}
                    >
                      {SERVICE_GROUPS.map((group) => (
                        <option key={group.key} value={group.key}>
                          {group.label}
                        </option>
                      ))}
                    </select>

                    <Button
                      size="small"
                      variant="primary"
                      onClick={() => reviewSuggestion(suggestion.id, "approved")}
                      disabled={reviewingId === suggestion.id}
                    >
                      Aprovar
                    </Button>
                    <Button size="small" onClick={() => reviewSuggestion(suggestion.id, "rejected")} disabled={reviewingId === suggestion.id}>
                      Recusar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- Catálogo ---- */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Catálogo</h3>

          <form onSubmit={handleCreate} className={styles.createForm}>
            <input
              type="text"
              className={styles.input}
              placeholder="Nome do serviço (ex: Captura de Movimentos)"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              aria-label="Nome do serviço"
            />
            <input
              type="text"
              className={styles.input}
              placeholder="Descrição (opcional)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={255}
              aria-label="Descrição do serviço"
            />
            <select className={styles.select} value={groupKey} onChange={(event) => setGroupKey(event.target.value)} aria-label="Grupo do serviço">
              {SERVICE_GROUPS.map((group) => (
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
            SERVICE_GROUPS.map((group) => {
              const items = services
                .filter((service) => service.group_key === group.key)
                .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "pt-BR"));

              if (items.length === 0) return null;

              return (
                <div key={group.key} className={styles.group}>
                  <h4 className={styles.groupTitle}>{group.label}</h4>

                  <ul className={styles.list}>
                    {items.map((service) => (
                      <li key={service.id} className={`${styles.item} ${service.is_active ? "" : styles.itemInactive}`}>
                        {editingId === service.id ? (
                          <form onSubmit={handleSaveEdit} className={styles.editForm}>
                            <input
                              type="text"
                              className={styles.input}
                              value={editForm.name}
                              onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                              maxLength={80}
                              aria-label="Nome do serviço"
                              required
                            />
                            <input
                              type="text"
                              className={styles.input}
                              value={editForm.description}
                              onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                              maxLength={255}
                              placeholder="Descrição"
                              aria-label="Descrição do serviço"
                            />
                            <select
                              className={styles.select}
                              value={editForm.group_key}
                              onChange={(event) => setEditForm((current) => ({ ...current, group_key: event.target.value }))}
                              aria-label="Grupo do serviço"
                            >
                              {SERVICE_GROUPS.map((option) => (
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
                            <Button type="submit" size="small" variant="primary" disabled={savingEdit}>
                              Salvar
                            </Button>
                            <Button
                              size="small"
                              onClick={() => {
                                setEditingId(null);
                                setEditForm(null);
                              }}
                            >
                              Cancelar
                            </Button>
                          </form>
                        ) : (
                          <>
                            <div className={styles.itemInfo}>
                              <span className={styles.itemName}>{service.name}</span>
                              {service.description && <span className={styles.itemDescription}>{service.description}</span>}
                              <span className={styles.itemMeta}>
                                {service.usage_count} {service.usage_count === 1 ? "estúdio" : "estúdios"}
                                {service.is_active ? "" : " · desativado"}
                              </span>
                            </div>

                            <div className={styles.itemActions}>
                              <Button size="small" onClick={() => startEdit(service)}>
                                Editar
                              </Button>
                              <Button size="small" onClick={() => toggleActive(service)}>
                                {service.is_active ? "Desativar" : "Reativar"}
                              </Button>
                              <Button size="small" variant="danger" onClick={() => handleDelete(service)}>
                                Excluir
                              </Button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </section>
      </PageLayout.Content>
    </PageLayout>
  );
}
