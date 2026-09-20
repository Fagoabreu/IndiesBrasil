import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { PageLayout, Avatar } from "@primer/react";
import { CalendarIcon, DownloadIcon, EyeIcon, GearIcon, ShareIcon } from "@primer/octicons-react";
import Image from "next/image";
import PropTypes from "prop-types";

import { useUser } from "@/context/UserContext";
import DateUtils from "@/utils/DateUtils";
import SeoHead from "@/components/SeoHead";
import ShareModal from "@/components/ShareModal/ShareModal";
import FollowButton from "@/components/FollowButton";
import PostCardComponent from "@/components/PostCard/PostCardComponent";
import ReputationBadge from "@/components/ReputationBadge/ReputationBadge";
import ReputationPanel from "@/components/ReputationPanel/ReputationPanel";

import ListableSectionPanel from "@/components/Panels/ListableSectionPanel/ListableSectionPanel";
import SectionPanel from "@/components/Panels/SectionPanel/SectionPanel";
import style from "./perfil.module.css";
import TimelineItem from "@/components/Portfolio/TimelineItem/TimelineItem";
import SkillItem from "@/components/Portfolio/SkillItem/SkillItem";
import ContatoItem from "@/components/Portfolio/Contatos/ContatoItem";
import StudioItem from "@/components/Portfolio/Estudios/StudioItem";
import StatusMessageComponent from "@/components/StatusMessage/StatusMessageComponent";
import ImageUploader from "@/components/ImageTools/ImageUploader/ImageUploader";
import ProfileQrCode from "@/components/Portfolio/ProfileQrCode";
import { SITE_URL } from "@/lib/seo";

/* =====================
 * Metadados (OG) e SSR
 * ===================== */

export async function getServerSideProps(context) {
  const { username } = context.params;

  try {
    // Import dinâmico: mantém o banco fora do bundle do cliente.
    const profile = (await import("@/models/profile")).default;
    const authorization = (await import("@/models/authorization")).default;

    const reader = authorization.anonymousReader;
    const found = await profile.findByUsername(username, reader);
    // Mesma filtragem que a rota de API usa, para o HTML não conter campo que
    // a API esconderia.
    const secured = authorization.filterOutput(reader, "read:profile", found);

    return {
      // `findByUsername` devolve `Date` em alguns campos, e o Next não serializa
      // `Date` em props. A volta por JSON normaliza para string ISO — de
      // propósito, não é só um clone (por isso não usamos `structuredClone`,
      // que preservaria os `Date` e quebraria a serialização).
      props: { initialProfile: JSON.parse(JSON.stringify(secured)), profileNotFound: false },
    };
  } catch (error) {
    // Perfil inexistente: responde 404 para o buscador não indexar uma página
    // vazia. O status é ajustado aqui (em vez de `notFound: true`) porque assim
    // a própria página renderiza o estado "não encontrado" que já existe, em
    // vez de cair no 404 genérico do Next.
    const isMissing = error?.statusCode === 404;
    if (isMissing) context.res.statusCode = 404;

    return { props: { initialProfile: null, profileNotFound: isMissing } };
  }
}

/* =====================
 * Utils
 * ===================== */

/** Visibilidade do perfil em texto legível — o valor cru da API ("public") não
 *  diz nada ao visitante. Chaves conforme o enum `visibility_type`. */
const VISIBILITY_LABELS = {
  public: "público",
  followers: "visível para seguidores",
  private: "privado",
};

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

