/**
 * Organismos de UI: blocos de ecrã (cabeçalho, abas, listagem inteira) montados
 * com átomos e moléculas.
 *
 * O barril existe para esconder o caminho interno: mover ou dividir
 * `PageHeader/PageHeader.jsx` não obriga a tocar nas telas que o consomem —
 * todas importam de `@/components/ui/organisms`.
 */
export { default as PageHeader } from "./PageHeader/PageHeader";
export { default as PageShell } from "./PageShell/PageShell";
export { default as Section } from "./Section/Section";
export { default as TabBar } from "./TabBar/TabBar";
