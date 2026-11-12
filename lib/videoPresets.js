/**
 * Catálogo único de compressão de vídeo da ferramenta `/ferramentas/comprimir-video`.
 *
 * Módulo **puro** (não toca em DOM, `File` nem ffmpeg): a regra de "qual
 * resolução e qual bitrate para caber em X MB" é o que pode estar errado, e é
 * a única parte testável sem baixar 32 MB de WebAssembly. A página e o hook
 * `useVideoCompressor` só consomem o que está aqui.
 *
 * Cada preset declara um **alvo de tamanho**, não uma qualidade abstrata: o
 * motivo de existir da ferramenta é o limite de envio do WhatsApp e das redes
 * sociais, então é ele que manda. O preset `full-hd` é a exceção — usa CRF, que
 * é qualidade constante e tamanho imprevisível, para quem quer usar a
 * ferramenta como "o menor arquivo que ainda parece o original".
 */

/**
 * Teto de entrada. Não é o limite do ffmpeg (o WebAssembly tem ~2 GB de
 * endereçamento), é o do navegador: acima disso a memória do wasm derruba a
 * aba, e uma aba que morre no meio do encode é pior que uma recusa com
 * mensagem. Um celular típico aguenta bem menos — o aviso da página diz isso.
 */
export const MAX_INPUT_BYTES = 500 * 1024 * 1024;

/**
 * Piso de bitrate de vídeo. Um vídeo de 1 hora num alvo de 14 MB pediria
 * ~30 kbps, que é ilegível mesmo em 480p. Abaixo do piso o arquivo passa do
 * alvo — a página avisa em vez de entregar um resultado que não serve.
 */
export const MIN_VIDEO_KBPS = 150;

/**
 * `maxDimension` é o **lado maior**, não a largura: vídeo de celular em pé
 * (1080x1920) precisa reduzir a largura, e uma caixa `largura x altura` fixa
 * encolheria o retrato até virar miniatura.
 */
export const VIDEO_PRESETS = [
  {
    id: "whatsapp-status",
    label: "Status do WhatsApp",
    note: "Cabe no limite de 16 MB do status e do envio em conversa.",
    maxDimension: 480,
    targetBytes: 14 * 1024 * 1024,
    audioKbps: 64,
  },
  {
    id: "social",
    label: "Redes sociais (economia)",
    note: "Bom para feed, stories e para quem está com dados móveis.",
    maxDimension: 720,
    targetBytes: 24 * 1024 * 1024,
    audioKbps: 96,
  },
  {
    id: "whatsapp-document",
    label: "WhatsApp como documento",
    note: "Mais qualidade, ainda dentro do envio como arquivo (até 60 MB).",
    maxDimension: 1280,
    targetBytes: 60 * 1024 * 1024,
    audioKbps: 96,
  },
  {
    id: "full-hd",
    label: "Alta qualidade (Full HD)",
    note: "Qualidade constante (CRF 23); o tamanho final varia com o conteúdo.",
    maxDimension: 1920,
    crf: 23,
    audioKbps: 128,
  },
];

export const DEFAULT_VIDEO_PRESET = "whatsapp-status";

/** Lista de ids — usada em validação e nas `propTypes` de quem recebe o preset. */
export const VIDEO_PRESET_IDS = VIDEO_PRESETS.map((preset) => preset.id);

/**
 * Resolve um preset pelo id.
 *
 * Lança em id desconhecido pelo mesmo motivo de `getImagePreset`: cair num
 * padrão silencioso entregaria um arquivo com resolução e tamanho diferentes do
 * que a tela mostrou. Todos os usos são literais, então erro aqui é engano de
 * código.
 */
export function getVideoPreset(id) {
  const preset = VIDEO_PRESETS.find((item) => item.id === id);
  if (!preset) {
    throw new Error(`Preset de vídeo desconhecido: "${id}". Disponíveis: ${VIDEO_PRESET_IDS.join(", ")}.`);
  }
  return preset;
}

/** Arredonda para par. O `yuv420p` do H.264 guarda a cor em 2x2 e recusa ímpar. */
function toEven(value) {
  return Math.max(2, Math.round(value / 2) * 2);
}

