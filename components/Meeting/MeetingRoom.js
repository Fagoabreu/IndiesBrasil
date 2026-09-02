import { useEffect, useRef, useState } from "react";
import { ConnectionState, Room, RoomEvent, Track } from "livekit-client";
import { BroadcastIcon, CommentDiscussionIcon, DeviceCameraVideoIcon, MuteIcon, SignOutIcon, UnmuteIcon, XIcon } from "@primer/octicons-react";

import styles from "./MeetingRoom.module.css";

const INITIALS_GRADIENTS = [
  "linear-gradient(135deg, #7c3aed, #db2777)",
  "linear-gradient(135deg, #2563eb, #06b6d4)",
  "linear-gradient(135deg, #059669, #84cc16)",
  "linear-gradient(135deg, #d97706, #dc2626)",
  "linear-gradient(135deg, #4f46e5, #a855f7)",
];

function getInitialsGradient(identity) {
  let hash = 0;
  const value = String(identity ?? "");
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return INITIALS_GRADIENTS[hash % INITIALS_GRADIENTS.length];
}

function getInitial(name) {
  const clean = String(name ?? "").trim();
  return (clean.charAt(0) || "?").toUpperCase();
}

function formatTime(date) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

/** Faz o snapshot de um participante: câmera/mic/screen + fala. */
function buildSnapshot(room, participant) {
  const readPublication = (source) => {
    const pub = participant.getTrackPublication(source);
    const track = pub?.track ?? null;
    const enabled = Boolean(track && pub && !pub.isMuted);
    return { pub, track, enabled };
  };

  return {
    identity: participant.identity,
    name: participant.name || participant.identity || "Participante",
    isLocal: Boolean(participant.isLocal),
    camera: readPublication(Track.Source.Camera),
    mic: readPublication(Track.Source.Microphone),
    screen: readPublication(Track.Source.ScreenShare),
    speaking: Array.isArray(room.activeSpeakers) && room.activeSpeakers.includes(participant),
  };
}

function refreshParticipants(room, setParticipants) {
  if (!room) return;
  const list = Array.from(room.remoteParticipants.values());
  const snapshots = list.map((participant) => buildSnapshot(room, participant)).filter((snap) => snap.camera.pub || snap.mic.pub || snap.screen.pub);
  if (room.localParticipant) {
    snapshots.push(buildSnapshot(room, room.localParticipant));
  }
  setParticipants(snapshots);
}

