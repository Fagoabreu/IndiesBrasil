import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { PageLayout, Avatar } from "@primer/react";
import {
  CalendarIcon,
  DownloadIcon,
  EyeIcon,
  GearIcon,
  ShareIcon,
  InfoIcon,
  CommentDiscussionIcon,
  MailIcon,
  BellIcon,
  PeopleIcon,
  PersonIcon,
  CheckCircleFillIcon,
  CircleIcon,
  RocketIcon,
} from "@primer/octicons-react";
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
import MessagesPanel from "@/components/Messages/MessagesPanel";
import SendMessageButton from "@/components/Messages/SendMessageButton";
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

// Abas válidas. `mensagens` fica de fora do endereço público quando o perfil não
// é o do próprio visitante — quem decide é o `isOwnProfile`, no render.
const PROFILE_TABS = ["info", "posts", "notifications", "mensagens"];

/**
 * Descrição das abas: rótulo + ícone + se exige ser o dono do perfil.
 *
 * Fica fora do componente (como `METRICS` na home) porque é estrutura fixa: a
 * lista é lida pelo endereço (`PROFILE_TABS`), pelo teclado (navegação com
 * setas) e pelo `map` que desenha o trilho.
 */
const PROFILE_TAB_DEFS = [
  { id: "info", label: "Informações", icon: InfoIcon },
  { id: "posts", label: "Postagens", icon: CommentDiscussionIcon },
  { id: "mensagens", label: "Mensagens", icon: MailIcon, ownerOnly: true },
  { id: "notifications", label: "Notificações", icon: BellIcon, ownerOnly: true },
];

/**
 * Itens que compõem a "força do perfil" (só o dono vê).
 *
 * É um checklist do que já está preenchido: sem ele o perfil incompleto não
 * dizia ao dono o que faltava, e a página de configurações é longa demais para
 * descobrir isso sozinho.
 */
function buildCompleteness(profile) {
  const user = profile.user ?? {};
  const count = (list) => (Array.isArray(list) ? list.length : 0);

  return [
    { key: "sobre", label: "Resumo e bio", done: Boolean(user.resumo && user.bio) },
    { key: "foto", label: "Foto de perfil", done: Boolean(user.avatar_image) },
    { key: "capa", label: "Capa personalizada", done: Boolean(user.background_image) },
    { key: "especializacoes", label: "Especializações", done: count(profile.roles) > 0 },
    { key: "ferramentas", label: "Ferramentas", done: count(profile.tools) > 0 },
    { key: "contatos", label: "Um contato", done: count(profile.contacts) > 0 },
    { key: "historico", label: "Histórico profissional", done: count(profile.historico) > 0 },
    { key: "formacao", label: "Formação acadêmica", done: count(profile.formacoes) > 0 },
  ];
}

