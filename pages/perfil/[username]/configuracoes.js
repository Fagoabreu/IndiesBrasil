import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeftIcon } from "@primer/octicons-react";

import { useUser } from "@/context/UserContext";
import SeoHead from "@/components/SeoHead";
import styles from "./configuracoes.module.css";

const EXPERIENCE_LEVELS = ["Estudante", "Junior", "Pleno", "Senior", "Especialista"];

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, { credentials: "include", ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Erro na requisição");
  return data;
}

function StatusMsg({ msg }) {
  if (!msg?.text) return null;
  return <p className={`${styles.statusMsg} ${msg.type === "ok" ? styles.statusMsgOk : styles.statusMsgErr}`}>{msg.text}</p>;
}

/* ============================================================
   HISTORICO ITEM
   ============================================================ */
function HistoricoItemRow({ item, username, onSaved, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    cargo: item.cargo || "",
    company: item.company || "",
    cidade: item.cidade || "",
    estado: item.estado || "",
    init_date: item.init_date?.slice(0, 10) || "",
    end_date: item.end_date?.slice(0, 10) || "",
    atribuicoes: Array.isArray(item.atribuicoes) ? item.atribuicoes.join("\n") : "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function update(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchJSON(`/api/v1/users/${username}/historico/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cargo: form.cargo,
          company: form.company,
          cidade: form.cidade,
          estado: form.estado,
          init_date: form.init_date,
          end_date: form.end_date || null,
          atribuicoes: form.atribuicoes
            .split("\n")
            .map((v) => v.trim())
            .filter(Boolean),
        }),
      });
      setOpen(false);
      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Remover "${item.cargo}"?`)) return;
    setDeleting(true);
    try {
      await fetchJSON(`/api/v1/users/${username}/historico/${item.id}`, {
        method: "DELETE",
      });
      onDeleted();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={styles.itemRow}>
      <div className={styles.itemHeader}>
        <div className={styles.itemMeta}>
          <div className={styles.itemTitle}>{item.cargo || "(sem cargo)"}</div>
          <div className={styles.itemSubtitle}>{item.company || ""}</div>
        </div>
        <div className={styles.itemActions}>
          <button type="button" className={styles.btnOutline} onClick={() => setOpen((v) => !v)}>
            {open ? "Fechar" : "Editar"}
          </button>
          <button type="button" className={styles.btnDanger} onClick={handleDelete} disabled={deleting}>
            {deleting ? "..." : "Remover"}
          </button>
        </div>
      </div>

      {open && (
        <form className={styles.itemEditForm} onSubmit={handleSave}>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Cargo</label>
              <input className={styles.input} value={form.cargo} onChange={(e) => update("cargo", e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Empresa</label>
              <input className={styles.input} value={form.company} onChange={(e) => update("company", e.target.value)} />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Cidade</label>
              <input className={styles.input} value={form.cidade} onChange={(e) => update("cidade", e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Estado</label>
              <input className={styles.input} value={form.estado} onChange={(e) => update("estado", e.target.value)} maxLength={2} />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Início</label>
              <input type="date" className={styles.input} value={form.init_date} onChange={(e) => update("init_date", e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Conclusão (deixe vazio se atual)</label>
              <input type="date" className={styles.input} value={form.end_date} onChange={(e) => update("end_date", e.target.value)} />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Atribuições (uma por linha)</label>
            <textarea className={styles.textarea} rows={4} value={form.atribuicoes} onChange={(e) => update("atribuicoes", e.target.value)} />
          </div>
          <div className={styles.itemEditActions}>
            <button type="submit" className={styles.btnSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button type="button" className={styles.btnOutline} onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ============================================================
   FORMACAO ITEM
   ============================================================ */
function FormacaoItemRow({ item, username, onSaved, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nome: item.nome || "",
    instituicao: item.instituicao || "",
    init_date: item.init_date?.slice(0, 10) || "",
    end_date: item.end_date?.slice(0, 10) || "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function update(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchJSON(`/api/v1/users/${username}/formacoes/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          instituicao: form.instituicao,
          init_date: form.init_date,
          end_date: form.end_date || null,
        }),
      });
      setOpen(false);
      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Remover "${item.nome}"?`)) return;
    setDeleting(true);
    try {
      await fetchJSON(`/api/v1/users/${username}/formacoes/${item.id}`, {
        method: "DELETE",
      });
      onDeleted();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={styles.itemRow}>
      <div className={styles.itemHeader}>
        <div className={styles.itemMeta}>
          <div className={styles.itemTitle}>{item.nome || "(sem curso)"}</div>
          <div className={styles.itemSubtitle}>{item.instituicao || ""}</div>
        </div>
        <div className={styles.itemActions}>
          <button type="button" className={styles.btnOutline} onClick={() => setOpen((v) => !v)}>
            {open ? "Fechar" : "Editar"}
          </button>
          <button type="button" className={styles.btnDanger} onClick={handleDelete} disabled={deleting}>
            {deleting ? "..." : "Remover"}
          </button>
        </div>
      </div>

      {open && (
        <form className={styles.itemEditForm} onSubmit={handleSave}>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Curso</label>
              <input className={styles.input} value={form.nome} onChange={(e) => update("nome", e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Instituição</label>
              <input className={styles.input} value={form.instituicao} onChange={(e) => update("instituicao", e.target.value)} />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Início</label>
              <input type="date" className={styles.input} value={form.init_date} onChange={(e) => update("init_date", e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Conclusão (deixe vazio se em andamento)</label>
              <input type="date" className={styles.input} value={form.end_date} onChange={(e) => update("end_date", e.target.value)} />
            </div>
          </div>
          <div className={styles.itemEditActions}>
            <button type="submit" className={styles.btnSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button type="button" className={styles.btnOutline} onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ============================================================
   CONTATO ITEM
   ============================================================ */
function ContatoItemRow({ item, contactTypes, username, onSaved, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    contact_type_id: item.contact_type_id || "",
    contact_value: item.contact_value || "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function update(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  const typeName = contactTypes.find((t) => t.id == item.contact_type_id)?.icon_key || String(item.contact_type_id);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchJSON(`/api/v1/users/${username}/contacts/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_type_id: form.contact_type_id,
          contact_value: form.contact_value,
        }),
      });
      setOpen(false);
      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Remover contato "${typeName}"?`)) return;
    setDeleting(true);
    try {
      await fetchJSON(`/api/v1/users/${username}/contacts/${item.id}`, {
        method: "DELETE",
      });
      onDeleted();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={styles.itemRow}>
      <div className={styles.itemHeader}>
        <div className={styles.itemMeta}>
          <div className={styles.itemTitle}>{typeName}</div>
          <div className={styles.itemSubtitle}>{item.contact_value}</div>
        </div>
        <div className={styles.itemActions}>
          <button type="button" className={styles.btnOutline} onClick={() => setOpen((v) => !v)}>
            {open ? "Fechar" : "Editar"}
          </button>
          <button type="button" className={styles.btnDanger} onClick={handleDelete} disabled={deleting}>
            {deleting ? "..." : "Remover"}
          </button>
        </div>
      </div>

      {open && (
        <form className={styles.itemEditForm} onSubmit={handleSave}>
          <div className={styles.field}>
            <label className={styles.label}>Tipo de contato</label>
            <select className={styles.select} value={form.contact_type_id} onChange={(e) => update("contact_type_id", e.target.value)}>
              <option value="">Selecione...</option>
              {contactTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon_key}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Valor (URL, e-mail, @usuario…)</label>
            <input className={styles.input} value={form.contact_value} onChange={(e) => update("contact_value", e.target.value)} />
          </div>
          <div className={styles.itemEditActions}>
            <button type="submit" className={styles.btnSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button type="button" className={styles.btnOutline} onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ============================================================
   ROLE ITEM
   ============================================================ */
function RoleItemRow({ item, professions, username, onSaved, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: item.portfolio_role_name || "",
    experience: item.experience || "Estudante",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function update(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchJSON(`/api/v1/users/${username}/roles/${item.portfolio_role_name}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          experience: form.experience,
        }),
      });
      setOpen(false);
      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Remover especialização "${item.portfolio_role_name}"?`)) return;
    setDeleting(true);
    try {
      await fetchJSON(`/api/v1/users/${username}/roles/${item.portfolio_role_name}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={styles.itemRow}>
      <div className={styles.itemHeader}>
        <div className={styles.itemMeta}>
          <div className={styles.itemTitle}>{item.role_name || item.portfolio_role_name}</div>
          <div className={styles.itemSubtitle}>{item.experience}</div>
        </div>
        <div className={styles.itemActions}>
          <button type="button" className={styles.btnOutline} onClick={() => setOpen((v) => !v)}>
            {open ? "Fechar" : "Editar"}
          </button>
          <button type="button" className={styles.btnDanger} onClick={handleDelete} disabled={deleting}>
            {deleting ? "..." : "Remover"}
          </button>
        </div>
      </div>

      {open && (
        <form className={styles.itemEditForm} onSubmit={handleSave}>
          <div className={styles.field}>
            <label className={styles.label}>Especialização</label>
            <select className={styles.select} value={form.name} onChange={(e) => update("name", e.target.value)}>
              <option value="">Selecione...</option>
              {professions.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Nível</label>
            <select className={styles.select} value={form.experience} onChange={(e) => update("experience", e.target.value)}>
              {EXPERIENCE_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.itemEditActions}>
            <button type="submit" className={styles.btnSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button type="button" className={styles.btnOutline} onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ============================================================
   FERRAMENTA ITEM
   ============================================================ */
function FerramentaItemRow({ item, tools, username, onSaved, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    tool_id: item.portfolio_tool_id || "",
    experience: item.experience || "Estudante",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function update(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchJSON(`/api/v1/users/${username}/tools/${item.portfolio_tool_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolio_tool_id: Number(form.tool_id),
          experience: form.experience,
        }),
      });
      setOpen(false);
      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Remover ferramenta "${item.name}"?`)) return;
    setDeleting(true);
    try {
      await fetchJSON(`/api/v1/users/${username}/tools/${item.portfolio_tool_id}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={styles.itemRow}>
      <div className={styles.itemHeader}>
        <div className={styles.itemMeta}>
          <div className={styles.itemTitle}>{item.name}</div>
          <div className={styles.itemSubtitle}>{item.experience}</div>
        </div>
        <div className={styles.itemActions}>
          <button type="button" className={styles.btnOutline} onClick={() => setOpen((v) => !v)}>
            {open ? "Fechar" : "Editar"}
          </button>
          <button type="button" className={styles.btnDanger} onClick={handleDelete} disabled={deleting}>
            {deleting ? "..." : "Remover"}
          </button>
        </div>
      </div>

      {open && (
        <form className={styles.itemEditForm} onSubmit={handleSave}>
          <div className={styles.field}>
            <label className={styles.label}>Ferramenta</label>
            <select className={styles.select} value={form.tool_id} onChange={(e) => update("tool_id", e.target.value)}>
              <option value="">Selecione...</option>
              {tools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Nível</label>
            <select className={styles.select} value={form.experience} onChange={(e) => update("experience", e.target.value)}>
              {EXPERIENCE_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.itemEditActions}>
            <button type="submit" className={styles.btnSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button type="button" className={styles.btnOutline} onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */
export default function ProfileConfiguracoesPage() {
  const router = useRouter();
  const { username } = router.query;
  const { user: authUser, loadingUser } = useUser();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  // catalogs
  const [contactTypes, setContactTypes] = useState([]);
  const [professions, setProfessions] = useState([]);
  const [toolsCatalog, setToolsCatalog] = useState([]);

  // tabs
  const [activeTab, setActiveTab] = useState("perfil");

  // ---- Perfil básico ----
  const [resumo, setResumo] = useState("");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [perfilMsg, setPerfilMsg] = useState({ type: null, text: "" });

  // ---- Histórico — add form ----
  const [showAddHistorico, setShowAddHistorico] = useState(false);
  const [newHistorico, setNewHistorico] = useState({
    cargo: "",
    company: "",
    cidade: "",
    estado: "",
    init_date: "",
    end_date: "",
    atribuicoes: "",
  });
  const [addingHistorico, setAddingHistorico] = useState(false);

  // ---- Formação — add form ----
  const [showAddFormacao, setShowAddFormacao] = useState(false);
  const [newFormacao, setNewFormacao] = useState({
    nome: "",
    instituicao: "",
    init_date: "",
    end_date: "",
  });
  const [addingFormacao, setAddingFormacao] = useState(false);

  // ---- Contatos — add form ----
  const [showAddContato, setShowAddContato] = useState(false);
  const [newContato, setNewContato] = useState({
    contact_type_id: "",
    contact_value: "",
  });
  const [addingContato, setAddingContato] = useState(false);
  const [contatoMsg, setContatoMsg] = useState({ type: null, text: "" });

  // ---- Roles — add form ----
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", experience: "Estudante" });
  const [addingRole, setAddingRole] = useState(false);

  // ---- Ferramentas — add form ----
  const [showAddFerramenta, setShowAddFerramenta] = useState(false);
  const [newFerramenta, setNewFerramenta] = useState({
    tool_id: "",
    experience: "Estudante",
  });
  const [addingFerramenta, setAddingFerramenta] = useState(false);

  /* ---------- load profile ---------- */
  const reloadProfile = useCallback(async () => {
    if (!username) return;
    const data = await fetchJSON(`/api/v1/users/${username}/profile`);
    setProfile(data);
    setResumo(data.user.resumo || "");
    setBio(data.user.bio || "");
    setVisibility(data.user.visibility || "public");
  }, [username]);

  useEffect(() => {
    if (!username) return;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchJSON(`/api/v1/users/${username}/profile`);

        // Redirect if not own profile
        if (authUser && authUser.username !== username) {
          router.replace(`/perfil/${username}`);
          return;
        }

        setProfile(data);
        setResumo(data.user.resumo || "");
        setBio(data.user.bio || "");
        setVisibility(data.user.visibility || "public");
      } catch {
        router.replace(`/perfil/${username}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [username, authUser, router]);

  /* ---------- load catalogs ---------- */
  useEffect(() => {
    async function loadCatalogs() {
      try {
        const [types, profs, toolsList] = await Promise.all([
          fetchJSON("/api/v1/contact-types"),
          fetchJSON("/api/v1/professions"),
          fetchJSON("/api/v1/tools"),
        ]);
        setContactTypes(Array.isArray(types) ? types : []);
        setProfessions(Array.isArray(profs) ? profs : []);
        setToolsCatalog(Array.isArray(toolsList) ? toolsList : []);
      } catch {
        // silently ignore catalog errors
      }
    }
    loadCatalogs();
  }, []);

  /* ---------- wait for auth ---------- */
  if (loadingUser || loading) {
    return (
      <div className={styles.stateBox}>
        <span>Carregando...</span>
      </div>
    );
  }

  if (!profile) return null;

  const displayName = profile.user.username;

  /* ---------- handlers ---------- */

  async function handleSavePerfil(e) {
    e.preventDefault();
    setSavingPerfil(true);
    setPerfilMsg({ type: null, text: "" });
    try {
      await fetchJSON(`/api/v1/users/${username}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumo, bio, visibility }),
      });
      setPerfilMsg({ type: "ok", text: "Perfil salvo com sucesso." });
      await reloadProfile();
    } catch (err) {
      setPerfilMsg({ type: "err", text: err.message });
    } finally {
      setSavingPerfil(false);
    }
  }

  /* -- add historico -- */
  async function handleAddHistorico(e) {
    e.preventDefault();
    setAddingHistorico(true);
    try {
      await fetchJSON(`/api/v1/users/${username}/historico`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cargo: newHistorico.cargo,
          company: newHistorico.company,
          cidade: newHistorico.cidade,
          estado: newHistorico.estado,
          init_date: newHistorico.init_date,
          end_date: newHistorico.end_date || null,
          atribuicoes: newHistorico.atribuicoes
            .split("\n")
            .map((v) => v.trim())
            .filter(Boolean),
          ordem: (profile.historico || []).length,
        }),
      });
      setNewHistorico({
        cargo: "",
        company: "",
        cidade: "",
        estado: "",
        init_date: "",
        end_date: "",
        atribuicoes: "",
      });
      setShowAddHistorico(false);
      await reloadProfile();
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingHistorico(false);
    }
  }

  /* -- add formacao -- */
  async function handleAddFormacao(e) {
    e.preventDefault();
    setAddingFormacao(true);
    try {
      await fetchJSON(`/api/v1/users/${username}/formacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: newFormacao.nome,
          instituicao: newFormacao.instituicao,
          init_date: newFormacao.init_date,
          end_date: newFormacao.end_date || null,
          ordem: (profile.formacoes || []).length,
        }),
      });
      setNewFormacao({
        nome: "",
        instituicao: "",
        init_date: "",
        end_date: "",
      });
      setShowAddFormacao(false);
      await reloadProfile();
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingFormacao(false);
    }
  }

  /* -- add contato -- */
  async function handleAddContato(e) {
    e.preventDefault();
    setAddingContato(true);
    setContatoMsg({ type: null, text: "" });
    try {
      await fetchJSON(`/api/v1/users/${username}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_type_id: newContato.contact_type_id,
          contact_value: newContato.contact_value,
          ordem: (profile.contacts || []).length,
        }),
      });
      setNewContato({ contact_type_id: "", contact_value: "" });
      setShowAddContato(false);
      setContatoMsg({ type: "ok", text: "Contato adicionado." });
      await reloadProfile();
    } catch (err) {
      setContatoMsg({ type: "err", text: err.message });
    } finally {
      setAddingContato(false);
    }
  }

  /* -- add role -- */
  async function handleAddRole(e) {
    e.preventDefault();
    setAddingRole(true);
    try {
      await fetchJSON(`/api/v1/users/${username}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRole.name,
          experience: newRole.experience,
          ordem: (profile.roles || []).length,
        }),
      });
      setNewRole({ name: "", experience: "Estudante" });
      setShowAddRole(false);
      await reloadProfile();
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingRole(false);
    }
  }

  /* -- add ferramenta -- */
  async function handleAddFerramenta(e) {
    e.preventDefault();
    setAddingFerramenta(true);
    try {
      await fetchJSON(`/api/v1/users/${username}/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolio_tool_id: Number(newFerramenta.tool_id),
          experience: newFerramenta.experience,
        }),
      });
      setNewFerramenta({ tool_id: "", experience: "Estudante" });
      setShowAddFerramenta(false);
      await reloadProfile();
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingFerramenta(false);
    }
  }

  /* ---------- tabs definition ---------- */
  const TABS = [
    { id: "perfil", label: "Perfil" },
    { id: "historico", label: "Histórico" },
    { id: "formacao", label: "Formação" },
    { id: "contatos", label: "Contatos" },
    { id: "habilidades", label: "Habilidades" },
  ];

  /* ---------- render ---------- */
  return (
    <>
      <SeoHead title={`Configurações — ${displayName}`} />

      <div className={styles.page}>
        <div className={styles.topBar}>
          <Link href={`/perfil/${username}`} className={styles.backLink}>
            <ArrowLeftIcon size={14} />
            Voltar para o perfil
          </Link>
        </div>

        <h1 className={styles.pageTitle}>Configurações do perfil</h1>

        {/* ---- tab bar ---- */}
        <nav className={styles.tabs} aria-label="Seções de configuração">
          {TABS.map((t) => (
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

        {/* ============================================================
            TAB: PERFIL
            ============================================================ */}
        {activeTab === "perfil" && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Informações do perfil</h2>

            <StatusMsg msg={perfilMsg} />

            <form onSubmit={handleSavePerfil}>
              <div className={styles.fieldGroup}>
                <div className={styles.field}>
                  <label className={styles.label}>Visibilidade</label>
                  <select className={styles.select} value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                    <option value="public">Público</option>
                    <option value="followers">Seguidores</option>
                    <option value="private">Privado</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Resumo profissional</label>
                  <input
                    className={styles.input}
                    value={resumo}
                    onChange={(e) => setResumo(e.target.value)}
                    placeholder="Breve resumo da sua carreira"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Bio</label>
                  <textarea
                    className={styles.textarea}
                    rows={5}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Conte um pouco sobre você"
                  />
                </div>
              </div>

              <button type="submit" className={styles.btnSave} disabled={savingPerfil}>
                {savingPerfil ? "Salvando..." : "Salvar perfil"}
              </button>
            </form>
          </section>
        )}

        {/* ============================================================
            TAB: HISTÓRICO
            ============================================================ */}
        {activeTab === "historico" && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Histórico Profissional</h2>

            <div className={styles.itemList}>
              {(profile.historico || []).length === 0 && <p className={styles.empty}>Nenhum histórico cadastrado.</p>}
              {(profile.historico || [])
                .slice()
                .sort((a, b) => a.ordem - b.ordem)
                .map((item) => (
                  <HistoricoItemRow key={item.id} item={item} username={username} onSaved={reloadProfile} onDeleted={reloadProfile} />
                ))}
            </div>

            {showAddHistorico ? (
              <form className={styles.addForm} onSubmit={handleAddHistorico}>
                <p className={styles.addFormTitle}>Novo histórico</p>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>Cargo</label>
                    <input
                      className={styles.input}
                      value={newHistorico.cargo}
                      onChange={(e) =>
                        setNewHistorico((p) => ({
                          ...p,
                          cargo: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Empresa</label>
                    <input
                      className={styles.input}
                      value={newHistorico.company}
                      onChange={(e) =>
                        setNewHistorico((p) => ({
                          ...p,
                          company: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>Cidade</label>
                    <input
                      className={styles.input}
                      value={newHistorico.cidade}
                      onChange={(e) =>
                        setNewHistorico((p) => ({
                          ...p,
                          cidade: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Estado</label>
                    <input
                      className={styles.input}
                      value={newHistorico.estado}
                      onChange={(e) =>
                        setNewHistorico((p) => ({
                          ...p,
                          estado: e.target.value,
                        }))
                      }
                      maxLength={2}
                    />
                  </div>
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>Início</label>
                    <input
                      type="date"
                      className={styles.input}
                      value={newHistorico.init_date}
                      onChange={(e) =>
                        setNewHistorico((p) => ({
                          ...p,
                          init_date: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Conclusão (opcional)</label>
                    <input
                      type="date"
                      className={styles.input}
                      value={newHistorico.end_date}
                      onChange={(e) =>
                        setNewHistorico((p) => ({
                          ...p,
                          end_date: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Atribuições (uma por linha)</label>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    value={newHistorico.atribuicoes}
                    onChange={(e) =>
                      setNewHistorico((p) => ({
                        ...p,
                        atribuicoes: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className={styles.addFormActions}>
                  <button type="submit" className={styles.btnSave} disabled={addingHistorico}>
                    {addingHistorico ? "Adicionando..." : "Adicionar"}
                  </button>
                  <button type="button" className={styles.btnOutline} onClick={() => setShowAddHistorico(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className={styles.btnOutline} onClick={() => setShowAddHistorico(true)}>
                + Adicionar histórico
              </button>
            )}
          </section>
        )}

        {/* ============================================================
            TAB: FORMAÇÃO
            ============================================================ */}
        {activeTab === "formacao" && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Formação Acadêmica</h2>

            <div className={styles.itemList}>
              {(profile.formacoes || []).length === 0 && <p className={styles.empty}>Nenhuma formação cadastrada.</p>}
              {(profile.formacoes || [])
                .slice()
                .sort((a, b) => a.ordem - b.ordem)
                .map((item) => (
                  <FormacaoItemRow key={item.id} item={item} username={username} onSaved={reloadProfile} onDeleted={reloadProfile} />
                ))}
            </div>

            {showAddFormacao ? (
              <form className={styles.addForm} onSubmit={handleAddFormacao}>
                <p className={styles.addFormTitle}>Nova formação</p>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>Curso</label>
                    <input
                      className={styles.input}
                      value={newFormacao.nome}
                      onChange={(e) => setNewFormacao((p) => ({ ...p, nome: e.target.value }))}
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Instituição</label>
                    <input
                      className={styles.input}
                      value={newFormacao.instituicao}
                      onChange={(e) =>
                        setNewFormacao((p) => ({
                          ...p,
                          instituicao: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>Início</label>
                    <input
                      type="date"
                      className={styles.input}
                      value={newFormacao.init_date}
                      onChange={(e) =>
                        setNewFormacao((p) => ({
                          ...p,
                          init_date: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Conclusão (opcional)</label>
                    <input
                      type="date"
                      className={styles.input}
                      value={newFormacao.end_date}
                      onChange={(e) =>
                        setNewFormacao((p) => ({
                          ...p,
                          end_date: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className={styles.addFormActions}>
                  <button type="submit" className={styles.btnSave} disabled={addingFormacao}>
                    {addingFormacao ? "Adicionando..." : "Adicionar"}
                  </button>
                  <button type="button" className={styles.btnOutline} onClick={() => setShowAddFormacao(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className={styles.btnOutline} onClick={() => setShowAddFormacao(true)}>
                + Adicionar formação
              </button>
            )}
          </section>
        )}

        {/* ============================================================
            TAB: CONTATOS
            ============================================================ */}
        {activeTab === "contatos" && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Contatos</h2>

            <StatusMsg msg={contatoMsg} />

            <div className={styles.itemList}>
              {(profile.contacts || []).length === 0 && <p className={styles.empty}>Nenhum contato cadastrado.</p>}
              {(profile.contacts || [])
                .slice()
                .sort((a, b) => a.ordem - b.ordem)
                .map((item) => (
                  <ContatoItemRow
                    key={item.id}
                    item={item}
                    contactTypes={contactTypes}
                    username={username}
                    onSaved={reloadProfile}
                    onDeleted={reloadProfile}
                  />
                ))}
            </div>

            {showAddContato ? (
              <form className={styles.addForm} onSubmit={handleAddContato}>
                <p className={styles.addFormTitle}>Novo contato</p>
                <div className={styles.field}>
                  <label className={styles.label}>Tipo de contato</label>
                  <select
                    className={styles.select}
                    value={newContato.contact_type_id}
                    onChange={(e) =>
                      setNewContato((p) => ({
                        ...p,
                        contact_type_id: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Selecione...</option>
                    {contactTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.icon_key}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Valor (URL, e-mail, @usuario…)</label>
                  <input
                    className={styles.input}
                    value={newContato.contact_value}
                    onChange={(e) =>
                      setNewContato((p) => ({
                        ...p,
                        contact_value: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className={styles.addFormActions}>
                  <button type="submit" className={styles.btnSave} disabled={addingContato}>
                    {addingContato ? "Adicionando..." : "Adicionar"}
                  </button>
                  <button type="button" className={styles.btnOutline} onClick={() => setShowAddContato(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className={styles.btnOutline} onClick={() => setShowAddContato(true)}>
                + Adicionar contato
              </button>
            )}
          </section>
        )}

        {/* ============================================================
            TAB: HABILIDADES
            ============================================================ */}
        {activeTab === "habilidades" && (
          <>
            {/* Especializações */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Especializações</h2>

              <div className={styles.itemList}>
                {(profile.roles || []).length === 0 && <p className={styles.empty}>Nenhuma especialização cadastrada.</p>}
                {(profile.roles || []).map((item) => (
                  <RoleItemRow
                    key={item.portfolio_role_name}
                    item={item}
                    professions={professions}
                    username={username}
                    onSaved={reloadProfile}
                    onDeleted={reloadProfile}
                  />
                ))}
              </div>

              {showAddRole ? (
                <form className={styles.addForm} onSubmit={handleAddRole}>
                  <p className={styles.addFormTitle}>Nova especialização</p>
                  <div className={styles.field}>
                    <label className={styles.label}>Especialização</label>
                    <select
                      className={styles.select}
                      value={newRole.name}
                      onChange={(e) => setNewRole((p) => ({ ...p, name: e.target.value }))}
                      required
                    >
                      <option value="">Selecione...</option>
                      {professions.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Nível</label>
                    <select
                      className={styles.select}
                      value={newRole.experience}
                      onChange={(e) =>
                        setNewRole((p) => ({
                          ...p,
                          experience: e.target.value,
                        }))
                      }
                    >
                      {EXPERIENCE_LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.addFormActions}>
                    <button type="submit" className={styles.btnSave} disabled={addingRole}>
                      {addingRole ? "Adicionando..." : "Adicionar"}
                    </button>
                    <button type="button" className={styles.btnOutline} onClick={() => setShowAddRole(false)}>
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" className={styles.btnOutline} onClick={() => setShowAddRole(true)}>
                  + Adicionar especialização
                </button>
              )}
            </section>

            {/* Ferramentas */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Ferramentas</h2>

              <div className={styles.itemList}>
                {(profile.tools || []).length === 0 && <p className={styles.empty}>Nenhuma ferramenta cadastrada.</p>}
                {(profile.tools || []).map((item) => (
                  <FerramentaItemRow
                    key={item.portfolio_tool_id}
                    item={item}
                    tools={toolsCatalog}
                    username={username}
                    onSaved={reloadProfile}
                    onDeleted={reloadProfile}
                  />
                ))}
              </div>

              {showAddFerramenta ? (
                <form className={styles.addForm} onSubmit={handleAddFerramenta}>
                  <p className={styles.addFormTitle}>Nova ferramenta</p>
                  <div className={styles.field}>
                    <label className={styles.label}>Ferramenta</label>
                    <select
                      className={styles.select}
                      value={newFerramenta.tool_id}
                      onChange={(e) =>
                        setNewFerramenta((p) => ({
                          ...p,
                          tool_id: e.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Selecione...</option>
                      {toolsCatalog.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Nível</label>
                    <select
                      className={styles.select}
                      value={newFerramenta.experience}
                      onChange={(e) =>
                        setNewFerramenta((p) => ({
                          ...p,
                          experience: e.target.value,
                        }))
                      }
                    >
                      {EXPERIENCE_LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.addFormActions}>
                    <button type="submit" className={styles.btnSave} disabled={addingFerramenta}>
                      {addingFerramenta ? "Adicionando..." : "Adicionar"}
                    </button>
                    <button type="button" className={styles.btnOutline} onClick={() => setShowAddFerramenta(false)}>
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" className={styles.btnOutline} onClick={() => setShowAddFerramenta(true)}>
                  + Adicionar ferramenta
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
