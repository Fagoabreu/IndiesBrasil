/**
 * CPF: normalização, validação e formatação.
 *
 * ## Por que CPF é texto, e não número
 *
 * CPF é **documento**, não quantidade: `012.345.678-90` e `12.345.678-90` são
 * documentos diferentes, e guardar em coluna numérica apaga o zero à esquerda —
 * o registro passa a identificar outro CPF (ou nenhum). Foi exatamente o que
 * acontecia: `users.cpf` era `NUMERIC(11,0)`, então um CPF que começa com zero
 * era gravado com 10 dígitos e ficava impossível de casar de volta.
 *
 * A referência do próprio projeto é `organizations.cnpj VARCHAR(18)`
 * (`lib/cnpj.js`): documento se guarda como texto. Aqui a forma canônica é a dos
 * **11 dígitos**, sem máscara — é a mesma que o formulário de cadastro já enviava
 * e a que sobrevive a copiar/colar de qualquer origem.
 *
 * ## Onde cada função é usada
 *
 * - `normalizeCpf` — na **escrita** (`models/user.js`) e na **comparação**
 *   (`/api/v1/reset-password/request`), para que "012.345.678-90",
 *   "01234567890" e "012 345 678 90" sejam o mesmo valor;
 * - `isValidCpf` — no formulário (`pages/cadastro/index.jsx`). **Não** é aplicada
 *   no model de propósito: ver a nota em `models/user.js`;
 * - `formatCpf` — exibição com máscara (`000.000.000-00`).
 */

/** Quantidade de dígitos de um CPF. */
export const CPF_LENGTH = 11;

/**
 * Remove tudo que não for dígito.
 *
 * É a forma canônica: o que entra no banco e o que se compara. Aceitar máscara
 * na entrada não é conveniência — o usuário cola o CPF do documento ou de outro
 * sistema, e a máscara é a forma natural de escrever.
 *
 * @param {unknown} value
 * @returns {string} apenas os dígitos (pode ter qualquer comprimento)
 */
export function normalizeCpf(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * Valida um CPF pelo algoritmo oficial dos dígitos verificadores.
 *
 * Aceita com ou sem máscara. Rejeita sequências repetidas (`111.111.111-11`),
 * que passam no cálculo mas não são documentos válidos.
 *
 * @param {unknown} value
 * @returns {boolean} true se o CPF é válido
 */
export function isValidCpf(value) {
  const digits = normalizeCpf(value);

  if (digits.length !== CPF_LENGTH) return false;
  // Sequência de um dígito só passa no cálculo dos verificadores, mas não é
  // documento — é o caso do "11111111111" que todo formulário de teste usa.
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const checkDigit = (length) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) {
      sum += Number(digits[i]) * (length + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
}

/**
 * Aplica a máscara de exibição (`000.000.000-00`).
 *
 * Devolve o valor original quando não tem 11 dígitos, em vez de cortar ou
 * completar: exibir um documento parcialmente mascarado seria pior que exibir o
 * que está gravado.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function formatCpf(value) {
  const digits = normalizeCpf(value);
  if (digits.length !== CPF_LENGTH) return String(value ?? "");

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** Quantidade de dígitos esperada — usado nas validações de entrada. */
export function isCpfLength(digits) {
  return typeof digits === "string" && digits.length === CPF_LENGTH;
}

/**
 * Máscara **progressiva**, aplicada enquanto o usuário digita.
 *
 * Diferente de `formatCpf`, que só formata um CPF completo: aqui `"5299"` vira
 * `"529.9"` e `"52998224725"` vira `"529.982.247-25"`. É o que o campo do
 * formulário usa no `onChange` — usar `formatCpf` ali deixaria o campo sem
 * máscara até o décimo primeiro dígito.
 *
 * @param {unknown} value
 * @returns {string} no máximo 14 caracteres (11 dígitos + 3 separadores)
 */
export function maskCpfInput(value) {
  return normalizeCpf(value)
    .slice(0, CPF_LENGTH)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
