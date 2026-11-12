import SeoHead from "@/components/SeoHead";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@primer/react";
import { DownloadIcon, SyncIcon, UploadIcon, VideoIcon } from "@primer/octicons-react";

import shared from "./toolPage.module.css";
import styles from "./comprimir-video.module.css";

import { SITE_URL } from "@/lib/seo";
import { formatBytesPtBr } from "@/lib/bytes";
import { downloadBlob } from "@/lib/download";
import { DEFAULT_VIDEO_PRESET, MAX_INPUT_BYTES, VIDEO_PRESETS, formatDuration, getVideoPreset, planCompression } from "@/lib/videoPresets";
import useVideoCompressor from "@/hooks/useVideoCompressor";

const PAGE_TITLE = "Comprimir Vídeo Online Grátis para WhatsApp e Redes Sociais | Indies Brasil";
const PAGE_DESCRIPTION =
  "Comprima vídeos direto no navegador para caber no limite do WhatsApp e das redes sociais. Escolha o tamanho final, baixe em MP4 e pronto — sem upload, sem cadastro.";
const PAGE_URL = `${SITE_URL}/ferramentas/comprimir-video`;
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Compressor de Vídeo — Indies Brasil",
  url: PAGE_URL,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  inLanguage: "pt-BR",
  description: PAGE_DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
  featureList: "comprimir video, reduzir video para whatsapp, converter para mp4, comprimir video sem upload",
};

