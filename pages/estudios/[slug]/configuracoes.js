"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Spinner } from "@primer/react";
import { ArrowLeftIcon } from "@primer/octicons-react";

import { useUser } from "@/context/UserContext";
import SeoHead from "@/components/SeoHead";
import AddressFormFields from "@/components/Address/AddressFormFields";
import StatusMessageComponent from "@/components/StatusMessage/StatusMessageComponent";
import styles from "./configuracoes.module.css";

const EMPTY_ADDRESS = {
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zip_code: "",
  country: "Brasil",
};

function addrToForm(addr) {
  if (!addr) return EMPTY_ADDRESS;
  return {
    street: addr.street || "",
    number: addr.number || "",
    complement: addr.complement || "",
    neighborhood: addr.neighborhood || "",
    city: addr.city || "",
    state: addr.state || "",
    zip_code: addr.zip_code || "",
    country: addr.country || "Brasil",
  };
}

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { slug } = router.query;
  const { loadingUser } = useUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: null, text: "" });

  // Campos básicos
  const [name, setName] = useState("");
  const [pitch, setPitch] = useState("");
  const [description, setDescription] = useState("");
  const [history, setHistory] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [foundedAt, setFoundedAt] = useState("");

  // Endereço
  const [hasAddress, setHasAddress] = useState(false);
  const [address, setAddress] = useState(EMPTY_ADDRESS);

  // Membros
  const [members, setMembers] = useState([]);
  const [ownerId, setOwnerId] = useState(null);
  const [removingUsername, setRemovingUsername] = useState(null);
  const [memberMsg, setMemberMsg] = useState({ type: null, text: "" });

  // Convites
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteMsg, setInviteMsg] = useState({ type: null, text: "" });
  const [inviting, setInviting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [cancellingId, setCancellingId] = useState(null);

  // Contatos
  const [contacts, setContacts] = useState([]);
  const [contactTypes, setContactTypes] = useState([]);
  const [newContactTypeId, setNewContactTypeId] = useState("");
  const [newContactValue, setNewContactValue] = useState("");
  const [contactMsg, setContactMsg] = useState({ type: null, text: "" });
  const [addingContact, setAddingContact] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState(null);

  const fetchStudio = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/v1/studios/${slug}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || data.status_code) {
        router.replace(`/estudios/${slug}`);
        return;
      }

      // Verificar permissão
      const isOwner = data.viewer?.isOwner;
      const isAdmin = data.viewer?.isAdmin;
      if (!isOwner && !isAdmin) {
        router.replace(`/estudios/${slug}`);
        return;
      }

      setName(data.name || "");
      setPitch(data.pitch || "");
      setDescription(data.description || "");
      setHistory(data.history || "");
      setCnpj(data.cnpj || "");
      setFoundedAt(data.founded_at ? data.founded_at.slice(0, 10) : "");
      if (data.address) {
        setHasAddress(true);
        setAddress(addrToForm(data.address));
      }
      setMembers(data.members || []);
      setOwnerId(data.owner_id ?? null);
    } finally {
      setLoading(false);
    }
  }, [slug, router]);

  const fetchInvites = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/v1/studios/${slug}/invitations`, { credentials: "include" });
      if (res.ok) setPendingInvites(await res.json());
    } catch {
      // silently ignore
    }
  }, [slug]);

  const fetchContacts = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/v1/studios/${slug}/contacts`, { credentials: "include" });
      if (res.ok) setContacts(await res.json());
    } catch {
      // silently ignore
    }
  }, [slug]);

  useEffect(() => {
    fetch("/api/v1/contact-types", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setContactTypes(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStudio();
    fetchInvites();
    fetchContacts();
  }, [fetchStudio, fetchInvites, fetchContacts]);

  function handleAddressChange(field, value) {
    setAddress((prev) => ({ ...prev, [field]: value }));
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteUsername.trim()) return;
    setInviteMsg({ type: null, text: "" });
    setInviting(true);
    try {
      const res = await fetch(`/api/v1/studios/${slug}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: inviteUsername.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteMsg({ type: "error", text: data.message || "Erro ao enviar convite." });
        return;
      }
      setInviteUsername("");
      setInviteMsg({ type: "success", text: `Convite enviado para @${inviteUsername.trim()}.` });
      fetchInvites();
    } catch {
      setInviteMsg({ type: "error", text: "Erro inesperado. Tente novamente." });
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(username) {
    if (!confirm(`Remover @${username} do estúdio?`)) return;
    setMemberMsg({ type: null, text: "" });
    setRemovingUsername(username);
    try {
      const res = await fetch(`/api/v1/studios/${slug}/members/${username}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        setMemberMsg({ type: "error", text: data.message || "Erro ao remover membro." });
        return;
      }
      setMemberMsg({ type: "success", text: `@${username} removido do estúdio.` });
      fetchStudio();
    } catch {
      setMemberMsg({ type: "error", text: "Erro inesperado. Tente novamente." });
    } finally {
      setRemovingUsername(null);
    }
  }

  async function handleCancelInvite(id) {
    setCancellingId(id);
    try {
      await fetch(`/api/v1/studios/${slug}/invitations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      fetchInvites();
    } finally {
      setCancellingId(null);
    }
  }

  async function handleAddContact(e) {
    e.preventDefault();
    if (!newContactTypeId || !newContactValue.trim()) return;
    setContactMsg({ type: null, text: "" });
    setAddingContact(true);
    try {
      const res = await fetch(`/api/v1/studios/${slug}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ contact_type_id: Number(newContactTypeId), contact_value: newContactValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setContactMsg({ type: "error", text: data.message || "Erro ao adicionar contato." });
        return;
      }
      setNewContactTypeId("");
      setNewContactValue("");
      setContactMsg({ type: "success", text: "Contato adicionado." });
      fetchContacts();
    } catch {
      setContactMsg({ type: "error", text: "Erro inesperado. Tente novamente." });
    } finally {
      setAddingContact(false);
    }
  }

  async function handleDeleteContact(id) {
    setDeletingContactId(id);
    try {
      await fetch(`/api/v1/studios/${slug}/contacts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      fetchContacts();
    } finally {
      setDeletingContactId(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatusMsg({ type: null, text: "" });

    if (!name.trim()) {
      setStatusMsg({ type: "error", text: "O nome do estúdio é obrigatório." });
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        pitch: pitch.trim() || null,
        description: description.trim() || null,
        history: history.trim() || null,
        cnpj: cnpj.trim() || null,
        founded_at: foundedAt || null,
        address: hasAddress && address.city && address.state ? address : null,
      };

      const res = await fetch(`/api/v1/studios/${slug}`, {
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

      setStatusMsg({ type: "success", text: "Informações salvas com sucesso!" });
    } catch {
      setStatusMsg({ type: "error", text: "Erro inesperado. Tente novamente." });
    } finally {
      setSaving(false);
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
      <SeoHead title={`Configurações — ${name || "Estúdio"} — Indies Brasil`} />

      <div className={styles.page}>
        <div className={styles.topBar}>
          <Link href={`/estudios/${slug}`} className={styles.backLink}>
            <ArrowLeftIcon size={14} /> Voltar para o estúdio
          </Link>
          <h1 className={styles.pageTitle}>Configurações do Estúdio</h1>
        </div>

        {statusMsg.text && <StatusMessageComponent type={statusMsg.type} message={statusMsg.text} />}

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Informações básicas */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Informações Básicas</h2>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="cfg-name">
                Nome do estúdio <span className={styles.required}>*</span>
              </label>
              <input
                id="cfg-name"
                type="text"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="cfg-pitch">
                Tagline / Pitch
              </label>
              <input
                id="cfg-pitch"
                type="text"
                className={styles.input}
                value={pitch}
                onChange={(e) => setPitch(e.target.value)}
                maxLength={200}
                placeholder="Uma frase curta que resume o estúdio"
              />
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="cfg-founded">
                  Fundado em
                </label>
                <input id="cfg-founded" type="date" className={styles.input} value={foundedAt} onChange={(e) => setFoundedAt(e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="cfg-cnpj">
                  CNPJ
                </label>
                <input
                  id="cfg-cnpj"
                  type="text"
                  className={styles.input}
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  maxLength={18}
                  placeholder="00.000.000/0000-00"
                />
              </div>
            </div>
          </section>

          {/* Descrição */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Descrição</h2>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cfg-description">
                Sobre o estúdio
              </label>
              <textarea
                id="cfg-description"
                className={styles.textarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Descreva o estúdio, seus objetivos e projetos..."
              />
            </div>
          </section>

          {/* História */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>História</h2>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cfg-history">
                História do estúdio
              </label>
              <textarea
                id="cfg-history"
                className={styles.textarea}
                value={history}
                onChange={(e) => setHistory(e.target.value)}
                rows={5}
                placeholder="Como o estúdio foi fundado, marcos importantes..."
              />
            </div>
          </section>

          {/* Endereço */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Endereço</h2>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={hasAddress} onChange={(e) => setHasAddress(e.target.checked)} /> Adicionar endereço físico
            </label>

            {hasAddress && (
              <div className={styles.addressBlock}>
                <AddressFormFields value={address} onChange={handleAddressChange} />
                {hasAddress && (!address.city || !address.state) && (
                  <p className={styles.fieldHint}>Cidade e Estado são obrigatórios para salvar o endereço.</p>
                )}
              </div>
            )}
          </section>

          <div className={styles.formActions}>
            <Link href={`/estudios/${slug}`} className={styles.btnCancel}>
              Cancelar
            </Link>
            <button type="submit" className={styles.btnSave} disabled={saving}>
              {saving ? <Spinner size="small" /> : "Salvar alterações"}
            </button>
          </div>
        </form>

        {/* CONTATOS */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Contatos</h2>

          {contacts.length > 0 && (
            <ul className={styles.pendingList}>
              {contacts.map((c) => (
                <li key={c.id} className={styles.pendingItem}>
                  <span className={styles.pendingUsername}>
                    <strong>{c.icon_key}</strong> — {c.contact_value}
                  </span>
                  <button
                    type="button"
                    className={styles.btnCancelInvite}
                    onClick={() => handleDeleteContact(c.id)}
                    disabled={deletingContactId === c.id}
                  >
                    {deletingContactId === c.id ? "…" : "Remover"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAddContact} className={styles.contactRow}>
            <select className={styles.input} value={newContactTypeId} onChange={(e) => setNewContactTypeId(e.target.value)}>
              <option value="">Tipo de contato</option>
              {contactTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {ct.icon_key}
                </option>
              ))}
            </select>
            <input
              type="text"
              className={styles.input}
              placeholder="URL ou valor"
              value={newContactValue}
              onChange={(e) => setNewContactValue(e.target.value)}
              maxLength={255}
            />
            <button type="submit" className={styles.btnSave} disabled={addingContact || !newContactTypeId || !newContactValue.trim()}>
              {addingContact ? <Spinner size="small" /> : "Adicionar"}
            </button>
          </form>

          {contactMsg.text && <StatusMessageComponent type={contactMsg.type} message={contactMsg.text} />}
        </section>

        {/* GERENCIAR MEMBROS */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Membros ({members.length})</h2>

          {members.length > 0 && (
            <ul className={styles.pendingList}>
              {members.map((m) => (
                <li key={m.user_id ?? m.id} className={styles.pendingItem}>
                  <span className={styles.pendingUsername}>
                    {m.display_name || m.username}
                    {m.user_id === ownerId && <span className={styles.ownerBadge}> (dono)</span>}
                  </span>
                  {m.user_id !== ownerId && (
                    <button
                      type="button"
                      className={styles.btnCancelInvite}
                      onClick={() => handleRemoveMember(m.username)}
                      disabled={removingUsername === m.username}
                    >
                      {removingUsername === m.username ? "…" : "Remover"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {memberMsg.text && <StatusMessageComponent type={memberMsg.type} message={memberMsg.text} />}
        </section>

        {/* CONVIDAR MEMBROS */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Convidar Membros</h2>

          <form onSubmit={handleInvite} className={styles.inviteRow}>
            <input
              type="text"
              className={styles.input}
              placeholder="Username do usuário"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              maxLength={50}
            />
            <button type="submit" className={styles.btnSave} disabled={inviting || !inviteUsername.trim()}>
              {inviting ? <Spinner size="small" /> : "Convidar"}
            </button>
          </form>

          {inviteMsg.text && <StatusMessageComponent type={inviteMsg.type} message={inviteMsg.text} />}

          {pendingInvites.length > 0 && (
            <>
              <p className={styles.pendingTitle}>Convites pendentes</p>
              <ul className={styles.pendingList}>
                {pendingInvites.map((inv) => (
                  <li key={inv.id} className={styles.pendingItem}>
                    <span className={styles.pendingUsername}>@{inv.invited_username}</span>
                    <button
                      type="button"
                      className={styles.btnCancelInvite}
                      onClick={() => handleCancelInvite(inv.id)}
                      disabled={cancellingId === inv.id}
                    >
                      {cancellingId === inv.id ? "…" : "Cancelar convite"}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  );
}
