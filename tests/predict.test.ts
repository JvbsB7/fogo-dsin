import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analisarFluxoRadar, detectarPicoOcorrencias, semComunicacao } from '@/lib/server/predict/anomalias';
import { media, mediana, poissonCaudaSuperior, regressaoLinear } from '@/lib/server/predict/estatistica';
import { disponibilidadeDiaria, riscoDeFalha, taxasPorModelo, type EquipLeve } from '@/lib/server/predict/manutencao';
import { recomendarReforco, sugerirRemanejamento } from '@/lib/server/predict/reforco';
import { nivelRisco, preverProximasHoras, tendenciaSemanal, treinarModeloRisco, type OcorrenciaLeve } from '@/lib/server/predict/risco';
import { partesDoTurno } from '@/lib/server/predict/turnos';
import { horaDaSemana } from '@/lib/server/util';

const HORA = 3600000;
const SEMANA = 7 * 24 * HORA;
// Segunda-feira, 12/10/2026, 12h em Marília (15h UTC).
const AGORA = Date.parse('2026-10-12T15:00:00Z');

describe('estatística', () => {
  it('cauda da Poisson bate com o valor analítico', () => {
    assert.ok(Math.abs(poissonCaudaSuperior(1, 1) - (1 - Math.exp(-1))) < 1e-12);
    assert.equal(poissonCaudaSuperior(0, 3), 1);
    assert.ok(poissonCaudaSuperior(10, 1) < 1e-6);
  });

  it('regressão linear recupera uma reta exata', () => {
    const r = regressaoLinear([0, 1, 2, 3], [1, 3, 5, 7]);
    assert.ok(Math.abs(r.inclinacao - 2) < 1e-12);
    assert.ok(Math.abs(r.intercepto - 1) < 1e-12);
    assert.ok(Math.abs(r.r2 - 1) < 1e-12);
  });

  it('média e mediana', () => {
    assert.equal(media([1, 2, 3, 6]), 3);
    assert.equal(mediana([5, 1, 3]), 3);
    assert.equal(mediana([4, 1, 3, 2]), 2.5);
  });
});

describe('modelo de risco', () => {
  // Toda segunda às 18h há 3 acidentes na região "a"; "b" tem 1 ocorrência espalhada por dia.
  const historico: OcorrenciaLeve[] = [];
  for (let w = 1; w <= 12; w++) {
    const segunda18h = Date.parse('2026-10-12T21:00:00Z') - w * SEMANA;
    for (let k = 0; k < 3; k++) historico.push({ regiao: 'a', inicio: segunda18h + k * 60000, gravidade: 3 });
    for (let d = 0; d < 7; d++) historico.push({ regiao: 'b', inicio: segunda18h - d * 24 * HORA - 5 * HORA, gravidade: 1 });
  }
  const modelo = treinarModeloRisco(historico, ['a', 'b'], AGORA);

  it('a hora com ocorrências recorrentes tem a maior taxa', () => {
    const s = horaDaSemana(Date.parse('2026-10-12T21:00:00Z'));
    const max = Math.max(...modelo.taxa.a);
    assert.equal(modelo.taxa.a[s], max);
    assert.ok(modelo.taxa.a[s] > 1.5, `taxa ${modelo.taxa.a[s]}`);
  });

  it('suavização não deixa horas sem histórico com taxa zero na hora do dia recorrente', () => {
    const terca18h = horaDaSemana(Date.parse('2026-10-13T21:00:00Z'));
    assert.ok(modelo.taxa.a[terca18h] > 0);
    assert.ok(modelo.taxa.a[terca18h] < modelo.taxa.a[horaDaSemana(Date.parse('2026-10-12T21:00:00Z'))]);
  });

  it('previsão das próximas horas aponta o pico das 18h como o mais arriscado', () => {
    const prox = preverProximasHoras(modelo, AGORA, 12);
    const pico = [...prox.a].sort((x, y) => y.indice - x.indice)[0];
    assert.equal(pico.hora, 18);
    assert.equal(pico.nivel, 'critico');
  });

  it('semanas recentes pesam mais (decaimento)', () => {
    const s = horaDaSemana(AGORA);
    const recente = treinarModeloRisco([{ regiao: 'a', inicio: AGORA - SEMANA + 60000, gravidade: 1 }], ['a'], AGORA);
    const antiga = treinarModeloRisco([{ regiao: 'a', inicio: AGORA - 10 * SEMANA + 60000, gravidade: 1 }], ['a'], AGORA);
    assert.ok(recente.taxa.a[s] > antiga.taxa.a[s]);
  });

  it('ocorrências com peso fracionado (simulador acelerado) não inflam a taxa', () => {
    const s = horaDaSemana(AGORA);
    const t0 = AGORA - SEMANA + 60000;
    const umaReal = treinarModeloRisco([{ regiao: 'a', inicio: t0, gravidade: 1 }], ['a'], AGORA);
    const trintaSimuladas = treinarModeloRisco(Array.from({ length: 30 }, (_, i) => ({ regiao: 'a', inicio: t0 + i, gravidade: 1, peso: 1 / 30 })), ['a'], AGORA);
    assert.ok(Math.abs(umaReal.taxa.a[s] - trintaSimuladas.taxa.a[s]) < 1e-9);
  });

  it('faixas do índice', () => {
    assert.equal(nivelRisco(10), 'baixo');
    assert.equal(nivelRisco(50), 'moderado');
    assert.equal(nivelRisco(70), 'alto');
    assert.equal(nivelRisco(90), 'critico');
  });

  it('tendência distingue alta, queda e estabilidade', () => {
    // `semanasAtras` = 0 é a semana mais recente.
    const gerar = (porSemana: (semanasAtras: number) => number) => {
      const occ: OcorrenciaLeve[] = [];
      for (let w = 0; w < 12; w++) for (let k = 0; k < porSemana(w); k++) occ.push({ regiao: 'x', inicio: AGORA - w * SEMANA - HORA - k * 1000, gravidade: 1 });
      return tendenciaSemanal(occ, ['x'], AGORA, 12)[0].direcao;
    };
    assert.equal(gerar((w) => 40 - 3 * w), 'alta');
    assert.equal(gerar((w) => 10 + 3 * w), 'queda');
    assert.equal(gerar(() => 20), 'estavel');
  });
});

