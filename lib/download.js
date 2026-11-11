/**
 * Download de um Blob gerado no próprio navegador.
 *
 * O `a.click()` sintético é o único caminho que funciona para um arquivo que
 * nunca esteve no servidor e não tem URL pública (o `download` do `<a>` só vale
 * para `blob:` e `data:`). O `revokeObjectURL` vem depois do clique porque
 * revogar antes cancela o download em alguns navegadores.
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
