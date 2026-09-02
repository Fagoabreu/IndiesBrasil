import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { ServiceError } from "@/infra/errors";

/* ================================================================
 * LiveKit (SFU auto-hospedado) — helpers SERVER-SIDE.
 *
 * Este arquivo NÃO deve ser importado por código de browser
 * (usa o SDK do servidor). O front-end importa `livekit-client`.
 * ================================================================ */

const DEFAULT_TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12h — janela generosa p/ agendadas

function getLiveKitEnv() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    throw new ServiceError({
      message: "LiveKit não está configurado no servidor.",
      action: "Defina LIVEKIT_URL, LIVEKIT_API_KEY e LIVEKIT_API_SECRET no ambiente.",
    });
  }

  return { url, apiKey, apiSecret };
}

/** URL ws/wss que o cliente (livekit-client) deve usar para conectar. */
function getServerUrl() {
  return getLiveKitEnv().url;
}

/** Converte wss://host → https://host (RoomServiceClient espera http). */
function toApiUrl(webSocketUrl) {
  return webSocketUrl.replace(/^wss?:\/\//, (scheme) => (scheme === "wss://" ? "https://" : "http://"));
}

/**
 * Gera um token de acesso para uma sala LiveKit.
 *
 * @param {object} params
 * @param {string} params.identity  Identidade única (ex.: "u:<userId>" ou "g:<guestKeyId>").
 * @param {string} params.name      Nome de exibição no participante.
 * @param {string} params.room      Nome da sala — usamos o código da reunião.
 * @param {string} [params.metadata] JSON com dados adicionais do participante.
 * @param {number} [params.ttlSeconds]
 */
async function createMeetingToken({ identity, name, room, metadata, ttlSeconds = DEFAULT_TOKEN_TTL_SECONDS }) {
  const { apiKey, apiSecret } = getLiveKitEnv();

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ttl: ttlSeconds,
    metadata,
  });

  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return at.toJwt();
}

function getRoomServiceClient() {
  const { url, apiKey, apiSecret } = getLiveKitEnv();
  return new RoomServiceClient(toApiUrl(url), apiKey, apiSecret);
}

/** Encerra a sala (derruba todos os participantes). Reunião encerrada/bloqueada. */
async function closeMeetingRoom(roomName) {
  const client = getRoomServiceClient();
  await client.deleteRoom(roomName);
}

/** Lista participantes ativos de uma sala (para depuração/administração). */
async function listRoomParticipants(roomName) {
  const client = getRoomServiceClient();
  return client.listParticipants(roomName);
}

const livekit = {
  createMeetingToken,
  getServerUrl,
  closeMeetingRoom,
  listRoomParticipants,
};

export default livekit;
