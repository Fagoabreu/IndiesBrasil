import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { PageLayout, Heading, Avatar, Text, Button } from "@primer/react";
import Image from "next/image";

import { useUser } from "@/context/UserContext";
import EditResumoModal from "@/components/Portfolio/EditResumoModal";
import EditHistoricoModal from "@/components/Portfolio/Historico/EditHistoricoModal";
import DeleteConfirm from "@/components/Portfolio/DeleteConfirm";

import ListableSectionPanel from "@/components/Panels/ListableSectionPanel/ListableSectionPanel";
import HistoricoItem from "@/components/Portfolio/Historico/HistoricoItem";
import SectionPanel from "@/components/Panels/SectionPanel/SectionPanel";
import style from "./perfil.module.css";
import FormacaoItem from "@/components/Portfolio/Formacao/FormacaoItem";
import EditFormacaoModal from "@/components/Portfolio/Formacao/EditFormacaoModal";
import ContatoItem from "@/components/Portfolio/Contatos/ContatoItem";
import EditContatoModal from "@/components/Portfolio/Contatos/EditContatoModal";

/* =====================
 * Utils
 * ===================== */

function formatDateBR(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(date));
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "Erro de API");
  }

  return data;
}

/* =====================
 * Página
 * ===================== */

export default function Perfil() {
  const router = useRouter();
  const { username } = router.query;

  const { user: authUser, loadingUser } = useUser();

  const [perfilUser, setPerfilUser] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [resumoModalOpen, setResumoModalOpen] = useState(false);

  const [historicoModal, setHistoricoModal] = useState({
    open: false,
    editing: null,
  });

  const [formacaoModal, setFormacaoModal] = useState({
    open: false,
    editing: null,
  });

  const [contatoModal, setContatoModal] = useState({
    open: false,
    editing: null,
  });

  const [deleteModal, setDeleteModal] = useState({
    item: null,
    itemName: "",
    loading: false,
    type: null,
  });

  /* =====================
   * Load profile
   * ===================== */

  async function reloadProfile() {
    if (!username) return;

    const data = await fetchJSON(`/api/v1/users/${username}/profile`);
    setPerfilUser(data);
  }

  useEffect(() => {
    if (!username) return;

    (async () => {
      setLoadingProfile(true);
      try {
        await reloadProfile();
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [username]);

  if (loadingUser || loadingProfile) {
    return <div>Carregando...</div>;
  }

  if (!perfilUser) {
    return <div>Perfil não encontrado.</div>;
  }

  const isOwnProfile = authUser?.username === perfilUser.user.username;

  /* =====================
   * API actions
   * ===================== */

  async function saveResumo(payload) {
    const data = await fetchJSON(`/api/v1/users/${username}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    await reloadProfile();
  }

  async function persistHistoricoOrder(list) {
    await fetchJSON(`/api/v1/users/${username}/historico/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        historicos: list.map(({ id, ordem }) => ({
          id,
          ordem,
        })),
      }),
    });

    await reloadProfile();
  }

  async function confirmDelete() {
    if (!deleteModal.item || !deleteModal.type) return;

    switch (deleteModal.type) {
      case "historico":
        await deleteHistorico();
        break;

      case "formacao":
        await deleteFormacao();
        break;

      case "contato":
        await deleteContato();
        break;

      default:
        break;
    }

    await reloadProfile();
  }

  async function moveHistorico(from, to) {
    const sorted = [...perfilUser.historico].sort((a, b) => a.ordem - b.ordem);

    if (to < 0 || to >= sorted.length) return;

    const updated = [...sorted];
    const [item] = updated.splice(from, 1);
    updated.splice(to, 0, item);

    await persistHistoricoOrder(
      updated.map((h, index) => ({
        ...h,
        ordem: index,
      })),
    );
  }

  async function saveHistorico(payload) {
    const isEditing = Boolean(historicoModal.editing);

    const ordem = isEditing ? historicoModal.editing.ordem : perfilUser.historico.length;

    await fetchJSON(`/api/v1/users/${username}/historico${isEditing ? `/${historicoModal.editing.id}` : ""}`, {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        ordem,
      }),
    });

    setHistoricoModal({ open: false, editing: null });
    await reloadProfile();
  }

  async function deleteHistorico() {
    const item = deleteModal.item;
    if (!item) return;

    setDeleteModal((s) => ({ ...s, loading: true }));

    await fetchJSON(`/api/v1/users/${username}/historico/${item.id}`, { method: "DELETE" });

    const remaining = perfilUser.historico
      .filter((h) => h.id !== item.id)
      .map((h, index) => ({
        ...h,
        ordem: index,
      }));

    await persistHistoricoOrder(remaining);

    setDeleteModal({ item: null, loading: false });
  }

  async function saveFormacao(payload) {
    const isEditing = Boolean(formacaoModal.editing);
    const ordem = isEditing ? formacaoModal.editing.ordem : perfilUser.formacoes.length;

    const updated = await fetchJSON(`/api/v1/users/${username}/formacoes${isEditing ? `/${formacaoModal.editing.id}` : ""}`, {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, ordem }),
    });

    setFormacaoModal({ open: false, editing: null });
    await reloadProfile();
  }

  async function moveFormacao(from, to) {
    const sorted = [...perfilUser.formacoes].sort((a, b) => a.ordem - b.ordem);
    if (to < 0 || to >= sorted.length) return;

    const updated = [...sorted];
    const [item] = updated.splice(from, 1);
    updated.splice(to, 0, item);

    const reordered = updated.map((f, index) => ({
      ...f,
      ordem: index,
    }));

    await fetchJSON(`/api/v1/users/${username}/formacoes/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formacoes: reordered.map(({ id, ordem }) => ({ id, ordem })),
      }),
    });
    await reloadProfile();
  }

  async function deleteFormacao() {
    const item = deleteModal.item;
    if (!item) return;

    setDeleteModal((s) => ({ ...s, loading: true }));

    await fetchJSON(`/api/v1/users/${username}/formacoes/${item.id}`, { method: "DELETE" });

    setDeleteModal({ item: null, loading: false });
  }

  async function saveContato(payload) {
    const isEditing = Boolean(contatoModal.editing);
    const ordem = isEditing ? contatoModal.editing.ordem : perfilUser.contacts.length;
    console.log("Saving contato:", { payload, isEditing, ordem });
    const updated = await fetchJSON(`/api/v1/users/${username}/contacts${isEditing ? `/${contatoModal.editing.id}` : ""}`, {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, ordem }),
    });

    setContatoModal({ open: false, editing: null });
    await reloadProfile();
  }

  async function moveContato(from, to) {
    const sorted = [...perfilUser.contacts].sort((a, b) => a.ordem - b.ordem);
    if (to < 0 || to >= sorted.length) return;

    const updated = [...sorted];
    const [item] = updated.splice(from, 1);
    updated.splice(to, 0, item);

    const reordered = updated.map((c, index) => ({
      ...c,
      ordem: index,
    }));

    await fetchJSON(`/api/v1/users/${username}/contacts/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contacts: reordered.map(({ id, ordem }) => ({ id, ordem })),
      }),
    });
    await reloadProfile();
  }

  async function deleteContato() {
    const item = deleteModal.item;
    if (!item) return;

    setDeleteModal((s) => ({ ...s, loading: true }));

    await fetchJSON(`/api/v1/users/${username}/contacts/${item.id}`, { method: "DELETE" });

    setDeleteModal({ item: null, loading: false });
  }

  /* =====================
   * Render
   * ===================== */

  return (
    <PageLayout padding="none">
      <PageLayout.Content width="medium">
        {/* Header */}
        <section className={`${style.profileCard} ${style.profileHeaderCard}`}>
          <div className={style.imageWrapper}>
            <Image src="/images/sistematags.png" alt="Capa do perfil" fill unoptimized />
          </div>

          <Avatar size={128} src={perfilUser.user.avatar_image || "/images/avatar.png"} className={style.profileAvatar} />

          <div className={style.profileHeaderInfo}>
            <Heading as="h2">{perfilUser.name || perfilUser.user.username}</Heading>

            <Text size="medium">Desde: {formatDateBR(perfilUser.user.created_at)}</Text>

            <Text size="medium">
              <strong>{perfilUser.user.following_count ?? 0}</strong> acompanhando · <strong>{perfilUser.followers_count ?? 0}</strong> seguidores ·{" "}
              <strong>{perfilUser.user.posts_count ?? 0}</strong> postagens
            </Text>

            {!isOwnProfile && authUser && (
              <div>
                <Button variant="primary">Seguir</Button>
                <Button>Enviar mensagem</Button>
              </div>
            )}
          </div>

          {/* ===== RESUME ===== */}
          <section className={style.profileResume}>
            {/* COLUNA PRINCIPAL */}
            <div className={style.resumeMain}>
              {/* Descrição */}
              <SectionPanel
                title="Descrição"
                canEdit={isOwnProfile}
                OnEdit={() => setResumoModalOpen(true)}
                atributes={[
                  { title: "Visibilidade", content: perfilUser.user.visibility, alignment: "row" },
                  { title: "Resumo", content: perfilUser.user.resumo || "Resumo ainda não informado." },
                  { title: "Bio", content: perfilUser.user.bio || "Bio ainda não informada." },
                ]}
              />

              {/* Histórico Profissional */}
              <ListableSectionPanel
                title="Histórico Profissional"
                items={perfilUser.historico}
                canEdit={isOwnProfile}
                OnAdd={() =>
                  setHistoricoModal({
                    open: true,
                    editing: null,
                  })
                }
                OnMove={moveHistorico}
                OnEdit={(item) =>
                  setHistoricoModal({
                    open: true,
                    editing: item,
                  })
                }
                OnDelete={(item) =>
                  setDeleteModal({
                    item,
                    itemName: item.cargo,
                    loading: false,
                    type: "historico",
                  })
                }
                renderItem={(item) => <HistoricoItem item={item} />}
              />

              {/* Formação Acadêmica */}
              <ListableSectionPanel
                title="Formação Acadêmica"
                items={perfilUser.formacoes}
                canEdit={isOwnProfile}
                emptyText="Nenhuma formação cadastrada."
                OnAdd={() => setFormacaoModal({ open: true, editing: null })}
                OnEdit={(item) => setFormacaoModal({ open: true, editing: item })}
                OnMove={moveFormacao}
                OnDelete={(item) =>
                  setDeleteModal({
                    item,
                    itemName: item.curso,
                    loading: false,
                    type: "formacao",
                  })
                }
                renderItem={(item) => <FormacaoItem item={item} />}
              />
            </div>

            {/* COLUNA LATERAL */}
            <aside className={style.resumeSidebar}>
              {/* Contato */}
              <ListableSectionPanel
                title="Contatos"
                items={perfilUser.contacts}
                canEdit={isOwnProfile}
                emptyText="Nenhum contato cadastrado."
                OnAdd={() => setContatoModal({ open: true, editing: null })}
                OnEdit={(item) => setContatoModal({ open: true, editing: item })}
                OnMove={moveContato}
                OnDelete={(item) => setDeleteModal({ item, itemName: item.nome, loading: false, type: "contato" })}
                renderItem={(item) => <ContatoItem item={item} />}
                variant="small"
              />

              {/* Especializações */}
              <section className="resume-section">
                <Heading as="h4" variant="medium">
                  Especializações
                </Heading>
                <ul className="resume-list">
                  {perfilUser.roles.map((r) => (
                    <li key={r.id}>
                      <Text size="medium">
                        {r.name} · {r.experience}
                      </Text>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Ferramentas */}
              <section className="resume-section">
                <Heading as="h4" variant="medium">
                  Ferramentas
                </Heading>
                <ul className="resume-list">
                  {perfilUser.tools.map((t) => (
                    <li key={t.id}>
                      <Text size="medium">
                        {t.name} · {t.experience}
                      </Text>
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </section>
        </section>

        {/* Modais */}
        {resumoModalOpen && (
          <EditResumoModal
            onClose={() => setResumoModalOpen(false)}
            initResume={perfilUser.user.resumo}
            initBio={perfilUser.user.bio}
            initVisibility={perfilUser.user.visibility}
            onSave={saveResumo}
          />
        )}

        {historicoModal.open && (
          <EditHistoricoModal
            initialData={historicoModal.editing}
            onClose={() =>
              setHistoricoModal({
                open: false,
                editing: null,
              })
            }
            onSave={saveHistorico}
          />
        )}

        {formacaoModal.open && (
          <EditFormacaoModal
            initialData={formacaoModal.editing}
            onClose={() => setFormacaoModal({ open: false, editing: null })}
            onSave={saveFormacao}
          />
        )}

        {contatoModal.open && (
          <EditContatoModal initialData={contatoModal.editing} onClose={() => setContatoModal({ open: false, editing: null })} onSave={saveContato} />
        )}

        {deleteModal.item && (
          <DeleteConfirm
            itemName={deleteModal.itemName}
            loading={deleteModal.loading}
            onCancel={() => setDeleteModal({ item: null, loading: false })}
            onConfirm={() => confirmDelete()}
          />
        )}
      </PageLayout.Content>
    </PageLayout>
  );
}
