const { planRepair } = require("../../../scripts/repair-migration-order");

/**
 * `planRepair` é o cérebro do `scripts/repair-migration-order.js`: decide
 * **quais** linhas de `pgmigrations` precisam de `run_on` novo e qual valor cada
 * uma recebe.
 *
 * O caso real está fixado aqui porque a operação é difícil de refazer à mão: o
 * banco tinha 97 migrations completas, mas 4 delas gravadas depois das
 * seguintes, e o `node-pg-migrate` passou a recusar todo `up` por causa da
 * ordem — mesmo sem faltar nada.
 */

/** 2026-10-27T23:45:51.244Z em segundos — o carimbo do primeiro bloco real. */
const START = Date.parse("2026-10-27T23:45:51.244Z") / 1000;
const LATE = Date.parse("2026-10-27T23:46:03.421Z") / 1000;

function byName(rows) {
  return new Map(rows.map((row) => [row.name, row.epoch]));
}

/** Aplica o plano em memória e devolve nome → `run_on` final. */
function applied(rows, plan) {
  const map = byName(rows);
  for (const change of plan.changes) map.set(change.name, change.toEpoch);
  return map;
}

function expectStrictlyIncreasing(files, map) {
  const ordered = files.map((name) => map.get(name));
  for (let index = 1; index < ordered.length; index += 1) {
    expect(ordered[index]).toBeGreaterThan(ordered[index - 1]);
  }
}

describe("planRepair — ordem das migrations", () => {
  test("Ordem já correta não gera mudança nenhuma", () => {
    const files = ["1779580800003_a", "1779580800004_b", "1779840000001_c"];
    const rows = files.map((name, index) => ({ id: index + 1, name, epoch: START + index }));

    const plan = planRepair({ files, rows });

    expect(plan.ok).toBe(true);
    expect(plan.changes).toHaveLength(0);
  });

  test("Caso real: bloco antigo gravado no fim é movido para o vão, sem tocar no resto", () => {
    // Espelho do local_db: 97 migrations, sendo 4 registradas às 23:46:03 e as
    // outras 93 às 23:45:51. A quantidade importa — o plano move o MENOR grupo,
    // que no banco real são justamente as 4.
    const early = Array.from({ length: 93 }, (_, index) => `17795808${String(index).padStart(5, "0")}_early-${index}`);
    const late = Array.from({ length: 4 }, (_, index) => `177984000000${index}_late-${index}`);

    const files = [...early.slice(0, 69), ...late, ...early.slice(69)];

    const earlyEpoch = new Map(early.map((name, index) => [name, START + index * 0.02]));
    const lateEpoch = new Map(late.map((name, index) => [name, LATE + index * 0.024]));

    const rows = [
      ...early.map((name, index) => ({ id: index + 1, name, epoch: earlyEpoch.get(name) })),
      ...late.map((name, index) => ({ id: 1000 + index, name, epoch: lateEpoch.get(name) })),
    ].sort((a, b) => a.epoch - b.epoch || a.id - b.id);

    const plan = planRepair({ files, rows });

    expect(plan.ok).toBe(true);
    // Exatamente as quatro fora de ordem — e não as 93 que já estavam certas.
    expect(plan.changes.map((change) => change.name)).toEqual(late);

    const map = applied(rows, plan);
    expectStrictlyIncreasing(files, map);

    // Encaixadas entre a early-68 e a early-69, que não foram tocadas.
    expect(map.get(late[0])).toBeGreaterThan(earlyEpoch.get(early[68]));
    expect(map.get(late[3])).toBeLessThan(earlyEpoch.get(early[69]));
  });

  test("Linha gravada primeiro e que pertence ao fim da lista também é encaixada", () => {
    const files = ["100_a", "200_b", "300_c"];
    const rows = [
      { id: 1, name: "300_c", epoch: START },
      { id: 2, name: "100_a", epoch: START + 1 },
      { id: 3, name: "200_b", epoch: START + 2 },
    ];

    const plan = planRepair({ files, rows });

    expect(plan.ok).toBe(true);
    expectStrictlyIncreasing(files, applied(rows, plan));
  });

  test("Vão apertado: distribui sem encostar nas vizinhas", () => {
    // Bloco de 2 linhas num vão de 1,5 ms — não cabe 1 ms por linha.
    const files = ["100_a", "200_b", "300_c", "400_d"];
    const rows = [
      { id: 1, name: "100_a", epoch: START },
      { id: 2, name: "400_d", epoch: START + 0.0015 },
      { id: 3, name: "200_b", epoch: START + 1 },
      { id: 4, name: "300_c", epoch: START + 2 },
    ];

    const plan = planRepair({ files, rows });

    expect(plan.ok).toBe(true);
    expectStrictlyIncreasing(files, applied(rows, plan));
  });

  test("Arquivo sem linha no banco não é reordenado — é pendência", () => {
    const files = ["100_a", "200_b"];
    const rows = [{ id: 1, name: "100_a", epoch: START }];

    const plan = planRepair({ files, rows });

    expect(plan.ok).toBe(false);
    expect(plan.missing).toEqual(["200_b"]);
    expect(plan.changes).toHaveLength(0);
  });

  test("Linha sem arquivo não é reordenada — precisa de decisão humana", () => {
    const files = ["100_a"];
    const rows = [
      { id: 1, name: "100_a", epoch: START },
      { id: 2, name: "999_apagada", epoch: START + 1 },
    ];

    const plan = planRepair({ files, rows });

    expect(plan.ok).toBe(false);
    expect(plan.extra).toEqual(["999_apagada"]);
  });
});
