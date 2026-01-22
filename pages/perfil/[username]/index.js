import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { PageLayout, Heading, Avatar, Text, Button } from "@primer/react";
import Image from "next/image";
import { PencilIcon, DiffAddedIcon, ChevronUpIcon, ChevronDownIcon, TrashIcon } from "@primer/octicons-react";

import { useUser } from "@/context/UserContext";
import EditResumoModal from "@/components/Portfolio/EditResumoModal";
import EditHistoricoModal from "@/components/Portfolio/EditHistoricoModal";
import DeleteHistoricoConfirm from "@/components/Portfolio/DeleteHistoricoConfirm";

import "./perfil.css";

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

  const [deleteModal, setDeleteModal] = useState({
    item: null,
    loading: false,
  });

  /* =====================
   * Load profile
   * ===================== */

  useEffect(() => {
    if (!username) return;

    async function loadProfile() {
      try {
        setLoadingProfile(true);
        const data = await fetchJSON(`/api/v1/users/${username}/profile`);
        setPerfilUser(data);
      } catch (err) {
        console.error("Erro ao carregar perfil:", err);
      } finally {
        setLoadingProfile(false);
      }
    }

    loadProfile();
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

    setPerfilUser((prev) => ({
      ...prev,
      user: {
        ...prev.user,
        ...data.user,
      },
    }));
  }

  async function persistHistoricoOrder(list) {
    setPerfilUser((prev) => ({
      ...prev,
      historico: list,
    }));

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

    const updated = await fetchJSON(`/api/v1/users/${username}/historico${isEditing ? `/${historicoModal.editing.id}` : ""}`, {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        ordem,
      }),
    });

    setPerfilUser((prev) => ({
      ...prev,
      historico: updated,
    }));

    setHistoricoModal({ open: false, editing: null });
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

  /* =====================
   * Render
   * ===================== */

  return (
    <PageLayout padding="none">
      <PageLayout.Content width="medium">
        {/* Header */}
        <section className="profile-card profile-header-card">
          <div className="image-wrapper">
            <Image src="/images/sistematags.png" alt="Capa do perfil" fill unoptimized />
          </div>

          <Avatar size={128} src={perfilUser.user.avatar_image || "/images/avatar.png"} className="profile-avatar" />

          <div className="profile-header-info">
            <Heading as="h2">{perfilUser.name || perfilUser.user.username}</Heading>

            <Text size="medium" className="profile-headline">
              Desde: {formatDateBR(perfilUser.user.created_at)}
            </Text>

            <Text size="medium" className="profile-meta">
              <strong>{perfilUser.user.following_count ?? 0}</strong> acompanhando · <strong>{perfilUser.followers_count ?? 0}</strong> seguidores ·{" "}
              <strong>{perfilUser.user.posts_count ?? 0}</strong> postagens
            </Text>

            {!isOwnProfile && authUser && (
              <div className="profile-actions">
                <Button variant="primary">Seguir</Button>
                <Button>Enviar mensagem</Button>
              </div>
            )}
          </div>

          {/* ===== RESUME ===== */}
          <section className="profile-resume">
            {/* COLUNA PRINCIPAL */}
            <div className="resume-main">
              {/* Descrição */}
              <section className="resume-section">
                <div className="resume-header">
                  <Heading as="h2" variant="medium">
                    Descrição
                  </Heading>

                  {isOwnProfile && (
                    <Button size="small" variant="primary" onClick={() => setResumoModalOpen(true)}>
                      <PencilIcon /> Editar
                    </Button>
                  )}
                </div>

                <div className="resume-item row">
                  <Heading as="h3" variant="small">
                    Visibilidade
                  </Heading>
                  <Text size="medium">{perfilUser.user.visibility}</Text>
                </div>

                <div className="resume-item">
                  <Heading as="h3" variant="small">
                    Resumo
                  </Heading>
                  <Text size="medium">{perfilUser.user.resumo || "Resumo ainda não informado."}</Text>
                </div>

                <div className="resume-item">
                  <Heading as="h3" variant="small">
                    Bio
                  </Heading>
                  <Text size="medium">{perfilUser.user.bio || "Bio ainda não informada."}</Text>
                </div>
              </section>

              {/* Histórico Profissional */}
              <section className="resume-section">
                <div className="resume-header">
                  <Heading as="h3" variant="medium">
                    Histórico Profissional
                  </Heading>

                  {isOwnProfile && (
                    <Button
                      size="small"
                      variant="primary"
                      onClick={() =>
                        setHistoricoModal({
                          open: true,
                          editing: null,
                        })
                      }
                    >
                      <DiffAddedIcon /> experiência
                    </Button>
                  )}
                </div>

                {perfilUser.historico.length === 0 && (
                  <Text size="medium" className="profile-muted">
                    Nenhuma experiência cadastrada.
                  </Text>
                )}

                <ul className="resume-list">
                  {[...perfilUser.historico]
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((item, index, array) => (
                      <li key={item.id} className="resume-item">
                        <div className="resume-header">
                          <strong>{item.cargo}</strong>

                          {isOwnProfile && (
                            <div className="resume-actions">
                              <Button size="small" variant="invisible" disabled={index === 0} onClick={() => moveHistorico(index, index - 1)}>
                                <ChevronUpIcon />
                              </Button>

                              <Button
                                size="small"
                                variant="invisible"
                                disabled={index === array.length - 1}
                                onClick={() => moveHistorico(index, index + 1)}
                              >
                                <ChevronDownIcon />
                              </Button>

                              <Button
                                size="small"
                                variant="invisible"
                                onClick={() =>
                                  setHistoricoModal({
                                    open: true,
                                    editing: item,
                                  })
                                }
                              >
                                Editar
                              </Button>

                              <Button
                                size="small"
                                variant="danger"
                                onClick={() =>
                                  setDeleteModal({
                                    item,
                                    loading: false,
                                  })
                                }
                              >
                                <TrashIcon />
                              </Button>
                            </div>
                          )}
                        </div>

                        <Text size="medium" className="resume-sub">
                          {item.company}
                          {item.cidade && ` · ${item.cidade}`}
                          {item.estado && ` · ${item.estado}`}
                        </Text>

                        <Text size="small" className="resume-date">
                          {formatDateBR(item.init_date)} — {item.end_date ? formatDateBR(item.end_date) : "Atual"}
                        </Text>

                        {Array.isArray(item.atribuicoes) && (
                          <ul className="resume-attributes">
                            {item.atribuicoes.map((a, i) => (
                              <li key={i}>
                                <Text size="medium">{a}</Text>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                </ul>
              </section>

              {/* Formação Acadêmica */}
              <section className="resume-section">
                <Heading as="h3" variant="medium">
                  Formação Acadêmica
                </Heading>

                {(perfilUser.formacoes || []).length === 0 && (
                  <Text size="medium" className="profile-muted">
                    Nenhuma formação cadastrada.
                  </Text>
                )}

                {perfilUser.formacoes?.map((f) => (
                  <div key={f.id} className="resume-item">
                    <strong>{f.nome}</strong>
                    <Text size="medium" className="resume-sub">
                      {f.instituicao}
                    </Text>
                    <Text size="small" className="resume-date">
                      {f.inicio} — {f.fim}
                    </Text>
                  </div>
                ))}
              </section>
            </div>

            {/* COLUNA LATERAL */}
            <aside className="resume-sidebar">
              {/* Contato */}
              <section className="resume-section">
                <Heading as="h4" variant="medium">
                  Contato
                </Heading>
                <ul className="resume-list">
                  {perfilUser.contacts.map((c) => (
                    <li key={c.id}>
                      <Text size="medium">
                        {c.key} — {c.value}
                      </Text>
                    </li>
                  ))}
                </ul>
              </section>

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

        {deleteModal.item && (
          <DeleteHistoricoConfirm
            cargo={deleteModal.item.cargo}
            loading={deleteModal.loading}
            onCancel={() => setDeleteModal({ item: null, loading: false })}
            onConfirm={deleteHistorico}
          />
        )}
      </PageLayout.Content>
    </PageLayout>
  );
}
