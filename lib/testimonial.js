/**
 * Limites do depoimento do membro, compartilhados entre servidor e tela.
 *
 * Vive em `lib/` (módulo puro) porque o formulário precisa do mesmo número que
 * o model valida: importar `models/testimonial.js` de um componente traria o
 * pool do Postgres para o bundle do cliente. Duas cópias do limite divergem no
 * primeiro ajuste, e aí a tela deixa de contar o que o servidor aceita.
 */
export const MAX_TESTIMONIAL_CONTENT_LENGTH = 500;
export const MAX_TESTIMONIAL_ROLE_LENGTH = 80;

/** Mensagem única para o servidor e a tela quando já existe depoimento. */
export const TESTIMONIAL_ALREADY_EXISTS_MESSAGE = "Você já tem um depoimento publicado.";
export const TESTIMONIAL_ALREADY_EXISTS_ACTION = "Edite o depoimento existente em vez de enviar outro.";
