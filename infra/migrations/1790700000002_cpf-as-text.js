/**
 * `users.cpf` passa de numérico para texto.
 *
 * ## O defeito
 *
 * A coluna nasceu `NUMERIC(11)`, e CPF é **documento**, não quantidade:
 *
 * 1. **Perda de zero à esquerda.** Um CPF como `012.345.678-90` era gravado como
 *    `1234567890` — 10 dígitos, outro documento. O `NUMERIC(11)` não guarda o
 *    zero: nenhum número guarda. Isso não é só exibição errada, é o registro
 *    apontando para um CPF que não é o do titular.
 * 2. **500 em entrada mascarada.** Como a coluna é numérica, um valor com pontos
 *    e hífen (`"012.345.678-90"`, que é como o CPF aparece no documento e como o
 *    usuário cola) faz o Postgres responder
 *    `invalid input syntax for type numeric` — erro 22P02 que vira
 *    `ServiceError` e responde 500 em vez de 400. Não havia validação de formato
 *    no servidor para recusar antes.
 * 3. **Comparação silenciosamente falsa.** O reset de senha confere o CPF com
 *    `===` entre o valor do banco (string, porque o driver devolve `NUMERIC` como
 *    texto) e o que o usuário digitou. Com máscara, a comparação nunca casa: a
 *    API responde a mensagem genérica de sucesso e **nenhum e-mail é enviado**.
 *    Era uma falha muda, que só se nota quando o e-mail não chega.
 *
 * A referência do próprio projeto é `organizations.cnpj VARCHAR(18)`, usada com
 * `lib/cnpj.js`: documento se guarda como texto. Esta migration alinha o CPF ao
 * mesmo critério.
 *
 * ## Como os dados existentes são corrigidos
 *
 * `lpad(cpf::text, 11, '0')`. A perda era **só** de zeros à esquerda — os
 * dígitos significativos ficaram intactos —, então completar com zeros até 11
 * restaura exatamente o valor original: `1234567890` volta a ser
 * `01234567890`. É correção, não conversão aproximada.
 *
 * Como o `ALTER` grava o valor transformado, a constraint `UNIQUE` é revalidada
 * automaticamente. Duas linhas que ficariam iguais não existem hoje (o
 * `NUMERIC` já as trataria como iguais), então não há risco de conflito — e se
 * houvesse, a migration falharia antes de deixar a tabela em estado ambíguo.
 */
exports.up = (pgm) => {
  pgm.alterColumn("users", "cpf", {
    type: "varchar(11)",
    // `USING` é obrigatório: sem ele o Postgres recusa a conversão implícita de
    // `numeric` para `varchar`. O `lpad` restaura os zeros à esquerda perdidos.
    using: "lpad(cpf::text, 11, '0')",
    notNull: true,
  });
};

/**
 * O `down` volta a coluna para numérico — e com isso **devolve o defeito**, o
 * que é o comportamento correto de um `down`: reverter a migration tem de
 * devolver o estado anterior. Os zeros à esquerda voltam a se perder, então
 * rode o `down` só para desfazer em ambiente de teste.
 */
exports.down = (pgm) => {
  pgm.alterColumn("users", "cpf", {
    type: "numeric(11)",
    using: "cpf::numeric",
    notNull: true,
  });
};
