/**
 * Validação de identificador UUID.
 *
 * Um valor que não é UUID faz o Postgres recusar a query, e o erro chega
 * envelopado pelo `infra/errors.js` como falha de serviço (500) em vez de "não
 * encontrado" — por isso a checagem acontece **antes** de consultar. Também é o
 * que impede um id com `/` ou `..` de virar caminho em URL montada no servidor.
 *
 * O padrão exige os bits de versão e variante (o 3º grupo começa com 1-5, o 4º
 * com 8/9/a/b), que é o que `gen_random_uuid()` — o default das chaves primárias
 * do projeto — produz.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Verdadeiro quando `value` é um UUID em forma canônica (com hífens). */
export function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