/** Tile de vídeo — anexa/desanexa o MediaStreamTrack ao elemento <video>. */
function VideoTile({ snapshot, track, enabled, screen }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !track || !enabled) return undefined;
    const attached = track.attach(element);
    attached.forEach((media) => {
      if (typeof media.play === "function") media.play().catch(() => {});
    });
    return () => {
      if (track?.detach) track.detach(element);
    };
  }, [track, enabled]);

  return (
    <div className={`${styles.tile} ${screen ? styles.tileScreen : ""} ${snapshot.speaking && !screen ? styles.speakingRing : ""}`}>
      {screen && (
        <span className={styles.screenBadge}>
          <BroadcastIcon size={12} /> Compartilhando tela
        </span>
      )}
      {enabled && track ? (
        <video ref={videoRef} className={`${styles.tileVideo} ${screen ? styles.tileScreenVideo : ""}`} autoPlay playsInline />
      ) : (
        <div className={styles.tileEmpty}>
          <div
            className={styles.tileAvatar}
            style={{
              width: 56,
              height: 56,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: getInitialsGradient(snapshot.identity),
              color: "#fff",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {getInitial(snapshot.name)}
          </div>
        </div>
      )}
      <span className={styles.tileNameplate}>
        {snapshot.name}
        {snapshot.isLocal && <em style={{ fontStyle: "normal", opacity: 0.75 }}>(você)</em>}
        {!snapshot.mic.enabled && (
          <span className={styles.muteBadge} title="Microfone desativado">
            <MuteIcon size={12} />
          </span>
        )}
      </span>
      {/* Áudio do participante remoto (elemento silencioso por natureza) */}
      {!snapshot.isLocal && <RemoteAudio snapshot={snapshot} />}
    </div>
  );
}

/** Anexa o áudio remoto a um elemento <audio> (autoplay a partir do clique de entrada). */
function RemoteAudio({ snapshot }) {
  const audioRef = useRef(null);
  const { track, enabled } = snapshot.mic;

  useEffect(() => {
    const element = audioRef.current;
    if (!element || !track || !enabled) return undefined;
    const attached = track.attach(element);
    attached.forEach((media) => {
      if (typeof media.play === "function") media.play().catch(() => {});
    });
    return () => {
      if (track?.detach) track.detach(element);
    };
  }, [track, enabled]);

  return <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />;
}

const CONN_LABELS = {
  [ConnectionState.Connecting]: "Conectando…",
  [ConnectionState.Reconnecting]: "Reconectando…",
  [ConnectionState.Connected]: "Conectado",
  [ConnectionState.Disconnected]: "Desconectado",
};

/**
 * Sala de reunião ao vivo (LiveKit).
 * Responsável pela conexão, grade de vídeos, áudio, compartilhamento de tela
 * e bate-papo de texto dentro da reunião.
 */
export default function MeetingRoom({ token, serverUrl, displayName, meetingTitle, orgName, isManager, onEndForAll, onExit }) {
  const roomRef = useRef(null);
  const mutedByShareRef = useRef(false);
  const micBeforeShareRef = useRef(false);
  const leftRef = useRef(false);
  const onExitRef = useRef(onExit);
  const onEndForAllRef = useRef(onEndForAll);

  // Mantém as refs de callback sempre atualizadas sem tocar ref durante o render.
  useEffect(() => {
    onExitRef.current = onExit;
    onEndForAllRef.current = onEndForAll;
  }, [onExit, onEndForAll]);

  const [connState, setConnState] = useState(ConnectionState.Connecting);
  const [connError, setConnError] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [shareWithAudio, setShareWithAudio] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [endedByHost, setEndedByHost] = useState(false);

  // Conexão + eventos do LiveKit
  useEffect(() => {
    if (!token || !serverUrl) return undefined;
    let disposed = false;
    let roomInstance = null;

    const start = async () => {
      const liveRoom = new Room({ adaptiveStream: true, dynacast: true });
      roomInstance = liveRoom;
      roomRef.current = liveRoom;

      const refresh = () => refreshParticipants(liveRoom, setParticipants);

      const REFRESH_EVENTS = [
        RoomEvent.ParticipantConnected,
        RoomEvent.ParticipantDisconnected,
        RoomEvent.TrackPublished,
        RoomEvent.LocalTrackPublished,
        RoomEvent.TrackUnpublished,
        RoomEvent.LocalTrackUnpublished,
        RoomEvent.TrackSubscribed,
        RoomEvent.TrackUnsubscribed,
        RoomEvent.TrackMuted,
        RoomEvent.TrackUnmuted,
        RoomEvent.ActiveSpeakersChanged,
        RoomEvent.ConnectionStateChanged,
        RoomEvent.ParticipantNameChanged,
      ];
      REFRESH_EVENTS.forEach((eventName) => liveRoom.on(eventName, refresh));

      liveRoom.on(RoomEvent.DataReceived, (payload, participant) => {
        if (disposed) return;
        try {
          const decoded = JSON.parse(new TextDecoder().decode(payload));
          if (decoded?.t !== "chat") return;
          setMessages((previous) => [
            ...previous.slice(-199),
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              from: participant?.identity ?? "",
              fromName: participant?.name || participant?.identity || "Participante",
              text: String(decoded.text ?? "").slice(0, 1000),
              ts: Date.now(),
            },
          ]);
        } catch {
          // Payload não é JSON de bate-papo — ignora.
        }
      });

      liveRoom.on(RoomEvent.Disconnected, () => {
        if (disposed) return;
        setConnState(liveRoom.state);
        if (roomRef.current === liveRoom) roomRef.current = null;
        setParticipants([]);
        // Desconexão não iniciada por quem saiu: sala fechada/caída.
        if (!leftRef.current) {
          onExitRef.current?.("disconnect");
        }
      });

      try {
        await liveRoom.connect(serverUrl, token, { autoSubscribe: true });
        if (disposed) {
          liveRoom.disconnect();
          return;
        }
        setConnState(liveRoom.state);
        refresh();
      } catch (error) {
        if (disposed) return;
        console.error("[MeetingRoom] falha ao conectar:", error);
        setConnError(error?.message || "Não foi possível conectar à reunião.");
        setConnState(ConnectionState.Disconnected);
      }
    };

    start();

    return () => {
      disposed = true;
      roomRef.current = null;
      if (roomInstance) {
        try {
          roomInstance.disconnect();
        } catch {
          // ignora
        }
      }
    };
  }, [token, serverUrl]);

  async function toggleCamera() {
    const liveRoom = roomRef.current;
    if (!liveRoom) return;
    const next = !cameraOn;
    setCameraOn(next);
    try {
      await liveRoom.localParticipant.setCameraEnabled(next);
    } catch (error) {
      console.error("[MeetingRoom] falha ao ligar câmera:", error);
      setCameraOn(!next);
      setConnError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    }
  }

  async function toggleMic() {
    const liveRoom = roomRef.current;
    if (!liveRoom) return;
    const next = !micOn;
    setMicOn(next);
    try {
      await liveRoom.localParticipant.setMicrophoneEnabled(next);
    } catch (error) {
      console.error("[MeetingRoom] falha ao ligar microfone:", error);
      setMicOn(!next);
      setConnError("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
    }
  }

  async function toggleShareScreen() {
    const liveRoom = roomRef.current;
    if (!liveRoom) return;
    const local = liveRoom.localParticipant;

    if (screenOn) {
      setScreenOn(false);
      try {
        await local.setScreenShareEnabled(false);
      } finally {
        // Restaura o microfone que foi desligado para evitar eco do áudio compartilhado.
        if (mutedByShareRef.current && micBeforeShareRef.current) {
          mutedByShareRef.current = false;
          micBeforeShareRef.current = false;
          setMicOn(true);
          local.setMicrophoneEnabled(true).catch(() => {});
        }
      }
      return;
    }

    try {
      // Áudio da tela só quando solicitado (guia/janela) — evita duplicar áudio na reunião.
      const captureOptions = shareWithAudio ? { audio: true } : true;
      const publication = await local.setScreenShareEnabled(captureOptions);
      if (!publication) {
        throw new Error("captura cancelada");
      }
      if (shareWithAudio && micOn) {
        mutedByShareRef.current = true;
        micBeforeShareRef.current = micOn;
        setMicOn(false);
        await local.setMicrophoneEnabled(false);
      }
      setScreenOn(true);
    } catch (error) {
      if (error?.name === "NotAllowedError" || error?.message === "captura cancelada") {
        // Usuário cancelou a captura — sem mensagem de erro.
        return;
      }
      console.error("[MeetingRoom] falha ao compartilhar tela:", error);
      setConnError("Não foi possível compartilhar a tela.");
    }
  }

  function sendMessage(event) {
    event.preventDefault();
    const liveRoom = roomRef.current;
    const text = draft.trim();
    if (!liveRoom || !text) return;
    try {
      liveRoom.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ t: "chat", text })), {
        reliable: true,
      });
      setMessages((previous) => [
        ...previous,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          from: "",
          fromName: "Você",
          text,
          ts: Date.now(),
          local: true,
        },
      ]);
      setDraft("");
    } catch (error) {
      console.error("[MeetingRoom] falha ao enviar mensagem:", error);
    }
  }

  async function handleLeave() {
    const liveRoom = roomRef.current;
    leftRef.current = true;
    setConnState(ConnectionState.Disconnected);
    if (liveRoom) {
      try {
        liveRoom.disconnect();
      } catch {
        // ignora
      }
    }
    onExit?.("leave");
  }

  async function handleEndForAll() {
    if (!onEndForAllRef.current) return;
    leftRef.current = true;
    setEndedByHost(true);
    try {
      await onEndForAllRef.current();
    } finally {
      await handleLeave();
    }
  }

  const screenParticipants = participants.filter((snap) => snap.screen.track && snap.screen.enabled);
  const videoParticipants = participants.filter((snap) => !snap.screen.enabled || !snap.screen.track);
  const hasScreen = screenParticipants.length > 0;

  return (
    <div className={styles.room}>
      <header className={styles.topbar}>
        <div className={styles.topInfo}>
          <span className={styles.topIcon}>
            <BroadcastIcon size={16} />
          </span>
          <div className={styles.titleGroup}>
            <p className={styles.title}>{meetingTitle || "Reunião"}</p>
            <p className={styles.subtitle}>
              {orgName}
              {displayName ? ` • ${displayName}` : ""}
            </p>
          </div>
        </div>
        <div className={styles.topActions}>
          {connError && (
            <span className={`${styles.connBadge} ${styles.connDotBad}`} title={connError}>
              Falha na conexão
            </span>
          )}
          <span className={styles.connBadge}>
            <i
              className={`${styles.connDot} ${connState === ConnectionState.Connected ? styles.connDotOk : ""} ${
                connState === ConnectionState.Disconnected ? styles.connDotBad : ""
              }`}
            />
            {CONN_LABELS[connState] ?? "Conectando…"}
          </span>
          {isManager && (
            <button
              type="button"
              className={`${styles.ctrlBtn} ${styles.ctrlBtnDanger}`}
              onClick={handleEndForAll}
              disabled={endedByHost}
              title="Encerra a reunião para todos os participantes"
            >
              <SignOutIcon size={14} /> Encerrar para todos
            </button>
          )}
          <button type="button" className={styles.leaveBtn} onClick={handleLeave} disabled={endedByHost}>
            <SignOutIcon size={14} /> Sair
          </button>
        </div>
      </header>

      <main className={styles.stage}>
        <div className={`${styles.grid} ${!hasScreen && videoParticipants.length <= 1 ? styles.gridSingle : ""}`}>
          {screenParticipants.map((snap) => (
            <VideoTile key={`screen-${snap.identity}`} snapshot={snap} track={snap.screen.track} enabled={snap.screen.enabled} screen />
          ))}
          {videoParticipants.map((snap) => (
            <VideoTile key={`tile-${snap.identity}`} snapshot={snap} track={snap.camera.track} enabled={snap.camera.enabled} />
          ))}
          {participants.length === 0 && <div className={styles.emptyStage}>Conectando à reunião…</div>}
        </div>

        {chatOpen && (
          <aside className={styles.sideChat}>
            <div className={styles.chatHead}>
              <span>
                <CommentDiscussionIcon size={14} /> Bate-papo
              </span>
              <button type="button" className={styles.iconBtn} onClick={() => setChatOpen(false)} aria-label="Fechar bate-papo">
                <XIcon size={14} />
              </button>
            </div>
            <div className={styles.chatMessages}>
              {messages.length === 0 ? (
                <p className={styles.chatEmpty}>Nenhuma mensagem ainda. Seja o primeiro a comentar!</p>
              ) : (
                messages.map((message) => (
                  <div className={styles.chatMsg} key={message.id}>
                    <div className={styles.chatMsgHead}>
                      <span className={`${styles.chatMsgFrom} ${message.local ? styles.chatMsgFromLocal : ""}`}>{message.fromName}</span>
                      <span className={styles.chatMsgTime}>{formatTime(new Date(message.ts))}</span>
                    </div>
                    <p className={styles.chatMsgText}>{message.text}</p>
                  </div>
                ))
              )}
            </div>
            <form className={styles.chatForm} onSubmit={sendMessage}>
              <input
                className={styles.chatInput}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Escreva uma mensagem…"
                aria-label="Mensagem do bate-papo"
                maxLength={1000}
              />
            </form>
          </aside>
        )}
      </main>

      <footer className={styles.controls}>
        {!chatOpen && (
          <button type="button" className={styles.ctrlBtn} onClick={() => setChatOpen(true)}>
            <CommentDiscussionIcon size={14} /> Bate-papo
          </button>
        )}
        <button
          type="button"
          className={`${styles.ctrlBtn} ${cameraOn ? styles.ctrlBtnOn : ""}`}
          onClick={toggleCamera}
          disabled={connState !== ConnectionState.Connected}
          aria-pressed={cameraOn}
        >
          <DeviceCameraVideoIcon size={14} /> {cameraOn ? "Desligar câmera" : "Ligar câmera"}
        </button>
        <button
          type="button"
          className={`${styles.ctrlBtn} ${micOn ? styles.ctrlBtnOn : ""}`}
          onClick={toggleMic}
          disabled={connState !== ConnectionState.Connected}
          aria-pressed={micOn}
        >
          {micOn ? <UnmuteIcon size={14} /> : <MuteIcon size={14} />}
          {micOn ? "Microfone ligado" : "Microfone desligado"}
        </button>
        <button
          type="button"
          className={`${styles.ctrlBtn} ${screenOn ? styles.ctrlBtnOn : ""}`}
          onClick={toggleShareScreen}
          disabled={connState !== ConnectionState.Connected}
          aria-pressed={screenOn}
        >
          <BroadcastIcon size={14} /> {screenOn ? "Parar de compartilhar" : "Compartilhar tela"}
        </button>
        {!screenOn && (
          <label className={styles.ctrlBtn} style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={shareWithAudio}
              onChange={(event) => setShareWithAudio(event.target.checked)}
              style={{ accentColor: "var(--accent-fg, #0969da)" }}
            />
            Com áudio do sistema
          </label>
        )}
        <p className={styles.controlsHint}>Dica: ao compartilhar com áudio do sistema seu microfone é desligado automaticamente para evitar eco.</p>
      </footer>
    </div>
  );
}
