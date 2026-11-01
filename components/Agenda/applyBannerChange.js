/**
 * Aplica a alteração de capa pendente depois que a criação/PATCH deu certo.
 *
 * A capa é o único campo do evento que **não** vai no corpo: o upload precisa de
 * um evento existente, porque a rota grava em `uploaded_images` com o id na
 * pasta. Por isso o formulário devolve `banner` como intenção
 * (`upload` | `external` | `removed` | `unchanged`) e a página executa aqui
 * depois — criar, editar pela agenda e editar pelo estúdio fazem o mesmo, e três
 * cópias divergiriam (uma delas já salvava a capa na hora, enquanto os outros
 * campos só valiam no "Salvar").
 *
 * @param {string} eventId — evento já criado/atualizado
 * @param {{ action: string, file?: File, externalUrl?: string }} banner
 */
export default async function applyBannerChange(eventId, banner) {
  if (!banner || banner.action === "unchanged") return;

  const endpoint = `/api/v1/events/${eventId}/banner`;

  if (banner.action === "removed") {
    await fetch(endpoint, { method: "DELETE", credentials: "include" });
    return;
  }

  if (banner.action === "external") {
    await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ external_url: banner.externalUrl?.trim() }),
    });
    return;
  }

  if (banner.action === "upload" && banner.file) {
    const formData = new FormData();
    formData.append("file", banner.file, "capa-evento.png");
    await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
  }
}
