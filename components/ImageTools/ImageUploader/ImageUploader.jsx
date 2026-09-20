"use client";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Button, IconButton } from "@primer/react";
import { PencilIcon } from "@primer/octicons-react";
import ImageCropModal from "@/components/ImageTools/ImageCropTool/ImageCropModal";
import { IMAGE_PRESET_NAMES } from "@/lib/image-presets";
import styles from "./ImageUploader.module.css";

/**
 * File/Blob → data URL.
 *
 * data URL (e não object URL) porque o preview gerado aqui é entregue à página,
 * que pode guardá-lo em estado — data URL não exige revogação nem quebra quando
 * o componente é remontado.
 */
function toDataUrl(source) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(source);
  });
}

/**
 * Ponto único de entrada de imagem no app: escolhe o arquivo, recorta no
 * formato do preset e entrega o resultado para a página.
 *
 * O que ele NÃO faz, de propósito: renderizar o preview da imagem salva e o
 * botão de remover. Isso é layout de cada tela (o avatar fica na moldura
 * circular, o banner ocupa a largura do card) e mover para cá obrigaria a
 * passar classes de fora para dentro. Aqui fica só o que era duplicado em
 * oito lugares: input oculto, FileReader, fila de recorte e o `ImageCropModal`.
 *
 * `preset` é a chave do catálogo em `lib/image-presets.js`, e é ele que garante
 * que o recorte tenha a mesma proporção com que a imagem é exibida.
 *
 * Três formas de disparar:
 *   - `variant="icon"` / `"button"` — gatilho pronto, para os casos comuns.
 *   - `children` como função — quando a tela tem gatilho próprio estilizado.
 *   - `ref` com `open()` / `openWith(source)` — quando a imagem nasce fora do
 *     input (webcam, colar da área de transferência, câmera do celular).
 */
const ImageUploader = forwardRef(function ImageUploader(
  { preset, variant = "icon", label = "Alterar imagem", onCropped, multiple = false, disabled = false, children },
  ref,
) {
  const inputRef = useRef(null);
  // Fila de recortes pendentes: com `multiple`, cada arquivo passa pelo modal
  // em sequência. Fica em ref (e não em estado) porque só é lida nos handlers.
  const queueRef = useRef([]);
  const [cropSrc, setCropSrc] = useState(null);
  // `key` do modal: sem isso, ao passar para o próximo arquivo o react-easy-crop
  // reaproveitaria o mesmo componente e o zoom/posição do anterior vazariam.
  const [cropToken, setCropToken] = useState(0);
  // Ligado enquanto `onCropped` está em curso (upload, gravação do blob):
  // evita disparar dois envios do mesmo gatilho.
  const [busy, setBusy] = useState(false);

  const isDisabled = disabled || busy;

  const open = useCallback(() => {
    // `isDisabled` (e não só `disabled`) para não abrir o seletor enquanto um
    // envio anterior ainda está em curso.
    if (isDisabled) return;
    inputRef.current?.click();
  }, [isDisabled]);

  const startCrop = useCallback((src) => {
    setCropSrc(src);
    setCropToken((token) => token + 1);
  }, []);

  const openWith = useCallback(
    async (source) => {
      if (disabled || !source) return;
      const dataUrl = typeof source === "string" ? source : await toDataUrl(source);
      queueRef.current = [];
      startCrop(dataUrl);
    },
    [disabled, startCrop],
  );
  /** Fecha o recorte atual e passa para o próximo da fila, se houver. */
  const advance = useCallback(() => {
    const [next, ...rest] = queueRef.current;
    queueRef.current = rest;
    if (next) startCrop(next);
    else setCropSrc(null);
  }, [startCrop]);

  async function handleInputChange(event) {
    const files = Array.from(event.target.files ?? []);
    // Zera o input para que o mesmo arquivo possa ser escolhido de novo.
    event.target.value = "";
    if (files.length === 0) return;

    const selected = multiple ? files : files.slice(0, 1);
    const dataUrls = await Promise.all(selected.map(toDataUrl));

    queueRef.current = dataUrls.slice(1);
    startCrop(dataUrls[0]);
  }

  async function handleConfirm(blob) {
    setCropSrc(null);
    if (blob) {
      // A página decide o destino: subir agora (upload imediato) ou guardar e
      // enviar no submit do formulário. Aqui só entregamos o resultado do
      // recorte; `busy` cobre o tempo que a página levar para consumi-lo.
      setBusy(true);
      try {
        await onCropped({ blob, dataUrl: await toDataUrl(blob), preset });
      } finally {
        setBusy(false);
      }
    }
    advance();
  }

  useImperativeHandle(ref, () => ({ open, openWith }), [open, openWith]);

  let trigger = null;
  if (typeof children === "function") {
    // `busy` permite ao gatilho próprio repetir o estado de envio (spinner)
    // sem que a página precise controlar isso.
    trigger = children({ open, openWith, disabled: isDisabled, busy });
  } else if (variant === "icon") {
    trigger = <IconButton icon={PencilIcon} size="small" variant="primary" aria-label={label} onClick={open} disabled={isDisabled} />;
  } else if (variant === "button") {
    trigger = (
      <Button size="small" variant="primary" onClick={open} disabled={isDisabled} loading={busy}>
        {label}
      </Button>
    );
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" multiple={multiple} className={styles.hiddenInput} onChange={handleInputChange} />

      {trigger}

      {cropSrc && <ImageCropModal key={cropToken} imageSrc={cropSrc} preset={preset} onConfirm={handleConfirm} onClose={advance} />}
    </>
  );
});

ImageUploader.displayName = "ImageUploader";

ImageUploader.propTypes = {
  /** Chave do catálogo em `lib/image-presets.js`. */
  preset: PropTypes.oneOf(IMAGE_PRESET_NAMES).isRequired,
  /** Gatilho pronto. Use `"none"` quando passar `children` ou usar só o `ref`. */
  variant: PropTypes.oneOf(["icon", "button", "none"]),
  label: PropTypes.string,
  /** `({ blob, dataUrl, preset }) => void | Promise<void>` */
  onCropped: PropTypes.func.isRequired,
  /** Aceita vários arquivos, recortando um de cada vez. */
  multiple: PropTypes.bool,
  disabled: PropTypes.bool,
  /** `({ open, openWith, disabled }) => node` — gatilho próprio. */
  children: PropTypes.func,
};

export default ImageUploader;