describe('turnos e reforço', () => {
  it('turno da noite atravessa a meia-noite', () => {
    const t = partesDoTurno(Date.parse('2026-10-13T04:30:00Z')); // 01h30 local
    assert.equal(t.turno, 'noite');
    assert.equal(new Date(t.inicio).toISOString(), '2026-10-13T01:00:00.000Z'); // 22h local do dia 12
    assert.equal(new Date(t.fim).toISOString(), '2026-10-13T09:00:00.000Z'); // 06h local
  });

  it('remanejamento leva sobra para quem falta, sem deixar ninguém abaixo do necessário', () => {
    const s = sugerirRemanejamento([
      { regiao: 'centro', esperado: 1, necessarios: 2, escalados: 6, saldo: 4 },
      { regiao: 'leste', esperado: 4, necessarios: 5, escalados: 2, saldo: -3 },
      { regiao: 'norte', esperado: 2, necessarios: 3, escalados: 2, saldo: -1 },
    ]);
    assert.deepEqual(s, [
      { de: 'centro', para: 'leste', quantidade: 3 },
      { de: 'centro', para: 'norte', quantidade: 1 },
    ]);
  });

  it('reforço considera a escala de cada turno', () => {
    const occ: OcorrenciaLeve[] = [];
    for (let w = 1; w <= 8; w++) for (let h = 0; h < 24; h++) for (let k = 0; k < 2; k++) occ.push({ regiao: 'a', inicio: AGORA - w * SEMANA + h * HORA, gravidade: 1 });
    const modelo = treinarModeloRisco(occ, ['a', 'b'], AGORA);
    const turnos = recomendarReforco(modelo, [{ regiao: 'b', turno: 'manha', status: 'em_patrulha' }, { regiao: 'b', turno: 'manha', status: 'em_patrulha' }, { regiao: 'b', turno: 'manha', status: 'em_patrulha' }], AGORA);
    assert.equal(turnos.length, 3);
    const a = turnos[0].linhas.find((l) => l.regiao === 'a')!;
    assert.ok(a.necessarios > 2 && a.escalados === 0);
    assert.ok(turnos[0].sugestoes.some((x) => x.de === 'b' && x.para === 'a'));
  });
});

