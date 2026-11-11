import { useCallback, useEffect, useRef, useState } from "react";

import { buildFfmpegArgs, outputFileName } from "@/lib/videoPresets";

/**
 * Orquestra o ffmpeg.wasm na thread principal e devolve o MP4 comprimido.
 *
 * Tudo acontece no navegador: o arquivo é escrito no sistema de arquivos
 * virtual do WebAssembly, encodado e lido de volta. Nenhum byte de vídeo vai
 * para o servidor — é o motivo de a ferramenta existir (comprimir vídeo de
 * centenas de MB sem depender de espaço, banda nem fila do servidor).
 *
 * O `import()` do pacote é dinâmico e acontece **dentro** da função, não no topo
 * do módulo: import estático arrastaria o `@ffmpeg/ffmpeg` para o bundle da
 * página, que é aberta por quem só quer ver o que a ferramenta faz.
 */

export const ENGINE_STATUS = {
  idle: "idle",
  loading: "loading",
  ready: "ready",
  error: "error",
};

/**
 * Os arquivos do ffmpeg.wasm ficam em `public/ffmpeg/` (copiados por
 * `scripts/sync-ffmpeg-core.js`) e são servidos com cache imutável
 * (`next.config.js`): 32 MB baixados uma vez por navegador, não a cada uso.
 *
 * `WORKER_URL` é obrigatório, e não um detalhe: o `new Worker(new URL(...))`
 * interno do pacote não é empacotado pelo Turbopack — o `worker.js` emitido
 * continua importando `./const.js`, que não existe em `/_next/static/media/`, e
 * o worker morre no primeiro import. Servindo os três arquivos juntos em
 * `public/ffmpeg/`, os imports relativos resolvem e `classWorkerURL` aponta
 * direto para o worker.
 */
const CORE_PATH = "/ffmpeg/ffmpeg-core.js";
const WASM_PATH = "/ffmpeg/ffmpeg-core.wasm";
const WORKER_PATH = "/ffmpeg/worker.js";

/**
 * As URLs precisam ser **absolutas**.
 *
 * O pacote faz `new Worker(new URL(classWorkerURL, import.meta.url))`: com um
 * caminho relativo, o `import.meta.url` do chunk empacotado faz a resolução
 * sair como `file:///ffmpeg/worker.js`, e o navegador recusa com "cannot be
 * accessed from origin http://...". Com `origin` na frente, o `new URL` interno
 * devolve a própria URL absoluta e nada é reinterpretado.
 */
function absolute(pathname) {
  return new URL(pathname, window.location.origin).href;
}

const INPUT_FILE = "input";
const OUTPUT_FILE = "output.mp4";

/** Erro do core vem como string; a mensagem final precisa dizer o que fazer. */
function describeError(rawError) {
  const message = String(rawError?.message ?? rawError ?? "");

  if (/out of memory|memory access out of bounds|Cannot enlarge memory/i.test(message)) {
    return "O navegador ficou sem memória para este vídeo. Tente um arquivo menor ou feche outras abas.";
  }
  if (/Failed to fetch|NetworkError|404/i.test(message)) {
    return "Não foi possível baixar o motor de compressão. Verifique a conexão e recarregue a página.";
  }
  if (/wasm-unsafe-eval|Refused to compile|WebAssembly\.CompileError|Content Security Policy|Worker.*blocked/i.test(message)) {
    return "O navegador bloqueou a compressão por política de segurança. Tente outro navegador ou avise o suporte.";
  }
  if (/Failed to construct 'Worker'|cannot be accessed from origin/i.test(message)) {
    return "Não foi possível iniciar o motor de compressão no navegador. Recarregue a página e tente de novo.";
  }
  if (/terminate|aborted|abort/i.test(message)) {
    return "A compressão foi interrompida.";
  }

  return message || "Não foi possível comprimir o vídeo.";
}

