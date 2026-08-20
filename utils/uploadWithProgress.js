/**
 * Envia um `FormData` via XMLHttpRequest para obter o progresso do upload.
 *
 * `fetch` não expõe eventos de progresso de envio; XMLHttpRequest sim, o que
 * permite mostrar uma barra de progresso real e reduzir a sensação de espera
 * em conexões lentas.
 *
 * @param {string} url Endpoint de destino.
 * @param {{ body: FormData, onProgress?: (percent: number) => void, credentials?: string }} options
 * @returns {Promise<object|null>} Resposta JSON parseada.
 */
export function uploadWithProgress(url, { body, onProgress, credentials = "include" } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    if (credentials === "include") {
      xhr.withCredentials = true;
    }

    if (onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
    }

    xhr.addEventListener("load", () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(new Error(data?.message || `Falha ao publicar (${xhr.status})`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Erro de rede ao publicar.")));
    xhr.addEventListener("abort", () => reject(new Error("Publicação cancelada.")));

    xhr.send(body);
  });
}