/**
 * Encolhe para o lado maior caber em `maxDimension`, **sem ampliar**: vídeo que
 * já é menor fica como está (upscale só gastaria CPU e bytes).
 *
 * Devolve `null` sem dimensões válidas — quem lê metadados de `<video>` nem
 * sempre tem `videoWidth`/`videoHeight` (codec que o navegador não decodifica).
 */
export function scaleToFit(width, height, maxDimension) {
  const sourceWidth = Number(width);
  const sourceHeight = Number(height);

  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    return null;
  }
  if (!Number.isFinite(maxDimension) || maxDimension <= 0) return null;

  const longest = Math.max(sourceWidth, sourceHeight);
  const scale = longest <= maxDimension ? 1 : maxDimension / longest;

  return {
    width: toEven(sourceWidth * scale),
    height: toEven(sourceHeight * scale),
    scale,
  };
}

/**
 * Bitrate de vídeo (kbps) que faz o arquivo caber em `targetBytes`.
 *
 * O áudio entra na conta porque o total do arquivo é vídeo + áudio: ignorá-lo
 * estourava o alvo em ~1 MB por minuto no preset de 96 kbps.
 *
 * `sourceBytes` é o teto do **bitrate pedido**: comprimir não deve pedir mais
 * banda que o arquivo original já usa. Atenção: isso não garante um arquivo
 * final menor — em clipes muito curtos e já bem comprimidos, o piso do próprio
 * x264 (e o cabeçalho do MP4) faz a saída crescer mesmo pedindo 1 kbps. A tela
 * avisa quando o resultado fica maior que o original.
 */
export function videoBitrateForTarget({ targetBytes, durationSeconds, audioKbps = 0, sourceBytes = null }) {
  const duration = Number(durationSeconds);
  const target = Number(targetBytes);

  if (!Number.isFinite(duration) || duration <= 0) return null;
  if (!Number.isFinite(target) || target <= 0) return null;

  // bits → kbps: o alvo é em bytes, e 1 kbit = 1000 bits (é a unidade que o
  // ffmpeg usa em `-b:v`, não a base 1024 de tamanho de arquivo).
  const totalKbps = (target * 8) / 1000 / duration;
  const targetKbps = Math.max(MIN_VIDEO_KBPS, Math.floor(totalKbps - audioKbps));

  const sourceKbps = sourceBitrateForTarget({ sourceBytes, durationSeconds, audioKbps });
  if (sourceKbps === null) return targetKbps;

  return Math.max(1, Math.min(targetKbps, sourceKbps));
}

/** Bitrate de vídeo do arquivo original — o teto de qualquer reencode. */
function sourceBitrateForTarget({ sourceBytes, durationSeconds, audioKbps = 0 }) {
  const source = Number(sourceBytes);
  const duration = Number(durationSeconds);

  if (!Number.isFinite(source) || source <= 0) return null;
  if (!Number.isFinite(duration) || duration <= 0) return null;

  return Math.max(1, Math.floor((source * 8) / 1000 / duration - audioKbps));
}

/** Tamanho estimado do arquivo final, a partir dos bitrates escolhidos. */
export function estimateOutputBytes({ durationSeconds, videoKbps, audioKbps = 0 }) {
  const duration = Number(durationSeconds);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  return Math.round(((videoKbps + audioKbps) * 1000 * duration) / 8);
}

/**
 * Tudo que a tela precisa saber antes de encodar: resolução de saída, bitrate,
 * estimativa e se o resultado cabe no alvo do preset.
 *
 * `fitsTarget` falso existe porque o piso de bitrate pode estourar o alvo — é
 * melhor dizer "não cabe" do que gastar minutos de CPU para entregar um
 * arquivo que o WhatsApp recusa. `alreadyFits` é o caso oposto e mais comum do
 * que parece: vídeo que já está abaixo do limite não tem o que comprimir, e a
 * tela avisa em vez de prometer uma redução que não existe.
 */
