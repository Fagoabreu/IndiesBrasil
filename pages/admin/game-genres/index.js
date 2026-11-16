import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { PageLayout, Heading, Flash, Button, Spinner } from "@primer/react";
import { TagIcon } from "@primer/octicons-react";

import { useUser } from "@/context/UserContext";
import { MAX_GENRE_NAME_LENGTH } from "@/lib/gameGenres";
import styles from "./index.module.css";

/**
 * Catálogo de gêneros de jogo e fila de sugestões.
 *
 * Mesmo padrão de Serviços e Profissões, com uma diferença de estrutura:
 * **hierarquia de dois níveis** (gênero › subgênero). A lista mostra o pai com os
 * filhos indentados e o `<select>` permite escolher o pai — o servidor recusa um
 * terceiro nível.
 *
 * Gênero em uso é **desativado**, não excluído: a API responde 400 com a
 * contagem de jogos e a tela repete a mensagem. Excluir apagaria a classificação
 * de jogos existentes sem ninguém pedir.
 */
export default function GameGenresAdminPage() {
  const router = useRouter();
  const { user, loadingUser } = useUser();
  const isAdmin = Boolean(user?.features?.includes("read:admin"));

  const [tree, setTree] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [name, setName] = useState("");
  const [parentName, setParentName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingName, setEditingName] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [reviewingId, setReviewingId] = useState(null);
  // Pai escolhido por sugestão. Estado e não `document.getElementById`: o React
  // não sabe do valor lido direto do DOM, e o `<select>` controlado é a forma de
  // a escolha sobreviver a um re-render da fila.
  const [approveParent, setApproveParent] = useState({});

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [catalogResponse, suggestionsResponse] = await Promise.all([
        fetch("/api/v1/game-genres?include_inactive=true", { credentials: "include" }),
        fetch("/api/v1/game-genre-suggestions?status=pending", { credentials: "include" }),
      ]);

      const catalogData = await catalogResponse.json();
      if (!catalogResponse.ok) {
        throw new Error(catalogData.message || "Erro ao carregar gêneros.");
      }

      setTree(Array.isArray(catalogData) ? catalogData : []);

      // A fila pode responder 403 numa sessão que perdeu `read:admin` no meio do
      // caminho; a lista vazia mantém a página renderizável em vez de derrubar
      // tudo por causa da seção secundária.
      if (suggestionsResponse.ok) {
        const suggestionsData = await suggestionsResponse.json();
        setSuggestions(Array.isArray(suggestionsData) ? suggestionsData : []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loadingUser || !isAdmin) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
       única; `reload` é estável (`useCallback` sem dependências). */
    reload();
  }, [loadingUser, isAdmin, reload]);

  async function handleCreate(event) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/game-genres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          parent_name: parentName || null,
          description: description.trim() || null,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao criar gênero.");
      }

      setSuccess(`Gênero "${data.name}" criado.`);
      setName("");
      setDescription("");
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(node) {
    setEditingName(node.name);
    setEditForm({
      name: node.name,
      parent_name: node.parent_name || "",
      description: node.description || "",
      display_order: String(node.display_order ?? 0),
    });
  }

  async function handleSaveEdit(event) {
    event.preventDefault();
    if (!editForm) return;

    setError(null);
    setSuccess(null);
    setSavingEdit(true);

    try {
      const response = await fetch(`/api/v1/game-genres/${encodeURIComponent(editingName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editForm.name.trim(),
          parent_name: editForm.parent_name || null,
          description: editForm.description.trim() || null,
          display_order: Number.parseInt(editForm.display_order, 10) || 0,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao salvar gênero.");
      }

      setEditingName(null);
      setEditForm(null);
      setSuccess("Gênero atualizado.");
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleActive(node) {
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/v1/game-genres/${encodeURIComponent(node.name)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: !node.is_active }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao alterar o gênero.");
      }

      setSuccess(node.is_active ? `"${node.name}" desativado.` : `"${node.name}" reativado.`);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(node) {
    if (!confirm(`Excluir o gênero "${node.name}"?`)) return;

    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/v1/game-genres/${encodeURIComponent(node.name)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        // 400 com a contagem de jogos: a mensagem do servidor é a informação
        // útil ("está em uso por 3 jogos"), então ela é repetida na tela.
        throw new Error(data.message || "Erro ao excluir gênero.");
      }

      setSuccess(`Gênero "${data.name}" excluído.`);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function reviewSuggestion(suggestion, status) {
    setError(null);
    setSuccess(null);
    setReviewingId(suggestion.id);

    try {
      const response = await fetch(`/api/v1/game-genre-suggestions/${suggestion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, parent_name: status === "approved" ? approveParent[suggestion.id] || null : null }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao revisar a sugestão.");
      }

      setSuccess(
        status === "approved" ? `"${suggestion.name}" aprovado e vinculado a "${suggestion.game_name}".` : `Sugestão "${suggestion.name}" recusada.`,
      );
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
          <Heading as="h2">Gêneros de Jogos</Heading>
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
          <TagIcon size={20} />
          <Heading as="h2">Gêneros de Jogos</Heading>
        </div>
        <p className={styles.hint}>
          Dois níveis: gênero e subgênero. Filtrar por um gênero devolve também os jogos marcados com qualquer subgênero dele — por isso o pai pode
          ser marcado, para quem não sabe dizer o subgênero. Gênero em uso não pode ser excluído: desative-o.
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
            <ul className={styles.list}>
              {suggestions.map((suggestion) => (
                <li key={suggestion.id} className={styles.suggestionItem}>
                  <div>
                    <span className={styles.suggestionName}>{suggestion.name}</span>
                    <p className={styles.suggestionMeta}>
                      sugerido por @{suggestion.suggested_by_username} para{" "}
                      <a href={`/jogos/${suggestion.game_slug}`} target="_blank" rel="noopener noreferrer">
                        {suggestion.game_name}
                      </a>
                    </p>
                    {suggestion.justification && <p className={styles.suggestionMeta}>{suggestion.justification}</p>}
                  </div>

                  {/* Aprovar exige escolher o pai: é a decisão editorial que a
                      sugestão não pode tomar sozinha (primeiro nível ou filho de
                      quem). Sem escolha, o gênero nasce no primeiro nível. */}
                  <div className={styles.suggestionActions}>
                    <select
                      className={styles.input}
                      value={approveParent[suggestion.id] || ""}
                      onChange={(event) => setApproveParent((current) => ({ ...current, [suggestion.id]: event.target.value }))}
                      aria-label={`Gênero pai de ${suggestion.name}`}
                    >
                      <option value="">Gênero de primeiro nível</option>
                      {tree.map((parent) => (
                        <option key={parent.name} value={parent.name}>
                          Subgênero de {parent.name}
                        </option>
                      ))}
                    </select>
                    <Button variant="primary" disabled={reviewingId === suggestion.id} onClick={() => reviewSuggestion(suggestion, "approved")}>
                      Aprovar
                    </Button>
                    <Button variant="danger" disabled={reviewingId === suggestion.id} onClick={() => reviewSuggestion(suggestion, "rejected")}>
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
              placeholder="Nome do gênero (ex: Bullet Heaven)"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={MAX_GENRE_NAME_LENGTH}
              aria-label="Nome do gênero"
            />
            <select className={styles.input} value={parentName} onChange={(event) => setParentName(event.target.value)} aria-label="Gênero pai">
              <option value="">Gênero de primeiro nível</option>
              {tree.map((parent) => (
                <option key={parent.name} value={parent.name}>
                  Subgênero de {parent.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              className={styles.input}
              placeholder="Descrição (opcional)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={255}
              aria-label="Descrição do gênero"
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
            <ul className={styles.list}>
              {tree.map((parent) => (
                <li key={parent.name}>
                  <GenreRow
                    node={parent}
                    tree={tree}
                    editingName={editingName}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    onEdit={startEdit}
                    onCancel={() => {
                      setEditingName(null);
                      setEditForm(null);
                    }}
                    onSave={handleSaveEdit}
                    savingEdit={savingEdit}
                    onToggleActive={toggleActive}
                    onDelete={handleDelete}
                  />
                  {parent.children.length > 0 && (
                    <ul className={styles.sublist}>
                      {parent.children.map((child) => (
                        <li key={child.name}>
                          <GenreRow
                            node={child}
                            tree={tree}
                            editingName={editingName}
                            editForm={editForm}
                            setEditForm={setEditForm}
                            onEdit={startEdit}
                            onCancel={() => {
                              setEditingName(null);
                              setEditForm(null);
                            }}
                            onSave={handleSaveEdit}
                            savingEdit={savingEdit}
                            onToggleActive={toggleActive}
                            onDelete={handleDelete}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </PageLayout.Content>
    </PageLayout>
  );
}

/** Uma linha do catálogo — serve para gênero e para subgênero. */
function GenreRow({ node, tree, editingName, editForm, setEditForm, onEdit, onCancel, onSave, savingEdit, onToggleActive, onDelete }) {
  if (editingName === node.name) {
    return (
      <form onSubmit={onSave} className={styles.editForm}>
        <input
          type="text"
          className={styles.input}
          value={editForm.name}
          onChange={(event) => setEditForm((form) => ({ ...form, name: event.target.value }))}
          maxLength={MAX_GENRE_NAME_LENGTH}
          aria-label="Nome do gênero"
        />
        <select
          className={styles.input}
          value={editForm.parent_name}
          onChange={(event) => setEditForm((form) => ({ ...form, parent_name: event.target.value }))}
          aria-label="Gênero pai"
        >
          {/* O próprio nó sai da lista: um gênero não pode ser pai de si mesmo. */}
          <option value="">Gênero de primeiro nível</option>
          {tree
            .filter((parent) => parent.name !== node.name)
            .map((parent) => (
              <option key={parent.name} value={parent.name}>
                Subgênero de {parent.name}
              </option>
            ))}
        </select>
        <input
          type="number"
          className={`${styles.input} ${styles.orderInput}`}
          value={editForm.display_order}
          onChange={(event) => setEditForm((form) => ({ ...form, display_order: event.target.value }))}
          min="0"
          aria-label="Ordem de exibição"
        />
        <Button type="submit" variant="primary" disabled={savingEdit}>
          {savingEdit ? "Salvando…" : "Salvar"}
        </Button>
        <Button type="button" onClick={onCancel}>
          Cancelar
        </Button>
      </form>
    );
  }

  return (
    <div className={styles.row}>
      <span className={styles.rowName}>
        {node.name}
        {!node.is_active && <span className={styles.inactiveBadge}>desativado</span>}
      </span>
      <span className={styles.rowUsage}>{node.usage_count} jogo(s)</span>
      <div className={styles.rowActions}>
        <Button size="small" onClick={() => onEdit(node)}>
          Editar
        </Button>
        <Button size="small" onClick={() => onToggleActive(node)}>
          {node.is_active ? "Desativar" : "Reativar"}
        </Button>
        <Button size="small" variant="danger" onClick={() => onDelete(node)} disabled={node.usage_count > 0}>
          Excluir
        </Button>
      </div>
    </div>
  );
}