export default function Perfil({ initialProfile, profileNotFound = false }) {
  const router = useRouter();
  const { username } = router.query;

  const { user: authUser, loadingUser } = useUser();

  // Dados do SSR entram como estado inicial: a página já vem preenchida no HTML
  // (o que o crawler do WhatsApp lê) e o fetch abaixo só refina o que depende de
  // sessão (`is_following`, perfil privado visto pelo dono).
  const [perfilUser, setPerfilUser] = useState(initialProfile);
  const [loadingProfile, setLoadingProfile] = useState(!initialProfile && !profileNotFound);

  const [activeTab, setActiveTab] = useState("info");
  const [posts, setPosts] = useState(null);
  const loadingPosts = posts === null;

  const [errorMessage, setErrorMessage] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);

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

  /** Sobe o blob recortado e recarrega o perfil — a rota aceita avatar e capa
   *  pelo mesmo endpoint, distinguidos por `imgType`. */
  async function uploadProfileImage(blob, imgType) {
    const formData = new FormData();
    formData.append("file", blob);
    formData.append("imgType", imgType);

    const res = await fetch(`/api/v1/users/${username}/avatar`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!res.ok) {
      setErrorMessage(await res.json().catch(() => null));
      return;
    }

    await reloadProfile();
  }

  useEffect(() => {
    // 404 já resolvido no servidor: não há o que refinar.
    if (!username || profileNotFound) return;
    let cancelled = false;
    (async () => {
      // Com dados do SSR o conteúdo já está na tela: este fetch só refina o que
      // depende de sessão, então não faz sentido piscar o skeleton de novo.
      if (!initialProfile) setLoadingProfile(true);
      try {
        const data = await fetchJSON(`/api/v1/users/${username}/profile`);
        // Só sobrescreve em caso de sucesso — `fetchJSON` devolve undefined em
        // erro, e sem essa guarda uma falha de rede apagaria o conteúdo do SSR.
        if (!cancelled && data) setPerfilUser(data);
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username, initialProfile, profileNotFound]);

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

  // Só mostra o skeleton quando ainda não há perfil para exibir. Com dados do
  // SSR a página renderiza de imediato — se o gate fosse `loadingUser ||
  // loadingProfile`, o `loadingUser` (que só resolve no cliente) faria o HTML
  // servido ser o esqueleto, e o crawler não veria nada.
  if (!perfilUser && !profileNotFound && (loadingUser || loadingProfile)) {
    // Skeleton com a mesma geometria do conteúdo: antes era uma linha de texto
    // centralizada e o layout "pulava" quando o perfil carregava.
    return (
      <PageLayout padding="none">
        <PageLayout.Content width="medium">
          <div className={style.page} role="status" aria-live="polite" aria-label="Carregando perfil">
            <div className={style.headerCard}>
              <div className={`${style.cover} ${style.skeleton}`} />
              <div className={style.headerBody}>
                <div className={style.avatarRow}>
                  <div className={`${style.avatarRing} ${style.skeleton}`} />
                </div>
                <div className={style.identity}>
                  <div className={style.skeleton} style={{ width: 200, height: 26, marginTop: 12 }} />
                  <div className={style.skeleton} style={{ width: 120, height: 16 }} />
                  <div className={style.skeleton} style={{ width: 260, height: 38, marginTop: 14 }} />
                </div>
              </div>
            </div>

            <div className={style.content}>
              <div className={style.mainCol}>
                <div className={style.skeleton} style={{ height: 180 }} />
                <div className={style.skeleton} style={{ height: 140 }} />
              </div>
              <div className={style.sideCol}>
                <div className={style.skeleton} style={{ height: 200 }} />
              </div>
            </div>
          </div>
        </PageLayout.Content>
      </PageLayout>
    );
  }

  if (!perfilUser) {
    return (
      <div className={style.stateCard}>
        <SeoHead
          title="Perfil não encontrado — Indies Brasil"
          description="Esse usuário não existe ou foi removido."
          canonical={`${SITE_URL}/perfil/${encodeURIComponent(username ?? "")}`}
          noIndex
        />
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

  const followingCount = perfilUser.user.following_count ?? 0;
  const followersCount = perfilUser.user.followers_count ?? 0;
  const postsCount = perfilUser.user.posts_count ?? 0;
  const visibilityLabel = VISIBILITY_LABELS[perfilUser.user.visibility] ?? perfilUser.user.visibility;
  const hasAbout = Boolean(perfilUser.user.resumo || perfilUser.user.bio);

  /* =====================
   * Metadados do link compartilhado
   *
   * A página não tinha `SeoHead` nenhum, então o HTML entregue ao crawler do
   * WhatsApp saía sem `og:title`/`og:image` — o preview caía no default do site
   * ("Indies Brasil" + domínio). Agora os dados vêm do SSR (`initialProfile`),
   * porque o crawler não executa JavaScript.
   * ===================== */
  const profilePath = `/perfil/${encodeURIComponent(perfilUser.user.username)}`;
  const seoTitle = `${perfilUser.user.username} — Indies Brasil`;
  const seoDescription =
    perfilUser.user.resumo ||
    perfilUser.user.bio?.slice(0, 160) ||
    `Perfil de @${perfilUser.user.username} na comunidade de jogos independentes brasileiros.`;

  return (
    <PageLayout padding="none">
      <PageLayout.Content width="medium">
        <div className={style.page}>
          <SeoHead
            title={seoTitle}
            description={seoDescription}
            canonical={`${SITE_URL}${profilePath}`}
            ogImage={`${SITE_URL}/api/og/profile/${encodeURIComponent(perfilUser.user.username)}`}
            ogType="profile"
            noIndex={perfilUser.user.visibility === "private"}
          />

          <StatusMessageComponent errorMsg={errorMessage} />

          {/* ===== CABEÇALHO ===== */}
          <section className={style.headerCard}>
            <div className={style.cover}>
              <Image
                src={perfilUser.user.background_image || "/images/default_header.png"}
                alt=""
                fill
                unoptimized
                priority
                sizes="(max-width: 860px) 100vw, 768px"
                className={style.coverImage}
              />
              {isOwnProfile && (
                <div className={style.coverActions}>
                  <ImageUploader
                    preset="profileBanner"
                    variant="button"
                    label="Alterar capa"
                    onCropped={({ blob }) => uploadProfileImage(blob, "background_image")}
                  />
                </div>
              )}
            </div>

            <div className={style.headerBody}>
              {/* Avatar à esquerda sobe sobre a capa; ações à direita, no
                  espaço que sobra. */}
              <div className={style.avatarRow}>
                <div className={style.avatarRing}>
                  <Avatar size={112} src={perfilUser.user.avatar_image || "/images/avatar.png"} className={style.avatar} />
                  {isOwnProfile && (
                    <span className={style.avatarEdit}>
                      <ImageUploader preset="avatar" label="Alterar avatar" onCropped={({ blob }) => uploadProfileImage(blob, "avatar_image")} />
                    </span>
                  )}
                </div>

                <div className={style.headerActions}>
                  {!isOwnProfile && authUser && <FollowButton username={username} isFollowing={perfilUser.user.is_following ?? false} />}
                  {isOwnProfile && (
                    <Link href={`/perfil/${username}/configuracoes`} className={style.actionBtn}>
                      <GearIcon size={14} /> Editar perfil
                    </Link>
                  )}
                  <button type="button" className={style.actionBtn} onClick={handlePrint}>
                    <DownloadIcon size={14} /> Exportar PDF
                  </button>
                </div>
              </div>

              <div className={style.identity}>
                <h1 className={style.name}>{perfilUser.name || perfilUser.user.username}</h1>
                <p className={style.handle}>@{perfilUser.user.username}</p>

                <p className={style.metaRow}>
                  <span className={style.metaItem}>
                    <CalendarIcon size={14} /> Desde {DateUtils.formatMonthYear(perfilUser.user.created_at)}
                  </span>
                  {isOwnProfile && visibilityLabel && (
                    <span className={style.metaItem}>
                      <EyeIcon size={14} /> Perfil {visibilityLabel}
                    </span>
                  )}
                </p>

                {/* Rótulos curtos de propósito: "Acompanhando" não cabe na
                    coluna de ~110px do mobile. "Seguindo" também é o termo já
                    usado na aba do feed de posts. */}
                <ul className={style.stats}>
                  <li className={style.stat}>
                    <span className={style.statValue}>{followingCount}</span>
                    <span className={style.statLabel}>Seguindo</span>
                  </li>
                  <li className={style.stat}>
                    <span className={style.statValue}>{followersCount}</span>
                    <span className={style.statLabel}>Seguidores</span>
                  </li>
                  <li className={style.stat}>
                    <span className={style.statValue}>{postsCount}</span>
                    <span className={style.statLabel}>Postagens</span>
                  </li>
                </ul>

                <div className={style.reputationRow}>
                  <ReputationBadge value={perfilUser.user.reputation ?? 0} showLevel />
                </div>
              </div>
            </div>
          </section>

          {/* ===== ABAS ===== */}
          <div className={style.tabBar} role="tablist" aria-label="Seções do perfil">
            <button type="button" role="tab" aria-selected={activeTab === "info"} className={style.tab} onClick={() => setActiveTab("info")}>
              Informações
            </button>
            <button type="button" role="tab" aria-selected={activeTab === "posts"} className={style.tab} onClick={() => setActiveTab("posts")}>
              Postagens
              {postsCount > 0 && <span className={style.tabCount}>{postsCount}</span>}
            </button>
            {isOwnProfile && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "notifications"}
                className={style.tab}
                onClick={() => setActiveTab("notifications")}
              >
                Notificações
              </button>
            )}
          </div>

          {/* ===== INFORMAÇÕES ===== */}
          {activeTab === "info" && (
            <div className={style.content}>
              <div className={style.mainCol}>
                {(hasAbout || isOwnProfile) && (
                  <SectionPanel title="Sobre">
                    {perfilUser.user.resumo && <p className={style.lead}>{perfilUser.user.resumo}</p>}
                    {perfilUser.user.bio && <p className={style.body}>{perfilUser.user.bio}</p>}
                    {!hasAbout && (
                      <p className={style.panelEmpty}>
                        Conte o que você faz na indústria para quem visita seu perfil.{" "}
                        <Link href={`/perfil/${username}/configuracoes`} className={style.panelEmptyLink}>
                          Preencher agora
                        </Link>
                      </p>
                    )}
                  </SectionPanel>
                )}

                <ListableSectionPanel
                  title="Histórico Profissional"
                  items={perfilUser.historico}
                  emptyText={isOwnProfile ? "Nenhuma experiência cadastrada ainda." : null}
                  renderItem={(item) => (
                    <TimelineItem
                      title={item.cargo}
                      startDate={item.init_date}
                      endDate={item.end_date}
                      subtitle={[item.company, item.cidade, item.estado].filter(Boolean).join(" · ")}
                      entries={item.atribuicoes}
                    />
                  )}
                />

                <ListableSectionPanel
                  title="Formação Acadêmica"
                  items={perfilUser.formacoes}
                  emptyText={isOwnProfile ? "Nenhuma formação cadastrada ainda." : null}
                  renderItem={(item) => (
                    <TimelineItem title={item.nome} startDate={item.init_date} endDate={item.end_date} subtitle={item.instituicao} />
                  )}
                />
              </div>

              <aside className={style.sideCol}>
                {/* O QR saiu do cabeçalho: ocupava uma coluna inteira do bloco
                    de identidade para uma utilidade secundária. */}
                <div className={style.shareCard}>
                  <p className={style.shareTitle}>Compartilhar</p>
                  <ProfileQrCode username={username} isOwnProfile={isOwnProfile} />
                  <button type="button" className={style.shareButton} onClick={() => setShowShareModal(true)}>
                    <ShareIcon size={14} />
                    Compartilhar perfil
                  </button>
                </div>

                {isOwnProfile && <ReputationPanel username={username} />}

                <ListableSectionPanel
                  title="Estúdios"
                  items={perfilUser.studios}
                  emptyText={isOwnProfile ? "Você ainda não participa de nenhum estúdio." : null}
                  renderItem={(item) => <StudioItem item={item} />}
                  variant="small"
                />

                <ListableSectionPanel
                  title="Contatos"
                  items={perfilUser.contacts}
                  emptyText={isOwnProfile ? "Nenhum contato cadastrado ainda." : null}
                  renderItem={(item) => <ContatoItem item={item} />}
                  variant="small"
                />

                <ListableSectionPanel
                  title="Especializações"
                  items={perfilUser.roles}
                  emptyText={isOwnProfile ? "Nenhuma especialização cadastrada ainda." : null}
                  renderItem={(item) => (
                    <SkillItem label={item.portfolio_role_name} level={item.experience} iconSrc={iconPath("professions", item.icon_img)} />
                  )}
                  variant="small"
                />

                <ListableSectionPanel
                  title="Ferramentas"
                  items={perfilUser.tools}
                  emptyText={isOwnProfile ? "Nenhuma ferramenta cadastrada ainda." : null}
                  renderItem={(item) => <SkillItem label={item.name} level={item.experience} iconSrc={iconPath("tools", item.icon_img)} />}
                  variant="small"
                />
              </aside>
            </div>
          )}

          {/* ===== POSTAGENS ===== */}
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
            <div>
              {loadingNotifs && <p className={style.postsState}>Carregando notificações...</p>}
              {!loadingNotifs && <NotificationList userNotifs={userNotifs} postNotifs={postNotifs} />}
            </div>
          )}
        </div>

        {showShareModal && (
          <ShareModal
            path={profilePath}
            text={`Veja o perfil de @${perfilUser.user.username} no Indies Brasil`}
            title="Compartilhar perfil"
            hint="Copie o link e cole no WhatsApp, Discord ou Instagram. O perfil será exibido como um cartão com nome, foto e resumo."
            onClose={() => setShowShareModal(false)}
          />
        )}
      </PageLayout.Content>
    </PageLayout>
  );
}

