import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { PageLayout, Heading, Avatar, Text, Button } from "@primer/react";
import { DownloadIcon, GearIcon } from "@primer/octicons-react";
import Image from "next/image";

import { useUser } from "@/context/UserContext";
import FollowButton from "@/components/FollowButton";
import PostCardComponent from "@/components/PostCard/PostCardComponent";

import ListableSectionPanel from "@/components/Panels/ListableSectionPanel/ListableSectionPanel";
import HistoricoItem from "@/components/Portfolio/Historico/HistoricoItem";
import SectionPanel from "@/components/Panels/SectionPanel/SectionPanel";
import style from "./perfil.module.css";
import FormacaoItem from "@/components/Portfolio/Formacao/FormacaoItem";
import ContatoItem from "@/components/Portfolio/Contatos/ContatoItem";
import FerramentaItem from "@/components/Portfolio/Ferramentas/FerramentaItem";
import RoleItem from "@/components/Portfolio/Roles/RoleItem";
import StatusMessageComponent from "@/components/StatusMessage/StatusMessageComponent";
import ProfileImageUploader from "@/components/Portfolio/ProfileImageUploader";
import ProfileQrCode from "@/components/Portfolio/ProfileQrCode";

/* =====================
 * Utils
 * ===================== */

function formatDateBR(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(date));
}

// Tipos de notificação cujas mensagens não estão na tabela notification_messages
const CLIENT_NOTIF_DEFS = {
  studio_invitation: {
    title: "Convite de estúdio",
    message: "%userId te convidou para o estúdio %studio_name.",
  },
};

function notificationTitle(n) {
  return n.title || CLIENT_NOTIF_DEFS[n.type]?.title || n.type;
}

