import { useState, useRef, useEffect, useCallback } from "react";
import { Avatar, Textarea, Button, Stack, IconButton } from "@primer/react";
import { ImageIcon, TrashIcon, PlusIcon, XIcon, DeviceCameraIcon } from "@primer/octicons-react";
import Image from "next/image";
import styles from "./CreatePost.module.css";
import PropTypes from "prop-types";
import { useTagSuggest } from "@/context/dataHooks/UseTagSuggest";
import { compressImage } from "@/utils/imageCompression";
import ImageUploader from "@/components/ImageTools/ImageUploader/ImageUploader";

CreatePost.propTypes = {
  user: PropTypes.shape({
    avatar_image: PropTypes.string,
  }).isRequired,

  onPost: PropTypes.func.isRequired,
};

export default function CreatePost({ user, onPost }) {
  const [content, setContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [uploadPhase, setUploadPhase] = useState(null); // "compressing" | "uploading"
  const [progress, setProgress] = useState(null); // 0..100 enquanto envia
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  // O recorte (input, modal, fila) fica no ImageUploader; aqui só guardamos o
  // resultado. Os caminhos que não passam por um input de arquivo (webcam,
  // câmera do celular, colar da área de transferência) chamam `openCrop`.
  const uploaderRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Webcam state
  const [hasCamera, setHasCamera] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const [webcamStream, setWebcamStream] = useState(null);
  const [webcamError, setWebcamError] = useState(null);
  const [capturing, setCapturing] = useState(false);

  // Detect if device has a camera
  useEffect(() => {
    let cancelled = false;
    async function checkCamera() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const hasVideo = devices.some((d) => d.kind === "videoinput");
        setHasCamera(hasVideo);
      } catch {
        if (!cancelled) setHasCamera(false);
      }
    }
    checkCamera();
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll state
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  const match = content.match(/#(\w{2,})$/);
  const query = match ? match[1] : null;
  const { data: suggestions } = useTagSuggest(query);

  /** Recorte pronto do ImageUploader (preset `post`, 4:3 igual ao card). */
  const handleCropped = useCallback(({ blob, dataUrl }) => {
    setImageFile(blob);
    setImagePreview(dataUrl);
  }, []);

  /** Manda uma imagem que nasceu fora do input para o mesmo recorte. */
  const openCrop = useCallback((source) => {
    uploaderRef.current?.openWith(source);
  }, []);

  const handleCameraSelect = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) openCrop(file);
    },
    [openCrop],
  );

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          openCrop(blob);
        }
        break;
      }
    }
  };

  const addPollOption = () => {
    if (pollOptions.length < 10) setPollOptions([...pollOptions, ""]);
  };

  const removePollOption = (index) => {
    if (pollOptions.length <= 2) return;
    setPollOptions(pollOptions.filter((_, i) => i !== index));
  };

  const updatePollOption = (index, value) => {
    const updated = [...pollOptions];
    updated[index] = value;
    setPollOptions(updated);
  };

  const resetPoll = () => {
    setShowPoll(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
  };

  // ── Webcam helpers ──
  const startWebcam = useCallback(async () => {
    setWebcamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setWebcamStream(stream);
      setShowWebcam(true);
      // Deferred — video element mounts on next render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 60);
    } catch (err) {
      setWebcamError("Não foi possível acessar a câmera. Verifique as permissões.");
      console.error("Webcam error:", err);
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (webcamStream) {
      webcamStream.getTracks().forEach((t) => t.stop());
      setWebcamStream(null);
    }
    setShowWebcam(false);
    setWebcamError(null);
  }, [webcamStream]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setCapturing(true);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          openCrop(blob);
        }
        stopWebcam();
        setCapturing(false);
      },
      "image/jpeg",
      0.92,
    );
  }, [stopWebcam, openCrop]);

  const handleCameraClick = useCallback(() => {
    // Mobile: use native camera via capture attribute (more reliable)
    const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
    if (isTouch) {
      cameraInputRef.current?.click();
      return;
    }
    // Desktop: open webcam
    startWebcam();
  }, [startWebcam]);

  const handleSubmit = async () => {
    if (!content.trim() && !imageFile && !showPoll) return;

    setIsPosting(true);
    setUploadPhase("compressing");
    setProgress(null);

    try {
      // Comprime a imagem antes do envio — fotos de celular chegam a vários MB.
      let fileToUpload = imageFile;
      if (imageFile) {
        fileToUpload = await compressImage(imageFile);
      }

      const formData = new FormData();
      formData.append("content", content);

      if (fileToUpload) {
        formData.append("file", fileToUpload);
      }

      if (showPoll && pollQuestion.trim()) {
        formData.append("poll_question", pollQuestion.trim());
        const validOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
        formData.append("poll_options", JSON.stringify(validOptions));
      }

      setUploadPhase("uploading");
      await onPost(content, fileToUpload, formData, setProgress);

      setContent("");
      setImagePreview(null);
      setImageFile(null);
      resetPoll();
    } catch (err) {
      console.error("Erro ao criar post:", err);
    } finally {
      setIsPosting(false);
      setUploadPhase(null);
      setProgress(null);
    }
  };

  let buttonLabel = "Postar";
  let progressText = null;
  if (isPosting) {
    if (uploadPhase === "compressing") {
      buttonLabel = "Comprimindo…";
      progressText = "Otimizando imagem…";
    } else if (progress != null) {
      buttonLabel = `Enviando ${progress}%`;
      progressText = `Enviando… ${progress}%`;
    } else {
      buttonLabel = "Postando...";
      progressText = "Enviando…";
    }
  }

  return (
    <div className={styles.container}>
      <ImageUploader ref={uploaderRef} preset="post" variant="none" onCropped={handleCropped} />

      <Stack direction="horizontal" gap={2} align="flex-start">
        <div className={styles.avatarRing}>
          <Avatar src={user.avatar_image || "/images/avatar.png"} size={40} />
        </div>

        <div className={styles.contentArea}>
          <Textarea
            placeholder="No que você está pensando?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handlePaste}
            disabled={isPosting}
            className={styles.textarea}
          />

          {suggestions?.length > 0 && (
            <ul className={styles.tagSuggest}>
              {suggestions.map((tag) => (
                <li key={tag.name}>
                  <button
                    type="button"
                    className={styles.tagSuggestItem}
                    onClick={() => setContent((prev) => prev.replace(/#\w*$/, `#${tag.name} `))}
                  >
                    #{tag.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* ─── Webcam capture ─── */}
          {showWebcam && (
            <div className={styles.webcamArea}>
              <div className={styles.webcamVideoWrap}>
                <video ref={videoRef} className={styles.webcamVideo} autoPlay playsInline muted />
                <canvas ref={canvasRef} style={{ display: "none" }} />
              </div>
              {webcamError && <p className={styles.webcamError}>{webcamError}</p>}
              <div className={styles.webcamActions}>
                <Button variant="primary" onClick={capturePhoto} disabled={capturing || !webcamStream}>
                  {capturing ? "…" : "Tirar foto"}
                </Button>
                <Button onClick={stopWebcam}>Cancelar</Button>
              </div>
            </div>
          )}

          {imagePreview && (
            <div className={styles.previewBox}>
              <Image src={imagePreview} alt="Pré-visualização da imagem" fill unoptimized sizes="320px" className={styles.previewImg} />

              <IconButton
                icon={TrashIcon}
                aria-label="Remover imagem"
                className={styles.removeImageBtn}
                onClick={() => {
                  // Limpa o arquivo também: antes só o preview saía de tela e a
                  // imagem ia no envio mesmo assim.
                  setImagePreview(null);
                  setImageFile(null);
                }}
              />
            </div>
          )}

          {/* ─── Poll Area ─── */}
          {showPoll && (
            <div className={styles.pollArea}>
              <input
                className={styles.pollInput}
                placeholder="Pergunta da enquete"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                disabled={isPosting}
              />

              {pollOptions.map((option, index) => (
                <div key={index} className={styles.pollOptionRow}>
                  <input
                    className={styles.pollInput}
                    placeholder={`Opção ${index + 1}`}
                    value={option}
                    onChange={(e) => updatePollOption(index, e.target.value)}
                    disabled={isPosting}
                  />
                  {pollOptions.length > 2 && (
                    <IconButton icon={XIcon} aria-label="Remover opção" size="small" variant="invisible" onClick={() => removePollOption(index)} />
                  )}
                </div>
              ))}

              {pollOptions.length < 10 && (
                <button type="button" className={styles.addOptionBtn} onClick={addPollOption} disabled={isPosting}>
                  <PlusIcon size={12} /> Adicionar opção
                </button>
              )}
            </div>
          )}

          {/* ─── Progresso do envio ─── */}
          {isPosting && (
            <div className={styles.progressWrap} role="status" aria-live="polite">
              <div className={styles.progressTrack}>
                <div
                  className={uploadPhase === "compressing" ? styles.progressFillIndeterminate : styles.progressFill}
                  style={uploadPhase === "uploading" && progress != null ? { width: `${progress}%` } : undefined}
                />
              </div>
              <span className={styles.progressLabel}>{progressText}</span>
            </div>
          )}

          <div className={styles.actionBar}>
            <Stack direction="horizontal" gap={1}>
              <IconButton icon={ImageIcon} aria-label="Adicionar imagem" onClick={() => uploaderRef.current?.open()} />

              {hasCamera && (
                <>
                  <IconButton icon={DeviceCameraIcon} aria-label="Tirar foto" onClick={handleCameraClick} />
                  {/* Input local porque precisa do atributo `capture` para abrir
                      a câmera no mobile; o arquivo cai no recorte do ImageUploader. */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCameraSelect}
                    className={styles.fileInput}
                  />
                </>
              )}

              <button
                type="button"
                className={`${styles.pollToggleBtn} ${showPoll ? styles.pollToggleActive : ""}`}
                onClick={() => setShowPoll(!showPoll)}
                disabled={isPosting}
              >
                Enquete
              </button>
            </Stack>

            <Button variant="primary" disabled={(!content.trim() && !imagePreview && !showPoll) || isPosting} onClick={handleSubmit}>
              {buttonLabel}
            </Button>
          </div>
        </div>
      </Stack>
    </div>
  );
}
