import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { PageLayout, Heading, Flash, Button, Spinner } from "@primer/react";
import { PeopleIcon } from "@primer/octicons-react";

import { useUser } from "@/context/UserContext";
import { PROFESSION_GROUPS, groupProfessions } from "@/lib/professionGroups";
import { PROFESSION_ICONS } from "@/lib/professionIcons";
import styles from "./index.module.css";

/**
 * Catálogo de profissões — o que os usuários podem declarar como especialidade.
 *
 * Segue o padrão de `/admin/services`: **catálogo** curado pelo admin e **fila de
 * sugestões** de qualquer usuário. As duas seções existem porque são duas
 * decisões diferentes: uma é edição do vocabulário, a outra é aprovar o
 * vocabulário que a comunidade pediu.
 *
 * Aprovar **cria a profissão na hora** (a API faz isso), com o ícone escolhido
 * aqui — a profissão não tem ícone próprio até alguém escolher um dos vinte e
 * cinco disponíveis, e sem ele o perfil de quem declarar mostraria imagem
 * quebrada.
 *
 * `is_active` tem o mesmo papel das categorias de asset: profissão que sai de
 * uso é **desativada** (some do seletor e dos filtros, continua nos perfis que já
 * a tinham), e a exclusão só é aceita quando ninguém usa.
 */

/** `<option>` dos vinte e cinco ícones — usado nos quatro seletores da tela. */
function IconOptions() {
  return (
    <>
      {PROFESSION_ICONS.map((icon) => (
        <option key={icon.key} value={icon.key}>
          {icon.label}
        </option>
      ))}
    </>
  );
}

