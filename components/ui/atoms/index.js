/**
 * Átomos de UI: a menor unidade visual com significado próprio.
 *
 * Regra: átomo aqui é só o que carrega uma regra nossa — lógica de apresentação,
 * variantes ou acessibilidade (`BackLink`, `FormField`, `IconText`). O que o
 * Primer já entrega (`Button`, `Label`, `TextInput`, `Select`, `Textarea`,
 * `Flash`, `Spinner`, `Avatar`, `Dialog`) é usado direto, não reembrulhado.
 *
 * Os átomos de layout (`Stack`, `Inline`) e de título de bloco
 * (`SectionHeading`) nasceram na onda 0 da migração para Atomic Design
 * (`docs/migracao-atomic-design.md`): são a única forma de o espaçamento entre
 * blocos parar de ser decidido por cada página.
 */
export { default as Inline } from "./Inline/Inline";
export { default as SectionHeading } from "./SectionHeading/SectionHeading";
export { default as Stack } from "./Stack/Stack";