/** Caminho do ícone de competência. Devolve null quando não há ícone — o
 *  `SkillItem` cuida de omitir a imagem. */
function iconPath(folder, file) {
  if (!file) return null;
  // Os ícones de ferramenta são SVG; os de especialização, PNG.
  const extension = folder === "tools" ? "svg" : "png";
  return `/images/${folder}/${file}.${extension}`;
}

Perfil.propTypes = {
  /** Perfil já resolvido no servidor (ver `getServerSideProps`). */
  initialProfile: PropTypes.object,
  /** O usuário não existe — a página abre direto no estado "não encontrado". */
  profileNotFound: PropTypes.bool,
};

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
    } else if (n.type === "new_follower" && n.source_username) {
      router.push(`/perfil/${n.source_username}`);
    }
  }

  return (
    <div className={style.notifList}>
      {all.map((n) => {
        const nid = `${n.user_id}_${n.type}_${n.source_user_id}${n.post_id != null ? `_${n.post_id}` : ""}`;
        const isClickable =
          n.type === "post_liked" ||
          n.type === "post_commented" ||
          (n.type === "studio_invitation" && n.org_slug) ||
          (n.type === "new_follower" && n.source_username);

        // `<button>` de verdade: antes era uma div com `role="button"` e um
        // listener manual de teclado, que o navegador não trata como controle.
        return (
          <button
            key={nid}
            type="button"
            disabled={!isClickable}
            className={`${style.notifItem} ${isClickable ? style.notifClickable : ""} ${!n.is_read ? style.notifUnread : ""}`}
            onClick={isClickable ? () => handleClick(n) : undefined}
          >
            <span className={style.notifHeader}>
              <span className={style.notifTitle}>{notificationTitle(n)}</span>
              <span className={style.notifDate}>
                {new Intl.DateTimeFormat("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                }).format(new Date(n.created_at))}
              </span>
            </span>
            {notificationMessage(n) && <span className={style.notifMessage}>{notificationMessage(n)}</span>}
            {!n.is_read && <span className={style.notifUnreadDot} />}
          </button>
        );
      })}
    </div>
  );
}