export default function ProfessionsAdminPage() {
  const router = useRouter();
  const { user, loadingUser } = useUser();
  const isAdmin = Boolean(user?.features?.includes("read:admin"));

  const [professions, setProfessions] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [name, setName] = useState("");
  const [iconImg, setIconImg] = useState(PROFESSION_ICONS[0].key);
  const [description, setDescription] = useState("");
  const [groupKey, setGroupKey] = useState(PROFESSION_GROUPS[0].key);
  const [displayOrder, setDisplayOrder] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  const [editingName, setEditingName] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  /** Escolha por sugestão: grupo e ícone de cada linha são independentes. */
  const [reviewChoice, setReviewChoice] = useState({});
  const [reviewingId, setReviewingId] = useState(null);

  const reload = useCallback(async () => {
    const [professionsRes, suggestionsRes] = await Promise.all([
      fetch("/api/v1/professions?include_inactive=true", { credentials: "include" }),
      fetch("/api/v1/profession-suggestions?status=pending", { credentials: "include" }),
    ]);

    if (professionsRes.ok) {
      const data = await professionsRes.json();
      setProfessions(Array.isArray(data) ? data : []);
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

  const groups = useMemo(() => groupProfessions(professions), [professions]);

  function choiceFor(suggestionId) {
    return reviewChoice[suggestionId] || { group_key: PROFESSION_GROUPS[0].key, icon_img: PROFESSION_ICONS[0].key };
  }

  function updateChoice(suggestionId, patch) {
    setReviewChoice((current) => ({ ...current, [suggestionId]: { ...choiceFor(suggestionId), ...patch } }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError("O nome da profissão é obrigatório.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/professions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          icon_img: iconImg,
          description: description.trim() || null,
          group_key: groupKey,
          display_order: Number.parseInt(displayOrder, 10) || 0,
        }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Erro ao criar profissão.");

      setName("");
      setDescription("");
      setDisplayOrder("0");
      setSuccess(`Profissão "${data.name}" criada.`);
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(profession) {
    setEditingName(profession.name);
    setEditForm({
      name: profession.name,
      icon_img: profession.icon_img,
      description: profession.description || "",
      group_key: profession.group_key,
      display_order: String(profession.display_order ?? 0),
    });
  }

  async function handleSaveEdit(event) {
    event.preventDefault();
    if (!editForm) return;

    setError(null);
    setSuccess(null);
    setSavingEdit(true);

    try {
      const response = await fetch(`/api/v1/professions/${encodeURIComponent(editingName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editForm.name.trim(),
          icon_img: editForm.icon_img,
          description: editForm.description.trim() || null,
          group_key: editForm.group_key,
          display_order: Number.parseInt(editForm.display_order, 10) || 0,
        }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Erro ao salvar profissão.");

      setEditingName(null);
      setEditForm(null);
      setSuccess("Profissão atualizada.");
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleActive(profession) {
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/v1/professions/${encodeURIComponent(profession.name)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: !profession.is_active }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Erro ao alterar a profissão.");

      setSuccess(profession.is_active ? `"${profession.name}" desativada.` : `"${profession.name}" reativada.`);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(profession) {
    if (!confirm(`Excluir a profissão "${profession.name}"?`)) return;

    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/v1/professions/${encodeURIComponent(profession.name)}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        // A API responde 400 com a contagem: é ela que diz o tamanho do
        // problema, e a mensagem já orienta a desativar.
        throw new Error(data.message || "Erro ao excluir profissão.");
      }

      setSuccess(`Profissão "${profession.name}" excluída.`);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function reviewSuggestion(suggestionId, status) {
    setError(null);
    setSuccess(null);
    setReviewingId(suggestionId);

    const choice = choiceFor(suggestionId);
    const body = status === "approved" ? { status, group_key: choice.group_key, icon_img: choice.icon_img } : { status };

    try {
      const response = await fetch(`/api/v1/profession-suggestions/${suggestionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Erro ao revisar a sugestão.");

      setSuccess(status === "approved" ? `"${data.name}" aprovada e criada no catálogo.` : `"${data.name}" recusada.`);
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
          <Heading as="h2">Profissões</Heading>
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
          <PeopleIcon size={20} />
          <Heading as="h2">Profissões</Heading>
        </div>
        <p className={styles.hint}>
          Os oito grupos são fixos (estrutura de apresentação); as profissões de cada grupo são cadastradas aqui e escolhidas no perfil. Profissão em
          uso por um perfil não pode ser excluída — desative-a.
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
              {suggestions.map((suggestion) => {
                const choice = choiceFor(suggestion.id);

                return (
                  <li key={suggestion.id} className={styles.suggestionItem}>
                    <div className={styles.suggestionBody}>
                      <span className={styles.suggestionName}>{suggestion.name}</span>
                      <span className={styles.suggestionMeta}>sugerida por @{suggestion.suggested_by_username}</span>
                      {suggestion.justification && <p className={styles.suggestionWhy}>{suggestion.justification}</p>}
                    </div>

                    <div className={styles.suggestionActions}>
                      <select
                        className={styles.select}
                        value={choice.group_key}
                        onChange={(event) => updateChoice(suggestion.id, { group_key: event.target.value })}
                        aria-label={`Grupo para ${suggestion.name}`}
                      >
                        {PROFESSION_GROUPS.map((group) => (
                          <option key={group.key} value={group.key}>
                            {group.label}
                          </option>
                        ))}
                      </select>

                      {/* O ícone é obrigatório: a profissão não existe no
                          catálogo até esta escolha, e sem ícone o perfil de quem
                          a declarar mostraria imagem quebrada. */}
                      <select
                        className={styles.select}
                        value={choice.icon_img}
                        onChange={(event) => updateChoice(suggestion.id, { icon_img: event.target.value })}
                        aria-label={`Ícone para ${suggestion.name}`}
                      >
                        <IconOptions />
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
                );
              })}
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
              placeholder="Nome da profissão (ex: Roteirista)"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              aria-label="Nome da profissão"
            />
            <select className={styles.select} value={iconImg} onChange={(event) => setIconImg(event.target.value)} aria-label="Ícone da profissão">
              <IconOptions />
            </select>
            <input
              type="text"
              className={styles.input}
              placeholder="Descrição (opcional)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={255}
              aria-label="Descrição da profissão"
            />
            <select className={styles.select} value={groupKey} onChange={(event) => setGroupKey(event.target.value)} aria-label="Grupo da profissão">
              {PROFESSION_GROUPS.map((group) => (
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
            groups.map((group) => (
              <div key={group.key} className={styles.group}>
                <h4 className={styles.groupTitle}>{group.label}</h4>

                <ul className={styles.list}>
                  {group.professions.map((profession) => (
                    <li key={profession.name} className={`${styles.item} ${profession.is_active ? "" : styles.itemInactive}`}>
                      {editingName === profession.name ? (
                        <form onSubmit={handleSaveEdit} className={styles.editForm}>
                          <input
                            type="text"
                            className={styles.input}
                            value={editForm.name}
                            onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                            maxLength={80}
                            aria-label="Nome da profissão"
                            required
                          />
                          <select
                            className={styles.select}
                            value={editForm.icon_img}
                            onChange={(event) => setEditForm((current) => ({ ...current, icon_img: event.target.value }))}
                            aria-label="Ícone da profissão"
                          >
                            <IconOptions />
                          </select>
                          <input
                            type="text"
                            className={styles.input}
                            value={editForm.description}
                            onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                            maxLength={255}
                            placeholder="Descrição"
                            aria-label="Descrição da profissão"
                          />
                          <select
                            className={styles.select}
                            value={editForm.group_key}
                            onChange={(event) => setEditForm((current) => ({ ...current, group_key: event.target.value }))}
                            aria-label="Grupo da profissão"
                          >
                            {PROFESSION_GROUPS.map((option) => (
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
                              setEditingName(null);
                              setEditForm(null);
                            }}
                          >
                            Cancelar
                          </Button>
                        </form>
                      ) : (
                        <>
                          <div className={styles.itemInfo}>
                            <span className={styles.itemName}>{profession.name}</span>
                            {profession.description && <span className={styles.itemDescription}>{profession.description}</span>}
                            <span className={styles.itemMeta}>
                              {profession.usage_count} {profession.usage_count === 1 ? "perfil" : "perfis"}
                              {profession.is_active ? "" : " · desativada"}
                            </span>
                          </div>

                          <div className={styles.itemActions}>
                            <Button size="small" onClick={() => startEdit(profession)}>
                              Editar
                            </Button>
                            <Button size="small" onClick={() => toggleActive(profession)}>
                              {profession.is_active ? "Desativar" : "Reativar"}
                            </Button>
                            <Button size="small" variant="danger" onClick={() => handleDelete(profession)}>
                              Excluir
                            </Button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      </PageLayout.Content>
    </PageLayout>
  );
}