export default function Perfil({ initialProfile, profileNotFound = false }) {
  const router = useRouter();
  const { username } = router.query;

  const { user: authUser, loadingUser } = useUser();

  // Dados do SSR entram como estado inicial: a página já vem preenchida no HTML
  // (o que o crawler do WhatsApp lê) e o fetch abaixo só refina o que depende de
  // sessão (`is_following`, perfil privado visto pelo dono).
  const [perfilUser, setPerfilUser] = useState(initialProfile);
  const [loadingProfile, setLoadingProfile] = useState(!initialProfile && !profileNotFound);

  // A aba vive no endereço (`?tab=`), e SÓ nele: um estado paralelo seria uma
  // segunda fonte de verdade, que precisa ser sincronizada com um efeito. Aqui
  // a URL é a fonte, o que já resolve o link de uma notificação abrir direto em
  // Mensagens e a aba sobreviver a recarregar/compartilhar a página.
  const queryTab = router.query.tab;
  const activeTab = typeof queryTab === "string" && PROFILE_TABS.includes(queryTab) ? queryTab : "info";

  /** Troca de aba espelhando no endereço (shallow: não reexecuta o SSR). */
  function selectTab(tab) {
    const query = { ...router.query };
    if (tab === "info") {
      delete query.tab;
    } else {
      query.tab = tab;
    }
    router.replace({ query }, undefined, { shallow: true });
  }

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
        <PageLayout.Content width="large">
          <div className={style.page} role="status" aria-live="polite" aria-label="Carregando perfil">
            <div className={style.headerCard}>
              <div className={`${style.cover} ${style.skeleton}`} />
              <div className={style.headerBody}>
                <div className={style.avatarRow}>
                  <div className={`${style.avatarRing} ${style.skeleton}`} />
                </div>
                <div className={style.identity}>
                  <div className={style.skeleton} style={{ width: 200, height: 28, marginTop: 14 }} />
                  <div className={style.skeleton} style={{ width: 120, height: 16 }} />
                  <div className={style.skeleton} style={{ width: 300, height: 26, marginTop: 12 }} />
                  <div className={style.skeleton} style={{ width: "100%", maxWidth: 480, height: 62, marginTop: 12 }} />
                </div>
              </div>
            </div>

            <div className={style.skeleton} style={{ width: 320, height: 46, borderRadius: 999 }} />

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

  // Mensagens e Notificações só existem para o dono do perfil (a caixa de
  // entrada e o feed de notificações são privados). Se o endereço pedir uma
  // delas a um visitante, cai em "info" — melhor voltar à primeira aba do que
  // renderizar uma área vazia.
  const requestedOwnerTab = PROFILE_TAB_DEFS.some((tab) => tab.ownerOnly && tab.id === activeTab);
  const effectiveTab = requestedOwnerTab && !isOwnProfile ? "info" : activeTab;

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

  // Abas visíveis: as de mensagens e notificações só existem para o dono.
  const visibleTabs = PROFILE_TAB_DEFS.filter((tab) => !tab.ownerOnly || isOwnProfile);

  // Força do perfil — só faz sentido para quem pode editar.
  const completenessItems = isOwnProfile ? buildCompleteness(perfilUser) : [];
  const completenessDone = completenessItems.filter((item) => item.done).length;
  const completenessPercent = completenessItems.length ? Math.round((completenessDone / completenessItems.length) * 100) : 0;

  /**
   * Navegação por teclado no padrão WAI-ARIA de abas: setas movem o foco,
   * Home/End vão às pontas. Sem isso o trilho era uma fileira de botões que só
   * respondia a Tab, e a convenção de tablist ficava pela metade.
   */
  function handleTabKeyDown(event, index) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;

    event.preventDefault();
    const last = visibleTabs.length - 1;
    let next = index;

    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;

    selectTab(visibleTabs[next].id);
    document.getElementById(`profile-tab-${visibleTabs[next].id}`)?.focus();
  }

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
      <PageLayout.Content width="large">
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
                sizes="(max-width: 860px) 100vw, 1012px"
                className={style.coverImage}
              />
              {/* Duas camadas decorativas: o véu garante contraste do avatar e
                  dos botões; o halo dá profundidade e amarra a capa à
                  identidade da marca sem precisar de imagem extra. */}
              <div className={style.coverScrim} aria-hidden="true" />
              <div className={style.coverGlow} aria-hidden="true" />
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
                  <Avatar size={124} src={perfilUser.user.avatar_image || "/images/avatar.png"} className={style.avatar} />
                  {isOwnProfile && (
                    <span className={style.avatarEdit}>
                      <ImageUploader preset="avatar" label="Alterar avatar" onCropped={({ blob }) => uploadProfileImage(blob, "avatar_image")} />
                    </span>
                  )}
                </div>

                <div className={style.headerActions}>
                  {!isOwnProfile && authUser && <FollowButton username={username} isFollowing={perfilUser.user.is_following ?? false} />}
                  {/* Conversar consigo mesmo não existe: no próprio perfil, não há
                      botão de mensagem. */}
                  {!isOwnProfile && <SendMessageButton targetType="user" targetId={perfilUser.user.id} className={style.actionBtn} />}
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

                {/* Reputação, tempo de casa e visibilidade no mesmo lugar: antes
                    a data e a visibilidade ficavam numa linha de metadados e a
                    reputação em outra, com um vão no meio do bloco. */}
                <div className={style.badgeRow}>
                  <ReputationBadge value={perfilUser.user.reputation ?? 0} showLevel />
                  <span className={style.badge}>
                    <CalendarIcon size={12} /> Desde {DateUtils.formatMonthYear(perfilUser.user.created_at)}
                  </span>
                  {isOwnProfile && visibilityLabel && (
                    <span className={style.badge}>
                      <EyeIcon size={12} /> Perfil {visibilityLabel}
                    </span>
                  )}
                </div>

                {/* Rótulos curtos de propósito: "Acompanhando" não cabe na
                    coluna estreita do mobile. "Seguindo" também é o termo já
                    usado na aba do feed de posts. */}
                <ul className={style.statStrip}>
                  <li className={style.statTile}>
                    <span className={style.statIcon} aria-hidden="true">
                      <PeopleIcon size={16} />
                    </span>
                    <span className={style.statText}>
                      <span className={style.statValue}>{followingCount}</span>
                      <span className={style.statLabel}>Seguindo</span>
                    </span>
                  </li>
                  <li className={style.statTile}>
                    <span className={style.statIcon} aria-hidden="true">
                      <PersonIcon size={16} />
                    </span>
                    <span className={style.statText}>
                      <span className={style.statValue}>{followersCount}</span>
                      <span className={style.statLabel}>Seguidores</span>
                    </span>
                  </li>
                  <li className={style.statTile}>
                    <span className={style.statIcon} aria-hidden="true">
                      <CommentDiscussionIcon size={16} />
                    </span>
                    <span className={style.statText}>
                      <span className={style.statValue}>{postsCount}</span>
                      <span className={style.statLabel}>Postagens</span>
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* ===== ABAS ===== */}
          <div className={style.tabBar} role="tablist" aria-label="Seções do perfil">
            {visibleTabs.map((tab, index) => {
              const TabIcon = tab.icon;
              const selected = effectiveTab === tab.id;

              return (
                <button
                  key={tab.id}
                  id={`profile-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  // Só a aba ativa aponta para um painel: os painéis são
                  // renderizados sob demanda, então um `aria-controls` nas
                  // abas inativas apontaria para um id inexistente.
                  aria-controls={selected ? `profile-panel-${tab.id}` : undefined}
                  // Roving tabindex: só a aba ativa entra na ordem de Tab; as
                  // setas navegam entre elas (padrão WAI-ARIA de tablist).
                  tabIndex={selected ? 0 : -1}
                  className={style.tab}
                  onClick={() => selectTab(tab.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                >
                  <span className={style.tabIcon} aria-hidden="true">
                    <TabIcon size={14} />
                  </span>
                  {tab.label}
                  {tab.id === "posts" && postsCount > 0 && <span className={style.tabCount}>{postsCount}</span>}
                </button>
              );
            })}
          </div>

          {/* ===== INFORMAÇÕES ===== */}
          {effectiveTab === "info" && (
            <div className={`${style.content} ${style.tabPanel}`} role="tabpanel" id="profile-panel-info" aria-labelledby="profile-tab-info">
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
                {/* Força do perfil: só o dono vê (é um convite à ação, não
                    informação pública). Antes do QR porque é o que tem algo a
                    pedir — o card de compartilhar é útil, não urgente. */}
                {isOwnProfile && (
                  <section className={style.completeness} aria-labelledby="profile-completeness-title">
                    <div className={style.completenessHead}>
                      <h2 id="profile-completeness-title" className={style.completenessTitle}>
                        Força do perfil
                      </h2>
                      <span className={style.completenessValue}>{completenessPercent}%</span>
                    </div>

                    <div
                      className={style.progressTrack}
                      role="progressbar"
                      aria-valuenow={completenessPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-labelledby="profile-completeness-title"
                    >
                      <div className={style.progressFill} style={{ width: `${completenessPercent}%` }} />
                    </div>

                    {completenessPercent < 100 ? (
                      <>
                        {/* Só o que falta: listar também os itens prontos
                            transformava o card num checklist de oito linhas
                            para dizer três coisas acionáveis. */}
                        <ul className={style.completenessList}>
                          {completenessItems
                            .filter((item) => !item.done)
                            .map((item) => (
                              <li key={item.key} className={style.completenessItem}>
                                <span className={style.completenessPending} aria-hidden="true">
                                  <CircleIcon size={14} />
                                </span>
                                {/* A lista mostra só pendências, mas o leitor de
                                    tela recebe o rótulo explícito: o ícone é
                                    decorativo e o contexto do card não é
                                    anunciado. */}
                                <span className={style.srOnly}>Falta preencher: </span>
                                {item.label}
                              </li>
                            ))}
                        </ul>

                        {completenessDone > 0 && (
                          <p className={style.completenessSummary}>
                            {completenessDone} de {completenessItems.length} itens já preenchidos
                          </p>
                        )}

                        <Link href={`/perfil/${username}/configuracoes`} className={style.completenessLink}>
                          <RocketIcon size={14} /> Completar perfil
                        </Link>
                      </>
                    ) : (
                      <p className={style.completenessDone}>
                        <CheckCircleFillIcon size={16} /> Perfil completo — obrigado por caprichar!
                      </p>
                    )}
                  </section>
                )}

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
          {effectiveTab === "posts" && (
            <div className={`${style.postsFeed} ${style.tabPanel}`} role="tabpanel" id="profile-panel-posts" aria-labelledby="profile-tab-posts">
              {loadingPosts && (
                <div className={style.postSkeletonFeed} role="status" aria-live="polite" aria-label="Carregando postagens">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className={style.postSkeletonCard}>
                      <div className={style.postSkeletonHead}>
                        <div className={`${style.skeleton} ${style.postSkeletonAvatar}`} />
                        <div className={style.postSkeletonMeta}>
                          <div className={style.skeleton} style={{ width: "38%", height: 12 }} />
                          <div className={style.skeleton} style={{ width: "22%", height: 10 }} />
                        </div>
                      </div>
                      <div className={style.skeleton} style={{ width: "100%", height: 12 }} />
                      <div className={style.skeleton} style={{ width: "86%", height: 12 }} />
                      <div className={style.skeleton} style={{ width: "61%", height: 12 }} />
                    </div>
                  ))}
                </div>
              )}
              {!loadingPosts && posts.length === 0 && <p className={style.postsState}>Nenhuma postagem ainda.</p>}
              {!loadingPosts &&
                posts.map((p) => (
                  <PostCardComponent key={p.id} post={p} canInteract={!!authUser} onDelete={isOwnProfile ? handleDeletePost : undefined} />
                ))}
            </div>
          )}

          {/* ===== MENSAGENS ===== */}
          {effectiveTab === "mensagens" && isOwnProfile && (
            <div className={style.tabPanel} role="tabpanel" id="profile-panel-mensagens" aria-labelledby="profile-tab-mensagens">
              <MessagesPanel />
            </div>
          )}

          {/* ===== NOTIFICAÇÕES ===== */}
          {effectiveTab === "notifications" && isOwnProfile && (
            <div className={style.tabPanel} role="tabpanel" id="profile-panel-notifications" aria-labelledby="profile-tab-notifications">
              {loadingNotifs && (
                <div className={style.postSkeletonFeed} role="status" aria-live="polite" aria-label="Carregando notificações">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className={style.postSkeletonCard}>
                      <div className={style.skeleton} style={{ width: "34%", height: 12 }} />
                      <div className={style.skeleton} style={{ width: "74%", height: 10 }} />
                    </div>
                  ))}
                </div>
              )}
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
