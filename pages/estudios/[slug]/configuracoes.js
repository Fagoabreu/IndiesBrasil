"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Spinner } from "@primer/react";
import { ArrowLeftIcon } from "@primer/octicons-react";

import { useUser } from "@/context/UserContext";
import SeoHead from "@/components/SeoHead";
import AddressFormFields from "@/components/Address/AddressFormFields";
import StatusMessageComponent from "@/components/StatusMessage/StatusMessageComponent";
import ImageCropModal from "@/components/ImageTools/ImageCropTool/ImageCropModal";
import styles from "./configuracoes.module.css";

const PLATFORM_OPTIONS = [
  ["windows", "Windows"],
  ["macos", "macOS"],
  ["linux", "Linux"],
  ["ps5", "PlayStation 5"],
  ["ps4", "PlayStation 4"],
  ["xbox_series", "Xbox Series"],
  ["xbox_one", "Xbox One"],
  ["switch", "Nintendo Switch"],
  ["ios", "iOS"],
  ["android", "Android"],
  ["browser", "Navegador"],
];

const STORE_TYPES = [
  { id: 1, name: "Steam" },
  { id: 2, name: "itch.io" },
  { id: 3, name: "Epic Games Store" },
  { id: 4, name: "GOG" },
  { id: 5, name: "Google Play" },
  { id: 6, name: "App Store" },
  { id: 7, name: "Xbox" },
  { id: 8, name: "PlayStation" },
];

const STAGE_LABELS = {
  concept: "Conceito",
  prototype: "Protótipo",
  alpha: "Alpha",
  beta: "Beta",
  early_access: "Acesso Antecipado",
  released: "Lançado",
  cancelled: "Cancelado",
};

const BG_CATEGORY_LABELS = {
  board_game: "Tabuleiro",
  card_game: "Cartas",
  rpg: "RPG de Mesa",
  dice_game: "Dados",
  miniature: "Miniaturas",
  party_game: "Party Game",
};