export default function useVideoCompressor() {
  const ffmpegRef = useRef(null);
  const objectUrlRef = useRef(null);
  const cancelledRef = useRef(false);
  const mountedRef = useRef(true);

  const [engineStatus, setEngineStatus] = useState(ENGINE_STATUS.idle);
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  /** Libera o `blob:` do resultado anterior — sem isso cada compressão vaza o MP4 inteiro. */
  const releaseResult = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setResult(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (ffmpegRef.current) {
        try {
          ffmpegRef.current.terminate();
        } catch {
          // Já encerrado — nada a fazer.
        }
        ffmpegRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const ensureEngine = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current;

    setEngineStatus(ENGINE_STATUS.loading);
    setError(null);

    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const ffmpeg = new FFmpeg();

    ffmpeg.on("progress", ({ progress: value }) => {
      if (!mountedRef.current) return;
      setProgress(Math.min(1, Math.max(0, Number(value) || 0)));
    });

    try {
      await ffmpeg.load({
        coreURL: absolute(CORE_PATH),
        wasmURL: absolute(WASM_PATH),
        classWorkerURL: absolute(WORKER_PATH),
      });
    } catch (loadError) {
      try {
        ffmpeg.terminate();
      } catch {
        // Worker pode nem ter sido criado.
      }
      throw loadError;
    }

    ffmpegRef.current = ffmpeg;
    setEngineStatus(ENGINE_STATUS.ready);
    return ffmpeg;
  }, []);

  const compress = useCallback(
    async ({ file, preset, plan }) => {
      if (!file) return null;

      cancelledRef.current = false;
      setIsCompressing(true);
      setError(null);
      setProgress(0);
      releaseResult();

      let ffmpeg = null;

      try {
        ffmpeg = await ensureEngine();

        // O MEMFS é um sistema de arquivos em memória: o arquivo inteiro é
        // copiado para lá. `writeFile` não aceita `File`, só `Uint8Array`.
        await ffmpeg.writeFile(INPUT_FILE, new Uint8Array(await file.arrayBuffer()));
        const args = buildFfmpegArgs({ input: INPUT_FILE, output: OUTPUT_FILE, plan, preset });

        const code = await ffmpeg.exec(args);
        if (code !== 0) throw new Error(`O ffmpeg terminou com código ${code}.`);

        const data = await ffmpeg.readFile(OUTPUT_FILE);
        if (typeof data === "string") throw new Error("Saída inesperada do ffmpeg.");

        const blob = new Blob([data], { type: "video/mp4" });
        if (blob.size === 0) throw new Error("O arquivo comprimido saiu vazio.");

        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        const compressed = { blob, url, bytes: blob.size, filename: outputFileName(file.name, preset.id) };
        setProgress(1);
        setResult(compressed);

        return compressed;
      } catch (thrown) {
        // Cancelar encerra o worker no meio do `exec`, o que rejeita a promise
        // com erro de terminação. Não é falha: é o usuário desistindo.
        if (!cancelledRef.current) setError(describeError(thrown));
        return null;
      } finally {
        if (ffmpeg) {
          // Sem isso a cópia em memória do original fica viva até a página
          // recarregar, e a segunda compressão estoura a memória do wasm.
          await Promise.allSettled([ffmpeg.deleteFile(INPUT_FILE), ffmpeg.deleteFile(OUTPUT_FILE)]);
        }
        if (mountedRef.current) setIsCompressing(false);
      }
    },
    [ensureEngine, releaseResult],
  );

  /**
   * Cancelar é `terminate()`: não existe interrupção graciosa do `exec` no
   * ffmpeg.wasm. O worker morre, a instância é descartada e a próxima
   * compressão cria outra — os 32 MB do core continuam no cache HTTP.
   */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setProgress(0);
    setIsCompressing(false);

    if (ffmpegRef.current) {
      try {
        ffmpegRef.current.terminate();
      } catch {
        // Já encerrado.
      }
      ffmpegRef.current = null;
    }
    setEngineStatus(ENGINE_STATUS.idle);
  }, []);

  const reset = useCallback(() => {
    releaseResult();
    setError(null);
    setProgress(0);
  }, [releaseResult]);

  return {
    compress,
    cancel,
    reset,
    engineStatus,
    isCompressing,
    progress,
    error,
    result,
  };
}
