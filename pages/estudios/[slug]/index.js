"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Avatar, Spinner } from "@primer/react";
import { OrganizationIcon, PeopleIcon, DownloadIcon, GearIcon, PencilIcon, VideoIcon } from "@primer/octicons-react";

import { useUser } from "@/context/UserContext";
import SeoHead from "@/components/SeoHead";
import FollowButton from "@/components/FollowButton";
import AddressDisplay from "@/components/Address/AddressDisplay";
import ContatoItem from "@/components/Portfolio/Contatos/ContatoItem";
import StudioQrCode from "@/components/Portfolio/StudioQrCode";
import SectionPanel from "@/components/Panels/SectionPanel/SectionPanel";
import StatusMessageComponent from "@/components/StatusMessage/StatusMessageComponent";
import ImageCropModal from "@/components/ImageTools/ImageCropTool/ImageCropModal";
import PropTypes from "prop-types";
import { SITE_URL } from "@/lib/seo";
import styles from "./studio.module.css";

function formatDateBR(dateStr) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(dateStr));
}

/** Extrai URL de embed para YouTube a partir de uma URL fornecida pelo usuário. */
function getVideoEmbedUrl(url) {
  if (!url) return null;
  let m = url.match(/[?&]v=([^&]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1&loop=1&playlist=${m[1]}`;
  m = url.match(/youtu\.be\/([^?]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1&loop=1&playlist=${m[1]}`;
  m = url.match(/youtube\.com\/shorts\/([^?]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1&loop=1&playlist=${m[1]}`;
  return null;
}

function renderBanner(embedUrl, bannerUrl, studioName, styles) {
  if (embedUrl) {
    return (
      <iframe src={embedUrl} className={styles.bannerVideo} allow="autoplay; encrypted-media" allowFullScreen title={`Vídeo de ${studioName}`} />
    );
  }
  if (bannerUrl) {
    return <img src={bannerUrl} alt={`Banner de ${studioName}`} className={styles.bannerImg} />;
  }
  return <div className={styles.bannerPlaceholder} />;
}

export default function StudioPage() {
  const router = useRouter();
  const { slug } = router.query;
  const { user: authUser, loadingUser } = useUser();

  const [studio, setStudio] = useState(null);
  const [viewer, setViewer] = useState({ isFollowing: false, isMember: false, isAdmin: false, isOwner: false });
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState({ type: null, text: "" });

  // Upload crop state
  const [cropSrc, setCropSrc] = useState(null);
  const [cropPreset, setCropPreset] = useState("avatar");
  const [pendingImgType, setPendingImgType] = useState(null);
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  // Games
  const [studioGames, setStudioGames] = useState([]);

  // Video URL editing
  const [editingVideoUrl, setEditingVideoUrl] = useState(false);
  const [videoUrlDraft, setVideoUrlDraft] = useState("");
  const [savingVideo, setSavingVideo] = useState(false);

  const fetchStudio = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/studios/${slug}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || data.status_code) {
        setStudio(null);
      } else {
        setStudio(data);
        setViewer(data.viewer ?? {});
      }
    } catch {
      setStudio(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const fetchStudioGames = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/v1/studios/${slug}/games`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStudioGames(data.games ?? []);
      }
    } catch {
      // ignore
    }
  }, [slug]);

  useEffect(() => {
    fetchStudio();
    fetchStudioGames();
  }, [fetchStudio, fetchStudioGames]);

  const handleFollowChange = useCallback((nowFollowing) => {
    setViewer((v) => ({ ...v, isFollowing: nowFollowing }));
    setStudio((s) => (s ? { ...s, follower_count: (s.follower_count ?? 0) + (nowFollowing ? 1 : -1) } : s));
  }, []);

  const [respondingInvite, setRespondingInvite] = useState(false);
  async function handleInviteRespond(accept) {
    const inv = viewer.pendingInvitation;
    if (!inv) return;
    setRespondingInvite(true);
    try {
      const res = await fetch(`/api/v1/studios/${slug}/invitations/${inv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accept }),
      });
      if (res.ok) {
        setViewer((v) => ({ ...v, pendingInvitation: null, isMember: accept }));
        if (accept) fetchStudio();
      } else {
        const err = await res.json();
        setStatusMsg({ type: "error", text: err.message || "Erro ao responder convite." });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Erro ao responder convite." });
    } finally {
      setRespondingInvite(false);
    }
  }

  // ── Upload helpers ────────────────────────────────────────────────────
  function openFilePicker(imgType, preset) {
    setPendingImgType(imgType);
    setCropPreset(preset);
    if (imgType === "logo") logoInputRef.current?.click();
    else bannerInputRef.current?.click();
  }

  function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleCropConfirm(blob) {
    setCropSrc(null);
    if (!pendingImgType) return;
    const formData = new FormData();
    formData.append("file", blob);
    formData.append("imgType", pendingImgType);
    try {
      const res = await fetch(`/api/v1/studios/${slug}/images`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha no upload");
      await fetchStudio();
    } catch {
      setStatusMsg({ type: "error", text: "Erro ao enviar imagem." });
    }
  }

  // ── Video URL helpers ─────────────────────────────────────────────────
  function startEditVideoUrl() {
    setVideoUrlDraft(studio?.banner_video_url ?? "");
    setEditingVideoUrl(true);
  }

  async function saveVideoUrl() {
    setSavingVideo(true);
    try {
      const res = await fetch(`/api/v1/studios/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ banner_video_url: videoUrlDraft.trim() || null }),
      });
      if (!res.ok) throw new Error("Falha ao salvar URL do vídeo.");
      await fetchStudio();
      setEditingVideoUrl(false);
    } catch {
      setStatusMsg({ type: "error", text: "Erro ao salvar URL do vídeo." });
    } finally {
      setSavingVideo(false);
    }
  }

  if (loading || loadingUser) {
    return (
      <div className={styles.loadingWrapper}>
        <Spinner size="large" />
      </div>
    );
  }

  if (!studio) {
    return (
      <div className={styles.notFound}>
        <OrganizationIcon size={48} />
        <p>Estúdio não encontrado.</p>
        <Link href="/estudios" className={styles.btnOutline}>
          Ver todos os estúdios
        </Link>
      </div>
    );
  }

  const canEdit = viewer.isAdmin || viewer.isOwner;
  const pageTitle = `${studio.name} — Indies Brasil`;
  const pageUrl = `${SITE_URL}/estudios/${studio.slug}`;
  const embedUrl = getVideoEmbedUrl(studio.banner_video_url);

  return (
    <>
      <SeoHead
        title={pageTitle}
        description={studio.pitch || `Estúdio indie brasileiro: ${studio.name}`}
        canonical={pageUrl}
        openGraph={{
          title: pageTitle,
          description: studio.pitch || "",
          url: pageUrl,
          image: studio.banner_url || studio.logo_url || undefined,
        }}
      />

      {/* Inputs ocultos para upload */}
      <input ref={logoInputRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={handleFileSelected} />
      <input ref={bannerInputRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={handleFileSelected} />

      {cropSrc && <ImageCropModal imageSrc={cropSrc} preset={cropPreset} onConfirm={handleCropConfirm} onClose={() => setCropSrc(null)} />}

      <div className={styles.pageWrapper}>
        {statusMsg.text && <StatusMessageComponent type={statusMsg.type} message={statusMsg.text} />}

        {viewer.pendingInvitation && (
          <div className={styles.inviteBanner}>
            <span className={styles.inviteBannerText}>
              <strong>{viewer.pendingInvitation.invited_by_username}</strong> convidou você para fazer parte deste estúdio
              {viewer.pendingInvitation.role ? ` como ${viewer.pendingInvitation.role}` : ""}.
            </span>
            <div className={styles.inviteBannerActions}>
              <button className={styles.btnAccept} onClick={() => handleInviteRespond(true)} disabled={respondingInvite}>
                {respondingInvite ? <Spinner size="small" /> : "Aceitar"}
              </button>
              <button className={styles.btnDecline} onClick={() => handleInviteRespond(false)} disabled={respondingInvite}>
                Recusar
              </button>
            </div>
          </div>
        )}

        {/* HEADER CARD */}
        <div className={styles.headerCard}>
          {/* BANNER */}
          <div className={styles.bannerWrapper}>
            {renderBanner(embedUrl, studio.banner_url, studio.name, styles)}
            {canEdit && (
              <div className={styles.bannerActions}>
                {editingVideoUrl ? (
                  <div className={styles.videoUrlEditor}>
                    <input
                      type="url"
                      className={styles.videoUrlInput}
                      value={videoUrlDraft}
                      onChange={(e) => setVideoUrlDraft(e.target.value)}
                      placeholder="URL do YouTube (deixe vazio para remover)"
                      autoFocus
                    />
                    <button className={styles.bannerBtn} onClick={saveVideoUrl} disabled={savingVideo}>
                      {savingVideo ? <Spinner size="small" /> : "Salvar"}
                    </button>
                    <button className={styles.bannerBtn} onClick={() => setEditingVideoUrl(false)}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <>
                    <button className={styles.bannerBtn} onClick={() => openFilePicker("banner", "headerBanner")}>
                      <PencilIcon size={12} /> Imagem
                    </button>
                    <button className={styles.bannerBtn} onClick={startEditVideoUrl}>
                      <VideoIcon size={12} /> Vídeo
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* LOGO */}
          <div className={styles.logoWrapper}>
            {canEdit ? (
              <button onClick={() => openFilePicker("logo", "squareLogo")} className={styles.logoBtn} title="Alterar logo">
                <Avatar src={studio.logo_url || undefined} size={72} alt={studio.name} className={styles.studioLogo} />
                <span className={styles.logoBtnOverlay}>
                  <PencilIcon size={12} />
                </span>
              </button>
            ) : (
              <Avatar src={studio.logo_url || undefined} size={72} alt={studio.name} className={styles.studioLogo} />
            )}
          </div>

          {/* CONTENT ROW */}
          <div className={styles.profileHeaderRow}>
            <div className={styles.profileContent}>
              <div className={styles.profileMeta}>
                <h1 className={styles.studioName}>{studio.name}</h1>
                {studio.pitch && <p className={styles.studioPitch}>{studio.pitch}</p>}
                <div className={styles.metaRow}>
                  {studio.founded_at && <span className={styles.metaItem}>Fundado em {formatDateBR(studio.founded_at)}</span>}
                  <span className={styles.metaItem}>
                    <PeopleIcon size={14} /> {studio.member_count ?? 0} membros
                  </span>
                  {(studio.follower_count ?? 0) > 0 && <span className={styles.metaItem}>{studio.follower_count} seguidores</span>}
                </div>
              </div>

              <div className={styles.profileActions}>
                {!viewer.isOwner && !viewer.isMember && authUser?.id && (
                  <FollowButton endpoint={`/api/v1/studios/${slug}/follow`} isFollowing={viewer.isFollowing} onToggle={handleFollowChange} />
                )}
                <Link href={`/estudios/${slug}/press-kit`} className={styles.btnOutline} target="_blank" rel="noopener noreferrer">
                  <DownloadIcon size={14} /> Press Kit
                </Link>
                {canEdit && (
                  <Link href={`/estudios/${slug}/configuracoes`} className={styles.btnOutline}>
                    <GearIcon size={14} /> Editar
                  </Link>
                )}
              </div>
            </div>

            <div className={styles.profileRight}>
              <StudioQrCode slug={slug} canEdit={canEdit} />
            </div>
          </div>
        </div>

        {/* CONTEÚDO */}
        <div className={styles.contentGrid}>
          {/* COLUNA PRINCIPAL */}
          <main className={styles.mainCol}>
            {studio.description && (
              <SectionPanel title="Sobre">
                <p className={styles.bodyText}>{studio.description}</p>
              </SectionPanel>
            )}

            {studio.history && (
              <SectionPanel title="História">
                <p className={styles.bodyText}>{studio.history}</p>
              </SectionPanel>
            )}

            {/* JOGOS */}
            {studioGames.length > 0 && (
              <SectionPanel title="Jogos">
                <ul className={styles.gameCardList}>
                  {studioGames.map((g) => (
                    <li key={g.id}>
                      <Link href={`/jogos/${g.slug}`} className={styles.gameCard}>
                        {g.cover_url ? (
                          <img src={g.cover_url} alt={g.name} className={styles.gameCardCover} />
                        ) : (
                          <div className={styles.gameCardCoverPlaceholder} />
                        )}
                        <div className={styles.gameCardInfo}>
                          <span className={styles.gameCardName}>{g.name}</span>
                          {g.short_description && <span className={styles.gameCardTagline}>{g.short_description}</span>}
                          {g.genre && <span className={styles.gameCardGenre}>{g.genre}</span>}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </SectionPanel>
            )}
          </main>

          {/* BARRA LATERAL */}
          <aside className={styles.sideCol}>
            {studio.address && (
              <SectionPanel title="Endereço">
                <AddressDisplay address={studio.address} />
              </SectionPanel>
            )}

            {studio.contacts?.length > 0 && (
              <SectionPanel title="Contatos">
                <ul className={styles.contactList}>
                  {studio.contacts.map((c) => (
                    <ContatoItem key={c.id ?? c.type} item={c} />
                  ))}
                </ul>
              </SectionPanel>
            )}

            {studio.cnpj && (
              <SectionPanel title="CNPJ">
                <span className={styles.bodyText}>{studio.cnpj}</span>
              </SectionPanel>
            )}

            {canEdit && !studio.address && !studio.cnpj && (studio.contacts?.length ?? 0) === 0 && (
              <SectionPanel title="Informações">
                <p className={styles.emptyHint}>
                  Adicione endereço, CNPJ e contatos nas{" "}
                  <Link href={`/estudios/${slug}/configuracoes`} className={styles.inlineLink}>
                    configurações do estúdio
                  </Link>
                  .
                </p>
              </SectionPanel>
            )}

            {/* MEMBROS */}
            <SectionPanel title={`Membros (${studio.members?.length ?? 0})`}>
              {studio.members?.length > 0 ? (
                <ul className={styles.memberList}>
                  {studio.members.map((m) => (
                    <li key={m.user_id ?? m.id} className={styles.memberItem}>
                      <Link href={`/perfil/${m.username}`} className={styles.memberLink}>
                        <Avatar src={m.avatar_url || "/images/avatar.png"} size={32} alt={m.username} />
                        <div className={styles.memberInfo}>
                          <span className={styles.memberName}>{m.display_name || m.username}</span>
                          {m.roles?.length > 0 && <span className={styles.memberRoles}>{m.roles.join(", ")}</span>}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyHint}>
                  Nenhum membro ainda.{" "}
                  {canEdit && (
                    <Link href={`/estudios/${slug}/configuracoes`} className={styles.inlineLink}>
                      Convidar membros
                    </Link>
                  )}
                </p>
              )}
            </SectionPanel>
          </aside>
        </div>
      </div>
    </>
  );
}