function notificationMessage(n) {
  const template = n.message || CLIENT_NOTIF_DEFS[n.type]?.message;
  if (!template) return null;
  return template
    .replace("%userId", n.source_username || "alguém")
    .replace("%postId", n.post_id ? String(n.post_id).slice(0, 8) : "um post")
    .replace("%orgSlug", n.org_slug || "estúdio")
    .replace("%studio_name", n.studio_name || n.org_slug || "estúdio");
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

  const [activeTab, setActiveTab] = useState("info");
  const [posts, setPosts] = useState(null);
  const loadingPosts = posts === null;

  const [errorMessage, setErrorMessage] = useState(null);

  // Notificações (apenas para o próprio perfil)
  const [userNotifs, setUserNotifs] = useState(null);
  const [postNotifs, setPostNotifs] = useState(null);
  const loadingNotifs = userNotifs === null || postNotifs === null;

  async function fetchJSON(url, options = {}) {
    const res = await fetch(url, {
      credentials: "include",
      ...options,
    });

    const data = await res.json();

    if (!res.ok) {
      setErrorMessage(data);
    } else {
      setErrorMessage(null);
      return data;
    }
  }

  /* =====================
   * Load profile
   * ===================== */

  const reloadProfile = useCallback(async () => {
    if (!username) return;

    const data = await fetchJSON(`/api/v1/users/${username}/profile`);
    setPerfilUser(data);
  }, [username]);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    (async () => {
      setLoadingProfile(true);
      try {
        const data = await fetchJSON(`/api/v1/users/${username}/profile`);
        if (!cancelled) setPerfilUser(data);
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    if (!username || activeTab !== "posts") return;
    let cancelled = false;
    fetch(`/api/v1/users/${username}/posts`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (!cancelled) setPosts(data ?? []);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [username, activeTab]);

  useEffect(() => {
    const isOwn = authUser?.username === perfilUser?.user?.username;
    if (!isOwn || !username || activeTab !== "notifications") return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/v1/users/${username}/notifications`, {
        credentials: "include",
      }),
      fetch(`/api/v1/users/${username}/notifications/post`, {
        credentials: "include",
      }),
    ]).then(async ([userRes, postRes]) => {
      if (!cancelled) {
        setUserNotifs(userRes.ok ? await userRes.json() : []);
        setPostNotifs(postRes.ok ? await postRes.json() : []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authUser, perfilUser, username, activeTab]);

  if (loadingUser || loadingProfile) {
    return (
      <div className={style.stateCard} role="status" aria-live="polite">
        <p className={style.stateTitle}>Carregando perfil...</p>
      </div>
    );
  }

  if (!perfilUser) {
    return (
      <div className={style.stateCard}>
        <p className={style.stateTitle}>Perfil não encontrado</p>
        <p className={style.stateDescription}>Esse usuário não existe ou foi removido.</p>
      </div>
    );
  }

  const isOwnProfile = authUser?.username === perfilUser?.user?.username;

  /* =====================
   * Render
   * ===================== */

  function handlePrint() {
    globalThis.open(`/perfil/${username}/curriculo`, "_blank");
  }

  function handleDeletePost(postId) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    fetch(`/api/v1/posts/${postId}`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => {});
  }

  return (
    <PageLayout padding="none">
      <PageLayout.Content width="medium">
        {/* Header */}
        <section className={`${style.profileCard} ${style.profileHeaderCard}`}>
          <StatusMessageComponent errorMsg={errorMessage} />

          <div className={style.imageWrapper}>
            <Image
              src={perfilUser.user.background_image || "/images/default_header.png"}
              alt="Capa do perfil"
              fill
              unoptimized
              className={style.coverImage}
            />
            {isOwnProfile && (
              <div className={style.coverUploader}>
                <ProfileImageUploader endpoint={`/api/v1/users/${username}/avatar`} onUploaded={reloadProfile} label="Alterar capa" type="cover" />
              </div>
            )}
          </div>
          <div className={style.avatarContainer}>
            <Avatar size={128} src={perfilUser.user.avatar_image || "/images/avatar.png"} className={style.profileAvatar} />
            {isOwnProfile && (
              <div className={style.avatarUploader}>
                <ProfileImageUploader
                  endpoint={`/api/v1/users/${username}/avatar`}
                  onUploaded={reloadProfile}
                  label="Alterar avatar"
                  type="avatar"
                  withCrop
                />
              </div>
            )}
          </div>

          <div className={style.profileHeaderRow}>
            <div className={style.profileHeaderInfo}>
              <Heading as="h2">{perfilUser.name || perfilUser.user.username}</Heading>

              <Text size="medium">Desde: {formatDateBR(perfilUser.user.created_at)}</Text>

              <Text size="medium" className={style.profileStats}>
                <strong>{perfilUser.user.following_count ?? 0}</strong> acompanhando · <strong>{perfilUser.user.followers_count ?? 0}</strong>{" "}
                seguidores · <strong>{perfilUser.user.posts_count ?? 0}</strong> postagens
              </Text>

              {!isOwnProfile && authUser && (
                <div className={style.profileHeaderActions}>
                  <FollowButton username={username} isFollowing={perfilUser.user.is_following ?? false} />
                  <Button>Enviar mensagem</Button>
                </div>
              )}

              <div className={style.profilePrintActions}>
                <button type="button" className={style.printBtn} onClick={handlePrint}>
                  <DownloadIcon size={14} />
                  Exportar PDF
                </button>
                {isOwnProfile && (
                  <Link href={`/perfil/${username}/configuracoes`} className={style.printBtn}>
                    <GearIcon size={14} />
                    Configurações
                  </Link>
                )}
              </div>
            </div>

            <div className={style.profileQrWrapper}>
              <ProfileQrCode username={username} isOwnProfile={isOwnProfile} />
            </div>
          </div>

          {/* ===== TABS ===== */}
          <div className={style.profileTabs} role="tablist" aria-label="Seções do perfil">
            <button type="button" role="tab" aria-selected={activeTab === "info"} className={style.profileTab} onClick={() => setActiveTab("info")}>
              Informações
            </button>
            <button type="button" role="tab" aria-selected={activeTab === "posts"} className={style.profileTab} onClick={() => setActiveTab("posts")}>
              Postagens
            </button>
            {isOwnProfile && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "notifications"}
                className={style.profileTab}
                onClick={() => setActiveTab("notifications")}
              >
                Notificações
              </button>
            )}
          </div>

          {/* ===== RESUME ===== */}
          {activeTab === "info" && (
            <section className={style.profileResume}>
              {/* COLUNA PRINCIPAL */}
              <div className={style.resumeMain}>
                {/* Descrição */}
                <SectionPanel
                  title="Descrição"
                  atributes={[
                    {
                      title: "Visibilidade",
                      content: perfilUser.user.visibility,
                      alignment: "row",
                    },
                    {
                      title: "Resumo",
                      content: perfilUser.user.resumo || "Resumo ainda não informado.",
                    },
                    {
                      title: "Bio",
                      content: perfilUser.user.bio || "Bio ainda não informada.",
                    },
                  ]}
                />

                {/* Histórico Profissional */}
                <ListableSectionPanel
                  title="Histórico Profissional"
                  items={perfilUser.historico}
                  renderItem={(item) => <HistoricoItem item={item} />}
                />

                {/* Formação Acadêmica */}
                <ListableSectionPanel
                  title="Formação Acadêmica"
                  items={perfilUser.formacoes}
                  emptyText="Nenhuma formação cadastrada."
                  renderItem={(item) => <FormacaoItem item={item} />}
                />
              </div>

              {/* COLUNA LATERAL */}
              <aside className={style.resumeSidebar}>
                {/* Contato */}
                <ListableSectionPanel
                  title="Contatos"
                  items={perfilUser.contacts}
                  emptyText="Nenhum contato cadastrado."
                  renderItem={(item) => <ContatoItem item={item} />}
                  variant="small"
                />

                {/* Especializações */}
                <ListableSectionPanel
                  title="Especializações"
                  items={perfilUser.roles}
                  emptyText="Nenhuma especialização cadastrada."
                  renderItem={(item) => <RoleItem item={item} />}
                  variant="small"
                />

                {/* Ferramentas */}
                <ListableSectionPanel
                  title="Ferramentas"
                  items={perfilUser.tools}
                  emptyText="Nenhuma ferramenta cadastrada."
                  renderItem={(item) => <FerramentaItem item={item} />}
                  variant="small"
                />
              </aside>
            </section>
          )}

          {/* ===== POSTS ===== */}
          {activeTab === "posts" && (
            <div className={style.postsFeed}>
              {loadingPosts && <p className={style.postsState}>Carregando postagens...</p>}
              {!loadingPosts && posts.length === 0 && <p className={style.postsState}>Nenhuma postagem ainda.</p>}
              {!loadingPosts &&
                posts.map((p) => (
                  <PostCardComponent key={p.id} post={p} canInteract={!!authUser} onDelete={isOwnProfile ? handleDeletePost : undefined} />
                ))}
            </div>
          )}

          {/* ===== NOTIFICAÇÕES ===== */}
          {activeTab === "notifications" && isOwnProfile && (
            <div className={style.notifSection}>
              {loadingNotifs && <p className={style.postsState}>Carregando notificações...</p>}
              {!loadingNotifs && <NotificationList userNotifs={userNotifs} postNotifs={postNotifs} />}
            </div>
          )}
        </section>
      </PageLayout.Content>
    </PageLayout>
  );
}

/* =====================
 * NotificationList
 * ===================== */

function NotificationList({ userNotifs, postNotifs }) {
  const router = useRouter();
  const all = [...userNotifs, ...postNotifs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (all.length === 0) {
    return <p className={style.postsState}>Nenhuma notificação.</p>;
  }

  function handleClick(n) {
    if (n.type === "post_liked" || n.type === "post_commented") {
      router.push(`/posts/${n.post_id}`);
    } else if (n.type === "studio_invitation" && n.org_slug) {
      router.push(`/estudios/${n.org_slug}`);
    }
  }

  return (
    <div className={style.notifList}>
      {all.map((n) => {
        const nid = `${n.user_id}_${n.type}_${n.source_user_id}${n.post_id != null ? `_${n.post_id}` : ""}`;
        const isClickable = n.type === "post_liked" || n.type === "post_commented" || (n.type === "studio_invitation" && n.org_slug);
        return (
          <div
            key={nid}
            className={`${style.notifItem} ${!n.is_read ? style.notifUnread : ""} ${isClickable ? style.notifClickable : ""}`}
            onClick={isClickable ? () => handleClick(n) : undefined}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={
              isClickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") handleClick(n);
                  }
                : undefined
            }
          >
            <div className={style.notifHeader}>
              <span className={style.notifTitle}>{notificationTitle(n)}</span>
              <span className={style.notifDate}>
                {new Intl.DateTimeFormat("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                }).format(new Date(n.created_at))}
              </span>
            </div>
            {notificationMessage(n) && <p className={style.notifMessage}>{notificationMessage(n)}</p>}
            {!n.is_read && <span className={style.notifUnreadDot} />}
          </div>
        );
      })}
    </div>
  );
}
