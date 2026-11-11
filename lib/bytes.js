/**
 * Formatação de tamanho de arquivo — usada por toda ferramenta que mostra
 * "antes → depois" (imagens para PDF, compressão de vídeo).
 *
 * Existe como módulo próprio porque a versão que estava dentro de
 * `pages/ferramentas/imagens-para-pdf.jsx` seria copiada na compressão de
 * vídeo, e duas cópias divergem em silêncio: basta uma arredondar diferente
 * para o número da tela não bater com o do download.
 */

const UNITS = ["B", "KB", "MB", "GB", "TB"];

/**
 * `1536` → `"1.5 KB"`. Usa base 1024, que é a que o sistema operacional mostra
 * na pasta de downloads — comparar com o explorador de arquivos é o que a
 * pessoa vai fazer depois de baixar.
 */
export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 B";

  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), UNITS.length - 1);
  const scaled = value / 1024 ** exponent;

  // Bytes não têm casa decimal; a partir de KB uma casa ajuda a comparar
  // (16,0 MB e 15,8 MB são "16 MB" os dois, e a diferença importa aqui).
  const decimals = exponent === 0 ? 0 : 1;
  return `${scaled.toFixed(decimals)} ${UNITS[exponent]}`;
}

/** `1536` → `"1,5 KB"`: mesma conta, com o separador decimal do pt-BR. */
export function formatBytesPtBr(bytes) {
  return formatBytes(bytes).replace(".", ",");
}