export default function ComprimirVideo() {
  const inputRef = useRef(null);
  const objectUrlRef = useRef(null);

  const [file, setFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [meta, setMeta] = useState(null);
  const [presetId, setPresetId] = useState(DEFAULT_VIDEO_PRESET);
  const [fileError, setFileError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const { compress, cancel, reset, engineStatus, isCompressing, progress, error, result } = useVideoCompressor();

  const preset = getVideoPreset(presetId);
  // O resultado é de uma compressão passada: trocar o preset depois não pode
  // reescrever o "Destino" do arquivo que já está pronto.
  const resultPreset = getVideoPreset(result?.presetId ?? presetId);

  // `meta` vem do próprio `<video>`: codec que o navegador não decodifica deixa
  // os campos nulos, e a compressão continua possível (é o ffmpeg que decodifica).
  const plan = file
    ? planCompression({
        width: meta?.width,
        height: meta?.height,
        durationSeconds: meta?.duration,
        sourceBytes: file.size,
        preset,
      })
    : null;

  const releaseVideoUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setVideoUrl(null);
  }, []);

  useEffect(() => releaseVideoUrl, [releaseVideoUrl]);

  const acceptFile = useCallback(
    (selected) => {
      if (!selected) return;

      if (!selected.type.startsWith("video/")) {
        setFileError("Escolha um arquivo de vídeo (MP4, MOV, WEBM, MKV…).");
        return;
      }

      if (selected.size > MAX_INPUT_BYTES) {
        setFileError(
          `O arquivo tem ${formatBytesPtBr(selected.size)}. O limite desta ferramenta é ${formatBytesPtBr(MAX_INPUT_BYTES)} — acima disso o navegador fica sem memória no meio da compressão.`,
        );
        return;
      }

      setFileError(null);
      setMeta(null);
      reset();
      releaseVideoUrl();

      objectUrlRef.current = URL.createObjectURL(selected);
      setVideoUrl(objectUrlRef.current);
      setFile(selected);
    },
    [releaseVideoUrl, reset],
  );

  function handleInputChange(event) {
    acceptFile(event.target.files?.[0]);

    // Sem limpar, escolher o mesmo arquivo de novo não dispara `change`.
    event.target.value = "";
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragOver(false);
    acceptFile(event.dataTransfer.files?.[0]);
  }

  function handleClear() {
    reset();
    releaseVideoUrl();
    setFile(null);
    setMeta(null);
    setFileError(null);
  }

  const progressPercent = Math.round(progress * 100);
  const savedPercent = result && file ? Math.round((1 - result.bytes / file.size) * 100) : 0;
  // Reencodar um vídeo já bem comprimido pode aumentar o arquivo: o MP4 é
  // recriado do zero e o x264 tem um piso que não desce por bitrate.
  const resultGrew = Boolean(result && file && result.bytes >= file.size);
  const canCompress = Boolean(file) && !isCompressing;

  return (
    <div className={shared.container}>
      <SeoHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical={PAGE_URL} jsonLd={JSON_LD} />

      <header className={shared.pageHeader}>
        <h1 className={shared.pageTitle}>Comprimir Vídeo</h1>
        <p className={shared.pageSubtitle}>
          Reduza o vídeo para caber no limite do WhatsApp e das redes sociais. Tudo acontece no seu navegador — o arquivo não é enviado para servidor
          nenhum.
        </p>
      </header>

      <div className={shared.workspace}>
        {/* ── Original ── */}
        <section className={shared.panel}>
          <div className={shared.panelHeader}>
            <span className={shared.panelLabel}>
              <VideoIcon size={14} /> Seu vídeo
            </span>
            {file && (
              <Button size="small" variant="invisible" onClick={handleClear}>
                Trocar arquivo
              </Button>
            )}
          </div>

          {!file && (
            <label
              className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input ref={inputRef} type="file" accept="video/*" className={styles.hiddenInput} onChange={handleInputChange} />
              <span className={styles.dropzoneIcon}>
                <UploadIcon size={28} />
              </span>
              <span className={styles.dropzoneTitle}>Arraste um vídeo ou clique para escolher</span>
              <span className={styles.dropzoneHint}>MP4, MOV, WEBM, MKV — até {formatBytesPtBr(MAX_INPUT_BYTES)}</span>
            </label>
          )}

          {file && (
            <div className={styles.panelBody}>
              <video
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                className={styles.video}
                onLoadedMetadata={(event) => {
                  const element = event.currentTarget;
                  setMeta({
                    duration: Number.isFinite(element.duration) ? element.duration : null,
                    width: element.videoWidth,
                    height: element.videoHeight,
                  });
                }}
              />

              <dl className={styles.metaList}>
                <div className={styles.metaRow}>
                  <dt className={styles.metaTerm}>Arquivo</dt>
                  <dd className={styles.metaValue}>{file.name}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt className={styles.metaTerm}>Tamanho</dt>
                  <dd className={styles.metaValue}>{formatBytesPtBr(file.size)}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt className={styles.metaTerm}>Duração</dt>
                  <dd className={styles.metaValue}>{meta?.duration ? formatDuration(meta.duration) : "—"}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt className={styles.metaTerm}>Resolução</dt>
                  <dd className={styles.metaValue}>
                    {meta?.width ? `${meta.width} × ${meta.height}` : "—"}
                    {plan?.width ? ` → ${plan.width} × ${plan.height}` : ""}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {fileError && <p className={shared.errorBox}>{fileError}</p>}
        </section>

        {/* ── Resultado ── */}
        <section className={shared.panel}>
          <div className={shared.panelHeader}>
            <span className={shared.panelLabel}>Resultado</span>
            {result && (
              <span className={`${styles.savedChip} ${resultGrew ? styles.savedChipWarn : ""}`}>
                {resultGrew ? "maior que o original" : savedPercent > 0 ? `−${savedPercent}%` : "pronto"}
              </span>
            )}
          </div>

          {!result && !isCompressing && (
            <div className={shared.emptyOutput}>
              Escolha um vídeo, defina o destino e clique em comprimir. O resultado aparece aqui para conferir antes de baixar.
            </div>
          )}

          {isCompressing && (
            <div className={styles.progressWrap}>
              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-label="Progresso da compressão"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
              >
                <div className={styles.progressFill} style={{ width: `${Math.max(progressPercent, 2)}%` }} />
              </div>
              <p className={styles.progressStatus}>
                {progressPercent < 3 ? "Carregando o motor de compressão…" : `Comprimindo… ${progressPercent}%`}
              </p>
              <p className={styles.hint}>Pode deixar esta aba aberta: o vídeo não sai do navegador.</p>
              <Button variant="danger" onClick={cancel}>
                Cancelar
              </Button>
            </div>
          )}

          {result && (
            <div className={styles.panelBody}>
              <video src={result.url} controls playsInline className={styles.video} />

              <dl className={styles.metaList}>
                <div className={styles.metaRow}>
                  <dt className={styles.metaTerm}>Antes</dt>
                  <dd className={styles.metaValue}>{formatBytesPtBr(file.size)}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt className={styles.metaTerm}>Depois</dt>
                  <dd className={styles.metaValue}>{formatBytesPtBr(result.bytes)}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt className={styles.metaTerm}>Destino</dt>
                  <dd className={styles.metaValue}>
                    {resultPreset.label}
                    {resultPreset.targetBytes ? ` (alvo ${formatBytesPtBr(resultPreset.targetBytes)})` : ""}
                  </dd>
                </div>
              </dl>

              <div className={styles.actions}>
                <Button variant="primary" leadingVisual={DownloadIcon} onClick={() => downloadBlob(result.blob, result.filename)}>
                  Baixar {formatBytesPtBr(result.bytes)}
                </Button>
                <Button onClick={handleClear}>Comprimir outro vídeo</Button>
              </div>

              {resultGrew && (
                <p className={styles.warning}>
                  O arquivo de saída ficou maior que o original ({formatBytesPtBr(file.size)} → {formatBytesPtBr(result.bytes)}). O vídeo já estava
                  muito comprimido e o MP4 é recriado do zero — se o tamanho é o que importa, fique com o original.
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {error && <p className={shared.errorBox}>{error}</p>}

      {/* ── Presets ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Para onde você vai enviar?</h2>
        <p className={styles.sectionSubtitle}>O preset define o limite de tamanho. A resolução é reduzida só o necessário.</p>

        <div className={styles.presetGrid}>
          {VIDEO_PRESETS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`${styles.presetCard} ${option.id === presetId ? styles.presetCardActive : ""}`}
              aria-pressed={option.id === presetId}
              onClick={() => setPresetId(option.id)}
            >
              <span className={styles.presetName}>{option.label}</span>
              <span className={styles.presetBadge}>{option.targetBytes ? `até ${formatBytesPtBr(option.targetBytes)}` : `CRF ${option.crf}`}</span>
              <span className={styles.presetNote}>{option.note}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Ação e estimativa ── */}
      <section className={styles.section}>
        <div className={styles.estimateBox}>
          <div>
            <p className={styles.estimateLabel}>Estimativa de saída</p>
            <p className={styles.estimateValue}>
              {plan?.estimatedBytes
                ? `${formatBytesPtBr(plan.estimatedBytes)} · ${plan.width} × ${plan.height}`
                : preset.crf
                  ? `Qualidade constante · até ${preset.maxDimension}px`
                  : "Escolha um vídeo para estimar"}
            </p>
          </div>

          <Button variant="primary" leadingVisual={SyncIcon} onClick={() => compress({ file, preset, plan })} disabled={!canCompress}>
            {isCompressing ? "Comprimindo…" : "Comprimir vídeo"}
          </Button>
        </div>

        {plan?.warning && <p className={styles.warning}>{plan.warning}</p>}

        <p className={styles.hint}>
          Na primeira compressão o navegador baixa o motor de compressão (~32 MB). Ele fica em cache: as próximas são imediatas. Nenhum segundo do seu
          vídeo trafega pela internet.
          {engineStatus === "loading" ? " Carregando o motor…" : ""}
        </p>
      </section>
    </div>
  );
}