export function planCompression({ width, height, durationSeconds, sourceBytes, preset }) {
  const scaled = scaleToFit(width, height, preset.maxDimension);
  const plan = {
    width: scaled ? scaled.width : null,
    height: scaled ? scaled.height : null,
    videoKbps: null,
    estimatedBytes: null,
    fitsTarget: true,
    alreadyFits: null,
    warning: null,
  };

  // CRF não gera tamanho previsível: é qualidade constante, e o arquivo pode
  // ficar maior que a origem se ela já estava muito comprimida.
  if (preset.crf) return plan;

  const videoKbps = videoBitrateForTarget({
    targetBytes: preset.targetBytes,
    durationSeconds,
    audioKbps: preset.audioKbps,
    sourceBytes,
  });

  if (videoKbps === null) {
    plan.warning = "Não foi possível ler a duração do vídeo, então o tamanho final não pode ser estimado.";
    return plan;
  }

  plan.videoKbps = videoKbps;
  plan.estimatedBytes = estimateOutputBytes({
    durationSeconds,
    videoKbps,
    audioKbps: preset.audioKbps,
  });
  plan.fitsTarget = plan.estimatedBytes <= preset.targetBytes;
  plan.alreadyFits = Number.isFinite(Number(sourceBytes)) && Number(sourceBytes) <= preset.targetBytes;

  if (!plan.fitsTarget) {
    plan.warning = "Este vídeo é longo demais para o alvo deste preset. Escolha um preset menor ou um trecho mais curto.";
  } else if (plan.alreadyFits) {
    plan.warning =
      "Este vídeo já está abaixo do limite deste preset — comprimir não vai reduzir o tamanho e o arquivo pode até ficar maior, porque o MP4 é recriado.";
  }

  return plan;
}

/**
 * Argumentos do ffmpeg — o contrato com o WebAssembly, e o que o teste fixa.
 *
 * Decisões que não são óbvias:
 * - `-map 0:a:0?` com `?`: vídeo sem faixa de áudio não pode falhar (o `-map`
 *   sem `?` aborta o encode inteiro quando o stream não existe).
 * - `-pix_fmt yuv420p` + `-profile:v main`: é o que faz o MP4 abrir no WhatsApp
 *   e no Windows. Vídeo de iPhone chega em HEVC/10 bits, e H.264 10 bits não
 *   toca em aparelho nenhum fora do navegador.
 * - `-movflags +faststart`: move o átomo `moov` para o começo, então a prévia
 *   começa antes do download terminar (no WhatsApp isso é a diferença entre
 *   enviar e "arquivo corrompido").
 * - `-map_metadata -1`: remove GPS, modelo do aparelho e data de captura. O
 *   arquivo vai ser enviado para terceiros; coordenada de onde a pessoa gravou
 *   não é informação que ela escolheu compartilhar.
 * - `-sn`: legenda embutida em MP4 quebra a reprodução em vários players.
 */
export function buildFfmpegArgs({ input, output, plan, preset }) {
  const args = ["-i", input, "-sn", "-map", "0:v:0", "-map", "0:a:0?"];

  args.push("-c:v", "libx264", "-preset", "veryfast", "-profile:v", "main", "-pix_fmt", "yuv420p");

  if (plan && plan.width && plan.height) {
    // `bicubic` (o padrão do swscale) e não `lanczos`: o lanczos é ~3x mais
    // caro e num downscale de 2x a diferença visual é imperceptível. Medido no
    // navegador, era a maior fatia do tempo de encode.
    args.push("-vf", `scale=${plan.width}:${plan.height}:flags=bicubic`);
  }

  if (preset.crf) {
    args.push("-crf", String(preset.crf));
  } else if (plan && plan.videoKbps) {
    // maxrate/bufsize limitam os picos: sem eles o x264 gasta o orçamento nos
    // primeiros segundos e o total passa do alvo.
    args.push("-b:v", `${plan.videoKbps}k`, "-maxrate", `${Math.round(plan.videoKbps * 1.2)}k`, "-bufsize", `${Math.round(plan.videoKbps * 2)}k`);
  }

  args.push("-c:a", "aac", "-b:a", `${preset.audioKbps}k`, "-ac", "2");
  args.push("-map_metadata", "-1", "-movflags", "+faststart", "-y", output);

  return args;
}

/** Nome do arquivo baixado: mantém o nome original, com o preset no fim. */
export function outputFileName(originalName, presetId) {
  const withoutExtension = String(originalName || "").replace(/\.[^./\\]+$/, "");
  const safe = withoutExtension
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${safe || "video"}-${presetId}.mp4`;
}

/** `95` → `"1:35"`, `3725` → `"1:02:05"` (mesmo formato do player de vídeo). */
export function formatDuration(seconds) {
  const total = Math.round(Number(seconds));
  if (!Number.isFinite(total) || total <= 0) return "0:00";

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const pad = (value) => String(value).padStart(2, "0");

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}