const BG_STAGE_LABELS = {
  concept: "Conceito",
  prototype: "Protótipo",
  crowdfunding: "Financiamento Coletivo",
  production: "Em Produção",
  released: "Lançado",
  cancelled: "Cancelado",
};

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

  // Tab navigation
  const [activeTab, setActiveTab] = useState("profile");
  const [activeGameTab, setActiveGameTab] = useState("info");

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

  // Jogos
  const [games, setGames] = useState([]);
  const [newGameName, setNewGameName] = useState("");
  const [newGameGenre, setNewGameGenre] = useState("");
  const [newGameStage, setNewGameStage] = useState("concept");
  const [creatingGame, setCreatingGame] = useState(false);
  const [gameMsg, setGameMsg] = useState({ type: null, text: "" });

  // Jogos de Mesa
  const [boardgames, setBoardgames] = useState([]);
  const [newBoardgameName, setNewBoardgameName] = useState("");
  const [newBoardgameCategory, setNewBoardgameCategory] = useState("board_game");
  const [newBoardgameStage, setNewBoardgameStage] = useState("concept");
  const [creatingBoardgame, setCreatingBoardgame] = useState(false);
  const [boardgameMsg, setBoardgameMsg] = useState({ type: null, text: "" });

  // Edição de jogo de mesa
  const [editingBoardgameSlug, setEditingBoardgameSlug] = useState(null);
  const [editBoardgameForm, setEditBoardgameForm] = useState(null);
  const [loadingBoardgameEdit, setLoadingBoardgameEdit] = useState(false);
  const [savingBoardgame, setSavingBoardgame] = useState(false);
  const [editBoardgameMsg, setEditBoardgameMsg] = useState({ type: null, text: "" });

  // Mídia de jogo de mesa
  const [activeBgTab, setActiveBgTab] = useState("info");
  const [bgVideos, setBgVideos] = useState([]);
  const [bgNewVideoUrl, setBgNewVideoUrl] = useState("");
  const [bgNewVideoCaption, setBgNewVideoCaption] = useState("");
  const [bgAddingVideo, setBgAddingVideo] = useState(false);
  const [bgRemovingVideoId, setBgRemovingVideoId] = useState(null);
  const [bgVideoMsg, setBgVideoMsg] = useState({ type: null, text: "" });
  // Upload de imagem do jogo de mesa
  const [bgImgCropSrc, setBgImgCropSrc] = useState(null);
  const [pendingBgImgSlug, setPendingBgImgSlug] = useState(null);
  const [uploadingBgImg, setUploadingBgImg] = useState(false);
  const bgImgInputRef = useRef(null);

  // Edição de jogo
  const [editingGameSlug, setEditingGameSlug] = useState(null);
  const [editGameForm, setEditGameForm] = useState(null);
  const [loadingGameEdit, setLoadingGameEdit] = useState(false);
  const [savingGame, setSavingGame] = useState(false);
  const [editGameMsg, setEditGameMsg] = useState({ type: null, text: "" });

  // Vídeos do jogo
  const [gameVideos, setGameVideos] = useState([]);
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newVideoCaption, setNewVideoCaption] = useState("");
  const [addingVideo, setAddingVideo] = useState(false);
  const [removingVideoId, setRemovingVideoId] = useState(null);
  const [videoMsg, setVideoMsg] = useState({ type: null, text: "" });

  // Upload de imagem do jogo
  const [gameImgCropSrc, setGameImgCropSrc] = useState(null);
  const [pendingGameImgSlug, setPendingGameImgSlug] = useState(null);
  const [uploadingGameImg, setUploadingGameImg] = useState(false);
  const gameImgInputRef = useRef(null);

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

  const fetchGames = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/v1/studios/${slug}/games`, { credentials: "include" });
      if (res.ok) setGames(await res.json());
    } catch {
      // silently ignore
    }
  }, [slug]);

  const fetchBoardgames = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/v1/studios/${slug}/boardgames`, { credentials: "include" });
      if (res.ok) setBoardgames(await res.json());
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
    fetchGames();
    fetchBoardgames();
  }, [fetchStudio, fetchInvites, fetchContacts, fetchGames, fetchBoardgames]);

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

  async function handleCreateGame(e) {
    e.preventDefault();
    if (!newGameName.trim()) return;
    setGameMsg({ type: null, text: "" });
    setCreatingGame(true);
    try {
      const res = await fetch(`/api/v1/studios/${slug}/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newGameName.trim(),
          genre: newGameGenre || "Indefinido",
          stage: newGameStage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGameMsg({ type: "error", text: data.message || "Erro ao criar jogo." });
        return;
      }
      setNewGameName("");
      setNewGameGenre("");
      setNewGameStage("concept");
      setGameMsg({ type: "success", text: `Jogo "${data.name}" criado!` });
      fetchGames();
      // Abrir o formulário de edição do jogo recém-criado
      handleOpenGameEdit(data.slug);
    } catch {
      setGameMsg({ type: "error", text: "Erro inesperado. Tente novamente." });
    } finally {
      setCreatingGame(false);
    }
  }

  async function handleOpenGameEdit(gameSlug) {
    if (editingGameSlug === gameSlug) {
      setEditingGameSlug(null);
      setEditGameForm(null);
      setGameVideos([]);
      setNewVideoUrl("");
      setNewVideoCaption("");
      setVideoMsg({ type: null, text: "" });
      return;
    }
    setEditingGameSlug(gameSlug);
    setEditGameForm(null);
    setGameVideos([]);
    setNewVideoUrl("");
    setNewVideoCaption("");
    setVideoMsg({ type: null, text: "" });
    setEditGameMsg({ type: null, text: "" });
    setActiveGameTab("info");
    setLoadingGameEdit(true);
    try {
      const [gameRes, mediaRes] = await Promise.all([
        fetch(`/api/v1/games/${gameSlug}`, { credentials: "include" }),
        fetch(`/api/v1/games/${gameSlug}/media`, { credentials: "include" }),
      ]);
      const data = await gameRes.json();
      if (!gameRes.ok) {
        setEditGameMsg({ type: "error", text: data.message || "Erro ao carregar jogo." });
        return;
      }
      setEditGameForm({
        name: data.name || "",
        short_description: data.short_description || "",
        description: data.description || "",
        genre: data.genre === "Indefinido" ? "" : data.genre || "",
        engine: data.engine || "",
        stage: data.stage || "concept",
        release_date: data.release_date ? data.release_date.slice(0, 10) : "",
        website_url: data.website_url || "",
        trailer_url: data.trailer_url || "",
        platforms: data.platforms || [],
        store_pages:
          data.store_pages?.map((sp) => ({
            store_type_id: sp.store_type_id,
            page_url: sp.page_url || "",
            price: sp.price == null ? "" : String(sp.price),
          })) || [],
      });
      if (mediaRes.ok) {
        const mediaData = await mediaRes.json();
        setGameVideos(mediaData.filter((m) => m.media_type === "video"));
      }
    } finally {
      setLoadingGameEdit(false);
    }
  }

  async function handleAddVideo(e) {
    e?.preventDefault();
    if (!newVideoUrl.trim()) return;
    setVideoMsg({ type: null, text: "" });
    setAddingVideo(true);
    try {
      const res = await fetch(`/api/v1/games/${editingGameSlug}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: newVideoUrl.trim(), caption: newVideoCaption.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVideoMsg({ type: "error", text: data.message || "Erro ao adicionar vídeo." });
        return;
      }
      setGameVideos((v) => [...v, data]);
      setNewVideoUrl("");
      setNewVideoCaption("");
    } finally {
      setAddingVideo(false);
    }
  }

  async function handleRemoveVideo(mediaId) {
    setRemovingVideoId(mediaId);
    try {
      const res = await fetch(`/api/v1/games/${editingGameSlug}/media/${mediaId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setGameVideos((v) => v.filter((m) => m.id !== mediaId));
      }
    } finally {
      setRemovingVideoId(null);
    }
  }

  async function handleSaveGame(e) {
    e.preventDefault();
    if (!editGameForm.name.trim()) return;
    setEditGameMsg({ type: null, text: "" });
    setSavingGame(true);
    try {
      const payload = {
        ...editGameForm,
        name: editGameForm.name.trim(),
        genre: editGameForm.genre.trim() || "Indefinido",
        store_pages: editGameForm.store_pages
          .filter((sp) => sp.store_type_id && sp.page_url.trim())
          .map((sp) => ({
            store_type_id: Number(sp.store_type_id),
            page_url: sp.page_url.trim(),
            price: sp.price === "" ? null : Number(sp.price),
          })),
      };
      const res = await fetch(`/api/v1/games/${editingGameSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditGameMsg({ type: "error", text: data.message || "Erro ao salvar jogo." });
        return;
      }
      setEditGameMsg({ type: "success", text: "Jogo atualizado com sucesso!" });
      fetchGames();
      // Atualizar slug se o nome mudou
      if (data.slug && data.slug !== editingGameSlug) {
        setEditingGameSlug(data.slug);
      }
    } catch {
      setEditGameMsg({ type: "error", text: "Erro inesperado. Tente novamente." });
    } finally {
      setSavingGame(false);
    }
  }

  function openGameImgPicker(gameSlug) {
    setPendingGameImgSlug(gameSlug);
    gameImgInputRef.current?.click();
  }

  function handleGameFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = () => setGameImgCropSrc(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleGameCropConfirm(blob) {
    setGameImgCropSrc(null);
    if (!pendingGameImgSlug) return;
    setUploadingGameImg(true);
    try {
      const formData = new FormData();
      formData.append("file", blob);
      formData.append("imgType", "banner");
      const res = await fetch(`/api/v1/games/${pendingGameImgSlug}/images`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha no upload da imagem.");
      fetchGames();
    } catch {
      setEditGameMsg({ type: "error", text: "Erro ao enviar imagem do jogo." });
    } finally {
      setUploadingGameImg(false);
    }
  }

  async function handleAddBgVideo(e) {
    e?.preventDefault();
    if (!bgNewVideoUrl.trim()) return;
    setBgVideoMsg({ type: null, text: "" });
    setBgAddingVideo(true);
    try {
      const res = await fetch(`/api/v1/boardgames/${editingBoardgameSlug}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: bgNewVideoUrl.trim(), caption: bgNewVideoCaption.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBgVideoMsg({ type: "error", text: data.message || "Erro ao adicionar vídeo." });
        return;
      }
      setBgVideos((v) => [...v, data]);
      setBgNewVideoUrl("");
      setBgNewVideoCaption("");
    } finally {
      setBgAddingVideo(false);
    }
  }

  async function handleRemoveBgVideo(mediaId) {
    setBgRemovingVideoId(mediaId);
    try {
      const res = await fetch(`/api/v1/boardgames/${editingBoardgameSlug}/media/${mediaId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setBgVideos((v) => v.filter((m) => m.id !== mediaId));
      }
    } finally {
      setBgRemovingVideoId(null);
    }
  }

  function openBgImgPicker(bgSlug) {
    setPendingBgImgSlug(bgSlug);
    bgImgInputRef.current?.click();
  }

  function handleBgFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = () => setBgImgCropSrc(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleBgCropConfirm(blob) {
    setBgImgCropSrc(null);
    if (!pendingBgImgSlug) return;
    setUploadingBgImg(true);
    try {
      const formData = new FormData();
      formData.append("file", blob);
      formData.append("imgType", "banner");
      const res = await fetch(`/api/v1/boardgames/${pendingBgImgSlug}/images`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha no upload da imagem.");
      fetchBoardgames();
    } catch {
      setEditBoardgameMsg({ type: "error", text: "Erro ao enviar imagem do jogo de mesa." });
    } finally {
      setUploadingBgImg(false);
    }
  }

  function togglePlatform(platform) {
    setEditGameForm((f) => ({
      ...f,
      platforms: f.platforms.includes(platform) ? f.platforms.filter((p) => p !== platform) : [...f.platforms, platform],
    }));
  }

  function addStorePage() {
    setEditGameForm((f) => ({
      ...f,
      store_pages: [...f.store_pages, { store_type_id: "", page_url: "", price: "" }],
    }));
  }

  function updateStorePage(idx, field, value) {
    setEditGameForm((f) => {
      const updated = f.store_pages.map((sp, i) => (i === idx ? { ...sp, [field]: value } : sp));
      return { ...f, store_pages: updated };
    });
  }

  function removeStorePage(idx) {
    setEditGameForm((f) => ({ ...f, store_pages: f.store_pages.filter((_, i) => i !== idx) }));
  }

  async function handleCreateBoardgame(e) {
    e.preventDefault();
    if (!newBoardgameName.trim()) return;
    setBoardgameMsg({ type: null, text: "" });
    setCreatingBoardgame(true);
    try {
      const res = await fetch(`/api/v1/studios/${slug}/boardgames`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newBoardgameName.trim(),
          category: newBoardgameCategory,
          stage: newBoardgameStage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBoardgameMsg({ type: "error", text: data.message || "Erro ao criar jogo de mesa." });
        return;
      }
      setNewBoardgameName("");
      setNewBoardgameCategory("board_game");
      setNewBoardgameStage("concept");
      setBoardgameMsg({ type: "success", text: `Jogo "${data.name}" criado!` });
      fetchBoardgames();
      handleOpenBoardgameEdit(data.slug);
    } catch {
      setBoardgameMsg({ type: "error", text: "Erro inesperado. Tente novamente." });
    } finally {
      setCreatingBoardgame(false);
    }
  }

  async function handleOpenBoardgameEdit(bgSlug) {
    if (editingBoardgameSlug === bgSlug) {
      setEditingBoardgameSlug(null);
      setEditBoardgameForm(null);
      setEditBoardgameMsg({ type: null, text: "" });
      setBgVideos([]);
      setBgNewVideoUrl("");
      setBgNewVideoCaption("");
      setBgVideoMsg({ type: null, text: "" });
      return;
    }
    setEditingBoardgameSlug(bgSlug);
    setEditBoardgameForm(null);
    setEditBoardgameMsg({ type: null, text: "" });
    setBgVideos([]);
    setBgNewVideoUrl("");
    setBgNewVideoCaption("");
    setBgVideoMsg({ type: null, text: "" });
    setActiveBgTab("info");
    setLoadingBoardgameEdit(true);
    try {
      const [bgRes, mediaRes] = await Promise.all([
        fetch(`/api/v1/boardgames/${bgSlug}`, { credentials: "include" }),
        fetch(`/api/v1/boardgames/${bgSlug}/media`, { credentials: "include" }),
      ]);
      const data = await bgRes.json();
      if (!bgRes.ok) {
        setEditBoardgameMsg({ type: "error", text: data.message || "Erro ao carregar jogo de mesa." });
        return;
      }
      setEditBoardgameForm({
        name: data.name || "",
        short_description: data.short_description || "",
        description: data.description || "",
        category: data.category || "board_game",
        stage: data.stage || "concept",
        player_count_min: data.player_count_min ?? "",
        player_count_max: data.player_count_max ?? "",
        play_time_min: data.play_time_min ?? "",
        play_time_max: data.play_time_max ?? "",
        age_rating: data.age_rating ?? "",
        weight: data.weight ?? "",
        release_date: data.release_date ? data.release_date.slice(0, 10) : "",
        website_url: data.website_url || "",
        mechanics: data.mechanics || [],
      });
      if (mediaRes.ok) {
        const mediaData = await mediaRes.json();
        setBgVideos(mediaData.filter((m) => m.media_type === "video"));
      }
    } finally {
      setLoadingBoardgameEdit(false);
    }
  }

  async function handleSaveBoardgame(e) {
    e.preventDefault();
    if (!editBoardgameForm.name.trim()) return;
    setEditBoardgameMsg({ type: null, text: "" });
    setSavingBoardgame(true);
    try {
      const payload = {
        ...editBoardgameForm,
        name: editBoardgameForm.name.trim(),
        player_count_min: editBoardgameForm.player_count_min === "" ? null : Number(editBoardgameForm.player_count_min),
        player_count_max: editBoardgameForm.player_count_max === "" ? null : Number(editBoardgameForm.player_count_max),
        play_time_min: editBoardgameForm.play_time_min === "" ? null : Number(editBoardgameForm.play_time_min),
        play_time_max: editBoardgameForm.play_time_max === "" ? null : Number(editBoardgameForm.play_time_max),
        age_rating: editBoardgameForm.age_rating === "" ? null : Number(editBoardgameForm.age_rating),
        weight: editBoardgameForm.weight === "" ? null : Number(editBoardgameForm.weight),
        mechanics: editBoardgameForm.mechanics.filter(Boolean),
      };
      const res = await fetch(`/api/v1/boardgames/${editingBoardgameSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditBoardgameMsg({ type: "error", text: data.message || "Erro ao salvar jogo de mesa." });
        return;
      }
      setEditBoardgameMsg({ type: "success", text: "Jogo de mesa atualizado com sucesso!" });
      fetchBoardgames();
      if (data.slug && data.slug !== editingBoardgameSlug) {
        setEditingBoardgameSlug(data.slug);
      }
    } catch {
      setEditBoardgameMsg({ type: "error", text: "Erro inesperado. Tente novamente." });
    } finally {
      setSavingBoardgame(false);
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

        <nav className={styles.tabs}>
          {[
            { id: "profile", label: "Perfil" },
            { id: "team", label: "Equipe" },
            { id: "contacts", label: "Contatos" },
            { id: "games", label: "Jogos" },
            { id: "boardgames", label: "Jogos de Mesa" },
          ].map((t) => (
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

        {activeTab === "profile" && (
          <>
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
          </>
        )}

        {/* CONTATOS */}
        {activeTab === "contacts" && (
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
        )}

        {/* GERENCIAR MEMBROS */}
        {activeTab === "team" && (
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
        )}

        {/* JOGOS */}
        {activeTab === "games" && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Jogos</h2>

            {/* Lista de jogos existentes */}
            {games.length > 0 && (
              <ul className={styles.gameList}>
                {games.map((g) => (
                  <li key={g.id} className={styles.gameListItem}>
                    <div className={styles.gameListRow}>
                      <Link href={`/jogos/${g.slug}`} className={styles.gameLink} target="_blank" rel="noopener noreferrer">
                        {g.name}
                      </Link>
                      <span className={styles.gameStageBadge}>{STAGE_LABELS[g.stage] ?? g.stage}</span>
                      <button
                        type="button"
                        className={`${styles.btnEditGame} ${editingGameSlug === g.slug ? styles.btnEditGameActive : ""}`}
                        onClick={() => handleOpenGameEdit(g.slug)}
                      >
                        {editingGameSlug === g.slug ? "Fechar" : "Editar"}
                      </button>
                    </div>

                    {/* Formulário de edição expandido */}
                    {editingGameSlug === g.slug && (
                      <div className={styles.gameEditPanel}>
                        {loadingGameEdit && (
                          <div className={styles.gameEditLoading}>
                            <Spinner size="small" />
                          </div>
                        )}
                        {!loadingGameEdit && editGameForm && (
                          <form onSubmit={handleSaveGame} className={styles.gameEditForm}>
                            <div className={styles.gameEditTabs}>
                              {[
                                { id: "info", label: "Informações" },
                                { id: "media", label: "Mídia" },
                                { id: "distribution", label: "Distribuição" },
                              ].map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  className={`${styles.gameEditTab} ${activeGameTab === t.id ? styles.gameEditTabActive : ""}`}
                                  onClick={() => setActiveGameTab(t.id)}
                                >
                                  {t.label}
                                </button>
                              ))}
                            </div>

                            {activeGameTab === "info" && (
                              <div className={styles.gameEditGrid}>
                                {/* Nome */}
                                <label className={styles.fieldLabel}>
                                  <span>Nome do jogo *</span>
                                  <input
                                    type="text"
                                    className={styles.input}
                                    value={editGameForm.name}
                                    onChange={(e) => setEditGameForm((f) => ({ ...f, name: e.target.value }))}
                                    maxLength={255}
                                    required
                                  />
                                </label>

                                {/* Tagline */}
                                <label className={styles.fieldLabel}>
                                  <span>Tagline</span>
                                  <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Frase curta sobre o jogo"
                                    value={editGameForm.short_description}
                                    onChange={(e) => setEditGameForm((f) => ({ ...f, short_description: e.target.value }))}
                                    maxLength={255}
                                  />
                                </label>

                                {/* Gênero */}
                                <label className={styles.fieldLabel}>
                                  <span>Gênero</span>
                                  <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Ex: Plataforma, RPG, Puzzle"
                                    value={editGameForm.genre}
                                    onChange={(e) => setEditGameForm((f) => ({ ...f, genre: e.target.value }))}
                                    maxLength={50}
                                  />
                                </label>

                                {/* Engine */}
                                <label className={styles.fieldLabel}>
                                  <span>Engine</span>
                                  <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Ex: Unity, Godot, Unreal"
                                    value={editGameForm.engine}
                                    onChange={(e) => setEditGameForm((f) => ({ ...f, engine: e.target.value }))}
                                    maxLength={50}
                                  />
                                </label>

                                {/* Status */}
                                <label className={styles.fieldLabel}>
                                  <span>Status de desenvolvimento</span>
                                  <select
                                    className={styles.input}
                                    value={editGameForm.stage}
                                    onChange={(e) => setEditGameForm((f) => ({ ...f, stage: e.target.value }))}
                                  >
                                    <option value="concept">Conceito</option>
                                    <option value="prototype">Protótipo</option>
                                    <option value="alpha">Alpha</option>
                                    <option value="beta">Beta</option>
                                    <option value="early_access">Acesso Antecipado</option>
                                    <option value="released">Lançado</option>
                                    <option value="cancelled">Cancelado</option>
                                  </select>
                                </label>

                                {/* Data de lançamento */}
                                <label className={styles.fieldLabel}>
                                  <span>Data de lançamento</span>
                                  <input
                                    type="date"
                                    className={styles.input}
                                    value={editGameForm.release_date}
                                    onChange={(e) => setEditGameForm((f) => ({ ...f, release_date: e.target.value }))}
                                  />
                                </label>

                                {/* Website */}
                                <label className={styles.fieldLabel}>
                                  <span>Site oficial</span>
                                  <input
                                    type="url"
                                    className={styles.input}
                                    placeholder="https://"
                                    value={editGameForm.website_url}
                                    onChange={(e) => setEditGameForm((f) => ({ ...f, website_url: e.target.value }))}
                                    maxLength={512}
                                  />
                                </label>

                                {/* Trailer */}
                                <label className={styles.fieldLabel}>
                                  <span>URL do trailer</span>
                                  <input
                                    type="url"
                                    className={styles.input}
                                    placeholder="https://youtube.com/..."
                                    value={editGameForm.trailer_url}
                                    onChange={(e) => setEditGameForm((f) => ({ ...f, trailer_url: e.target.value }))}
                                    maxLength={512}
                                  />
                                </label>
                              </div>
                            )}

                            {activeGameTab === "media" && (
                              <>
                                {/* Vídeos adicionais */}
                                <fieldset className={styles.fieldset}>
                                  <legend className={styles.fieldsetLegend}>Vídeos</legend>
                                  {gameVideos.length > 0 && (
                                    <ul className={styles.videoList}>
                                      {gameVideos.map((v) => (
                                        <li key={v.id} className={styles.videoItem}>
                                          <span className={styles.videoUrl} title={v.url}>
                                            {v.caption || v.url}
                                          </span>
                                          <button
                                            type="button"
                                            className={styles.btnRemoveStore}
                                            aria-label="Remover vídeo"
                                            disabled={removingVideoId === v.id}
                                            onClick={() => handleRemoveVideo(v.id)}
                                          >
                                            {removingVideoId === v.id ? <Spinner size="small" /> : "✕"}
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                  <div className={styles.videoAddForm}>
                                    <input
                                      type="url"
                                      className={styles.input}
                                      placeholder="URL do vídeo (YouTube, Vimeo…)"
                                      value={newVideoUrl}
                                      onChange={(e) => setNewVideoUrl(e.target.value)}
                                      maxLength={512}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          if (!addingVideo && newVideoUrl.trim()) handleAddVideo(e);
                                        }
                                      }}
                                    />
                                    <input
                                      type="text"
                                      className={styles.input}
                                      placeholder="Legenda (opcional)"
                                      value={newVideoCaption}
                                      onChange={(e) => setNewVideoCaption(e.target.value)}
                                      maxLength={120}
                                    />
                                    <button
                                      type="button"
                                      className={styles.btnAddStore}
                                      disabled={addingVideo || !newVideoUrl.trim()}
                                      onClick={handleAddVideo}
                                    >
                                      {addingVideo ? <Spinner size="small" /> : "+ Adicionar vídeo"}
                                    </button>
                                  </div>
                                  {videoMsg.text && <StatusMessageComponent type={videoMsg.type} message={videoMsg.text} />}
                                </fieldset>

                                {/* Imagem do card */}
                                <div className={styles.gameImgUpload}>
                                  <span className={styles.gameImgLabel}>Imagem do card (460 × 215)</span>
                                  <div className={styles.gameImgPreviewWrap}>
                                    {games.find((g) => g.slug === editingGameSlug)?.banner_url ? (
                                      <img
                                        src={games.find((g) => g.slug === editingGameSlug).banner_url}
                                        alt="Card atual"
                                        className={styles.gameImgPreview}
                                      />
                                    ) : (
                                      <div className={styles.gameImgPlaceholder}>Sem imagem</div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    className={styles.btnOutlineSmall}
                                    onClick={() => openGameImgPicker(editingGameSlug)}
                                    disabled={uploadingGameImg}
                                  >
                                    {uploadingGameImg ? <Spinner size="small" /> : "Enviar imagem"}
                                  </button>
                                </div>
                              </>
                            )}

                            {activeGameTab === "distribution" && (
                              <>
                                {/* Descrição completa */}
                                <label className={styles.fieldLabel}>
                                  <span>Sobre o jogo</span>
                                  <textarea
                                    className={`${styles.input} ${styles.textarea}`}
                                    placeholder="Descreva o jogo em detalhes..."
                                    value={editGameForm.description}
                                    onChange={(e) => setEditGameForm((f) => ({ ...f, description: e.target.value }))}
                                    rows={5}
                                  />
                                </label>

                                {/* Plataformas */}
                                <fieldset className={styles.fieldset}>
                                  <legend className={styles.fieldsetLegend}>Plataformas</legend>
                                  <div className={styles.platformsGrid}>
                                    {PLATFORM_OPTIONS.map(([key, label]) => (
                                      <label key={key} className={styles.checkboxLabel}>
                                        <input type="checkbox" checked={editGameForm.platforms.includes(key)} onChange={() => togglePlatform(key)} />
                                        {label}
                                      </label>
                                    ))}
                                  </div>
                                </fieldset>

                                {/* Links de lojas */}
                                <fieldset className={styles.fieldset}>
                                  <legend className={styles.fieldsetLegend}>Links de lojas</legend>
                                  {editGameForm.store_pages.map((sp, idx) => (
                                    <div key={`store-${sp.store_type_id ?? ""}-${idx}`} className={styles.storePageRow}>
                                      <select
                                        className={styles.input}
                                        value={sp.store_type_id}
                                        onChange={(e) => updateStorePage(idx, "store_type_id", e.target.value)}
                                      >
                                        <option value="">Selecione a loja</option>
                                        {STORE_TYPES.map((st) => (
                                          <option key={st.id} value={st.id}>
                                            {st.name}
                                          </option>
                                        ))}
                                      </select>
                                      <input
                                        type="url"
                                        className={styles.input}
                                        placeholder="URL da página na loja"
                                        value={sp.page_url}
                                        onChange={(e) => updateStorePage(idx, "page_url", e.target.value)}
                                      />
                                      <input
                                        type="number"
                                        className={`${styles.input} ${styles.priceInput}`}
                                        placeholder="Preço (0 = grátis)"
                                        value={sp.price}
                                        min="0"
                                        step="0.01"
                                        onChange={(e) => updateStorePage(idx, "price", e.target.value)}
                                      />
                                      <button
                                        type="button"
                                        className={styles.btnRemoveStore}
                                        onClick={() => removeStorePage(idx)}
                                        aria-label="Remover"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                  <button type="button" className={styles.btnAddStore} onClick={addStorePage}>
                                    + Adicionar loja
                                  </button>
                                </fieldset>
                              </>
                            )}

                            {editGameMsg.text && <StatusMessageComponent type={editGameMsg.type} message={editGameMsg.text} />}

                            <div className={styles.gameEditActions}>
                              <Link href={`/jogos/${g.slug}`} target="_blank" rel="noopener noreferrer" className={styles.btnOutlineSmall}>
                                Ver página
                              </Link>
                              <button type="submit" className={styles.btnSave} disabled={savingGame || !editGameForm.name.trim()}>
                                {savingGame ? <Spinner size="small" /> : "Salvar alterações"}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Criar novo jogo */}
            <form onSubmit={handleCreateGame} className={styles.gameForm}>
              <p className={styles.pendingTitle}>Criar novo jogo</p>
              <input
                type="text"
                className={styles.input}
                placeholder="Nome do jogo"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                maxLength={120}
                required
              />
              <div className={styles.gameFormRow}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Gênero (ex: Plataforma, RPG)"
                  value={newGameGenre}
                  onChange={(e) => setNewGameGenre(e.target.value)}
                  maxLength={60}
                />
                <select className={styles.input} value={newGameStage} onChange={(e) => setNewGameStage(e.target.value)}>
                  <option value="concept">Conceito</option>
                  <option value="prototype">Protótipo</option>
                  <option value="alpha">Alpha</option>
                  <option value="beta">Beta</option>
                  <option value="early_access">Acesso Antecipado</option>
                  <option value="released">Lançado</option>
                </select>
              </div>
              <button type="submit" className={styles.btnSave} disabled={creatingGame || !newGameName.trim()}>
                {creatingGame ? <Spinner size="small" /> : "Criar jogo"}
              </button>
            </form>

            {gameMsg.text && <StatusMessageComponent type={gameMsg.type} message={gameMsg.text} />}
          </section>
        )}

        {/* JOGOS DE MESA */}
        {activeTab === "boardgames" && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Jogos de Mesa</h2>

            {boardgames.length > 0 && (
              <ul className={styles.gameList}>
                {boardgames.map((bg) => (
                  <li key={bg.id} className={styles.gameListItem}>
                    <div className={styles.gameListRow}>
                      <Link href={`/jogos-de-mesa/${bg.slug}`} className={styles.gameLink} target="_blank" rel="noopener noreferrer">
                        {bg.name}
                      </Link>
                      <span className={styles.gameStageBadge}>{BG_STAGE_LABELS[bg.stage] ?? bg.stage}</span>
                      <span className={styles.gameStageBadge}>{BG_CATEGORY_LABELS[bg.category] ?? bg.category}</span>
                      <button
                        type="button"
                        className={`${styles.btnEditGame} ${editingBoardgameSlug === bg.slug ? styles.btnEditGameActive : ""}`}
                        onClick={() => handleOpenBoardgameEdit(bg.slug)}
                      >
                        {editingBoardgameSlug === bg.slug ? "Fechar" : "Editar"}
                      </button>
                    </div>

                    {editingBoardgameSlug === bg.slug && (
                      <div className={styles.gameEditPanel}>
                        {loadingBoardgameEdit && (
                          <div className={styles.gameEditLoading}>
                            <Spinner size="small" />
                          </div>
                        )}
                        {!loadingBoardgameEdit && editBoardgameForm && (
                          <form onSubmit={handleSaveBoardgame} className={styles.gameEditForm}>
                            <div className={styles.gameEditTabs}>
                              {[
                                { id: "info", label: "Informações" },
                                { id: "media", label: "Mídia" },
                              ].map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  className={`${styles.gameEditTab} ${activeBgTab === t.id ? styles.gameEditTabActive : ""}`}
                                  onClick={() => setActiveBgTab(t.id)}
                                >
                                  {t.label}
                                </button>
                              ))}
                            </div>

                            {activeBgTab === "info" && (
                              <div className={styles.gameEditGrid}>
                                <label className={styles.fieldLabel}>
                                  <span>Nome *</span>
                                  <input
                                    type="text"
                                    className={styles.input}
                                    value={editBoardgameForm.name}
                                    onChange={(e) => setEditBoardgameForm((f) => ({ ...f, name: e.target.value }))}
                                    maxLength={255}
                                    required
                                  />
                                </label>

                                <label className={styles.fieldLabel}>
                                  <span>Tagline</span>
                                  <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Frase curta sobre o jogo"
                                    value={editBoardgameForm.short_description}
                                    onChange={(e) => setEditBoardgameForm((f) => ({ ...f, short_description: e.target.value }))}
                                    maxLength={255}
                                  />
                                </label>

                                <label className={styles.fieldLabel}>
                                  <span>Categoria</span>
                                  <select
                                    className={styles.input}
                                    value={editBoardgameForm.category}
                                    onChange={(e) => setEditBoardgameForm((f) => ({ ...f, category: e.target.value }))}
                                  >
                                    {Object.entries(BG_CATEGORY_LABELS).map(([k, v]) => (
                                      <option key={k} value={k}>
                                        {v}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <label className={styles.fieldLabel}>
                                  <span>Fase</span>
                                  <select
                                    className={styles.input}
                                    value={editBoardgameForm.stage}
                                    onChange={(e) => setEditBoardgameForm((f) => ({ ...f, stage: e.target.value }))}
                                  >
                                    {Object.entries(BG_STAGE_LABELS).map(([k, v]) => (
                                      <option key={k} value={k}>
                                        {v}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <label className={styles.fieldLabel}>
                                  <span>Jogadores mín.</span>
                                  <input
                                    type="number"
                                    className={styles.input}
                                    min="1"
                                    value={editBoardgameForm.player_count_min}
                                    onChange={(e) => setEditBoardgameForm((f) => ({ ...f, player_count_min: e.target.value }))}
                                  />
                                </label>

                                <label className={styles.fieldLabel}>
                                  <span>Jogadores máx.</span>
                                  <input
                                    type="number"
                                    className={styles.input}
                                    min="1"
                                    value={editBoardgameForm.player_count_max}
                                    onChange={(e) => setEditBoardgameForm((f) => ({ ...f, player_count_max: e.target.value }))}
                                  />
                                </label>

                                <label className={styles.fieldLabel}>
                                  <span>Duração mín. (min)</span>
                                  <input
                                    type="number"
                                    className={styles.input}
                                    min="1"
                                    value={editBoardgameForm.play_time_min}
                                    onChange={(e) => setEditBoardgameForm((f) => ({ ...f, play_time_min: e.target.value }))}
                                  />
                                </label>

                                <label className={styles.fieldLabel}>
                                  <span>Duração máx. (min)</span>
                                  <input
                                    type="number"
                                    className={styles.input}
                                    min="1"
                                    value={editBoardgameForm.play_time_max}
                                    onChange={(e) => setEditBoardgameForm((f) => ({ ...f, play_time_max: e.target.value }))}
                                  />
                                </label>

                                <label className={styles.fieldLabel}>
                                  <span>Idade mínima</span>
                                  <input
                                    type="number"
                                    className={styles.input}
                                    min="0"
                                    max="99"
                                    value={editBoardgameForm.age_rating}
                                    onChange={(e) => setEditBoardgameForm((f) => ({ ...f, age_rating: e.target.value }))}
                                  />
                                </label>

                                <label className={styles.fieldLabel}>
                                  <span>Peso (1.0 – 5.0)</span>
                                  <input
                                    type="number"
                                    className={styles.input}
                                    min="1"
                                    max="5"
                                    step="0.1"
                                    value={editBoardgameForm.weight}
                                    onChange={(e) => setEditBoardgameForm((f) => ({ ...f, weight: e.target.value }))}
                                  />
                                </label>

                                <label className={styles.fieldLabel}>
                                  <span>Data de lançamento</span>
                                  <input
                                    type="date"
                                    className={styles.input}
                                    value={editBoardgameForm.release_date}
                                    onChange={(e) => setEditBoardgameForm((f) => ({ ...f, release_date: e.target.value }))}
                                  />
                                </label>

                                <label className={styles.fieldLabel}>
                                  <span>Site oficial</span>
                                  <input
                                    type="url"
                                    className={styles.input}
                                    placeholder="https://"
                                    value={editBoardgameForm.website_url}
                                    onChange={(e) => setEditBoardgameForm((f) => ({ ...f, website_url: e.target.value }))}
                                    maxLength={512}
                                  />
                                </label>

                                <label className={`${styles.fieldLabel} ${styles.fieldLabelFull}`}>
                                  <span>Sobre o jogo</span>
                                  <textarea
                                    className={`${styles.input} ${styles.textarea}`}
                                    placeholder="Descreva o jogo em detalhes..."
                                    value={editBoardgameForm.description}
                                    onChange={(e) => setEditBoardgameForm((f) => ({ ...f, description: e.target.value }))}
                                    rows={4}
                                  />
                                </label>
                              </div>
                            )}

                            {activeBgTab === "media" && (
                              <>
                                {/* Vídeos */}
                                <fieldset className={styles.fieldset}>
                                  <legend className={styles.fieldsetLegend}>Vídeos</legend>
                                  {bgVideos.length > 0 && (
                                    <ul className={styles.videoList}>
                                      {bgVideos.map((v) => (
                                        <li key={v.id} className={styles.videoItem}>
                                          <span className={styles.videoUrl} title={v.url}>
                                            {v.caption || v.url}
                                          </span>
                                          <button
                                            type="button"
                                            className={styles.btnRemoveStore}
                                            aria-label="Remover vídeo"
                                            disabled={bgRemovingVideoId === v.id}
                                            onClick={() => handleRemoveBgVideo(v.id)}
                                          >
                                            {bgRemovingVideoId === v.id ? <Spinner size="small" /> : "✕"}
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                  <div className={styles.videoAddForm}>
                                    <input
                                      type="url"
                                      className={styles.input}
                                      placeholder="URL do vídeo (YouTube, Vimeo…)"
                                      value={bgNewVideoUrl}
                                      onChange={(e) => setBgNewVideoUrl(e.target.value)}
                                      maxLength={512}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          if (!bgAddingVideo && bgNewVideoUrl.trim()) handleAddBgVideo(e);
                                        }
                                      }}
                                    />
                                    <input
                                      type="text"
                                      className={styles.input}
                                      placeholder="Legenda (opcional)"
                                      value={bgNewVideoCaption}
                                      onChange={(e) => setBgNewVideoCaption(e.target.value)}
                                      maxLength={120}
                                    />
                                    <button
                                      type="button"
                                      className={styles.btnAddStore}
                                      disabled={bgAddingVideo || !bgNewVideoUrl.trim()}
                                      onClick={handleAddBgVideo}
                                    >
                                      {bgAddingVideo ? <Spinner size="small" /> : "+ Adicionar vídeo"}
                                    </button>
                                  </div>
                                  {bgVideoMsg.text && <StatusMessageComponent type={bgVideoMsg.type} message={bgVideoMsg.text} />}
                                </fieldset>

                                {/* Imagem do card */}
                                <div className={styles.gameImgUpload}>
                                  <span className={styles.gameImgLabel}>Imagem do card (460 × 215)</span>
                                  <div className={styles.gameImgPreviewWrap}>
                                    {boardgames.find((b) => b.slug === editingBoardgameSlug)?.banner_url ? (
                                      <img
                                        src={boardgames.find((b) => b.slug === editingBoardgameSlug).banner_url}
                                        alt="Card atual"
                                        className={styles.gameImgPreview}
                                      />
                                    ) : (
                                      <div className={styles.gameImgPlaceholder}>Sem imagem</div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    className={styles.btnOutlineSmall}
                                    onClick={() => openBgImgPicker(editingBoardgameSlug)}
                                    disabled={uploadingBgImg}
                                  >
                                    {uploadingBgImg ? <Spinner size="small" /> : "Enviar imagem"}
                                  </button>
                                </div>
                              </>
                            )}

                            {editBoardgameMsg.text && <StatusMessageComponent type={editBoardgameMsg.type} message={editBoardgameMsg.text} />}

                            <div className={styles.gameEditActions}>
                              <Link href={`/jogos-de-mesa/${bg.slug}`} target="_blank" rel="noopener noreferrer" className={styles.btnOutlineSmall}>
                                Ver página
                              </Link>
                              <button type="submit" className={styles.btnSave} disabled={savingBoardgame || !editBoardgameForm.name.trim()}>
                                {savingBoardgame ? <Spinner size="small" /> : "Salvar alterações"}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Criar novo jogo de mesa */}
            <form onSubmit={handleCreateBoardgame} className={styles.gameForm}>
              <p className={styles.pendingTitle}>Criar novo jogo de mesa</p>
              <input
                type="text"
                className={styles.input}
                placeholder="Nome do jogo"
                value={newBoardgameName}
                onChange={(e) => setNewBoardgameName(e.target.value)}
                maxLength={255}
                required
              />
              <div className={styles.gameFormRow}>
                <select className={styles.input} value={newBoardgameCategory} onChange={(e) => setNewBoardgameCategory(e.target.value)}>
                  {Object.entries(BG_CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <select className={styles.input} value={newBoardgameStage} onChange={(e) => setNewBoardgameStage(e.target.value)}>
                  {Object.entries(BG_STAGE_LABELS)
                    .filter(([k]) => k !== "cancelled")
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                </select>
              </div>
              <button type="submit" className={styles.btnSave} disabled={creatingBoardgame || !newBoardgameName.trim()}>
                {creatingBoardgame ? <Spinner size="small" /> : "Criar jogo de mesa"}
              </button>
            </form>

            {boardgameMsg.text && <StatusMessageComponent type={boardgameMsg.type} message={boardgameMsg.text} />}
          </section>
        )}

        {/* CONVIDAR MEMBROS */}
        {activeTab === "team" && (
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
        )}
      </div>

      {/* Upload de imagem do jogo */}
      <input ref={gameImgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleGameFileSelected} />
      {gameImgCropSrc && (
        <ImageCropModal imageSrc={gameImgCropSrc} preset="gameCapsule" onConfirm={handleGameCropConfirm} onClose={() => setGameImgCropSrc(null)} />
      )}

      {/* Upload de imagem do jogo de mesa */}
      <input ref={bgImgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleBgFileSelected} />
      {bgImgCropSrc && (
        <ImageCropModal imageSrc={bgImgCropSrc} preset="gameCapsule" onConfirm={handleBgCropConfirm} onClose={() => setBgImgCropSrc(null)} />
      )}
    </>
  );
}