describe('anomalias', () => {
  it('pico improvável vira anomalia; variação normal não', () => {
    const r = detectarPicoOcorrencias({ a: 9, b: 2 }, { a: 1.5, b: 1.8 }, { a: 'A', b: 'B' }, 2);
    assert.equal(r.length, 1);
    assert.equal(r[0].regiao, 'a');
  });

  it('queda persistente de fluxo do radar é detectada', () => {
    const serie = [];
    const inicio = Math.floor(AGORA / HORA) * HORA - 14 * 24 * HORA;
    for (let t = inicio; t < AGORA - 3 * HORA; t += HORA) serie.push({ hora: t, fluxo: 500 });
    for (let t = AGORA - 3 * HORA; t < AGORA; t += HORA) serie.push({ hora: t, fluxo: 40 });
    const r = analisarFluxoRadar(serie, AGORA);
    assert.equal(r.quedaPersistente, true);
    const normal = analisarFluxoRadar(serie.map((l) => ({ ...l, fluxo: 500 })), AGORA);
    assert.equal(normal.quedaPersistente, false);
  });

  it('equipamento operacional sem sinal é apontado', () => {
    const r = semComunicacao(
      [
        { id: 1, status: 'operacional', ultimoSinal: new Date(AGORA - 20 * 60000).toISOString(), heartbeatSeg: 60 },
        { id: 2, status: 'operacional', ultimoSinal: new Date(AGORA - 30000).toISOString(), heartbeatSeg: 60 },
        { id: 3, status: 'desativado', ultimoSinal: new Date(AGORA - 99 * 60000).toISOString(), heartbeatSeg: 60 },
      ],
      AGORA,
    );
    assert.deepEqual(r.map((x) => x.id), [1]);
  });
});

describe('manutenção', () => {
  const eq = (id: number, modelo: string, extra: Partial<EquipLeve> = {}): EquipLeve => ({
    id, tipo: 'radar_velocidade', marca: 'M', modelo, regiao: 'centro', status: 'operacional', instaladoEm: '2024-01-01',
    manutencaoProxima: '2027-01-01', numeroSerie: `S${id}`, bairro: 'Centro', ...extra,
  });
  const equips = [eq(1, 'Bom'), eq(2, 'Bom'), eq(3, 'Ruim'), eq(4, 'Ruim', { manutencaoProxima: '2026-08-01' })];
  const eventos = [3, 3, 3, 4, 4, 4, 1].map((id, i) => ({ equipamentoId: id, para: 'mau_funcionamento', em: AGORA - (i + 1) * 86400000 * 5 }));

  it('modelo que falha mais tem razão acima de 1', () => {
    const t = taxasPorModelo(equips, eventos, AGORA, 120);
    const ruim = t.find((x) => x.modelo === 'Ruim')!;
    const bom = t.find((x) => x.modelo === 'Bom')!;
    assert.ok(ruim.razao > 1 && bom.razao < 1);
  });

  it('manutenção vencida e modelo ruim aumentam a chance de falha', () => {
    const t = taxasPorModelo(equips, eventos, AGORA, 120);
    const r = riscoDeFalha(equips, t, AGORA, 7);
    assert.equal(r[0].id, 4);
    assert.ok(r[0].fatores.some((f) => f.includes('manutenção vencida')));
    assert.ok(r[0].probabilidade7d > r[r.length - 1].probabilidade7d);
  });

  it('disponibilidade diária reconstrói o histórico', () => {
    const evs = [
      { equipamentoId: 1, para: 'operacional', em: AGORA - 40 * 86400000 },
      { equipamentoId: 2, para: 'operacional', em: AGORA - 40 * 86400000 },
      { equipamentoId: 2, para: 'mau_funcionamento', em: AGORA - 2.5 * 86400000 },
    ];
    const [serie] = disponibilidadeDiaria([eq(1, 'Bom'), eq(2, 'Bom')], evs, AGORA, 5);
    assert.deepEqual(serie.dias.map((d) => d.disponibilidade), [100, 100, 50, 50, 50]);
    assert.ok(serie.inclinacaoPpDia < 0);
  });
});
