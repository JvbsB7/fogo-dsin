// Serviço de previsões: lê o banco, alimenta as funções puras de ./predict e devolve
// resultados prontos para as telas, sempre acompanhados de "o que é", "com quais dados" e
// "como usar" — a explicação faz parte da entrega.
import { REGIOES, REGIAO_POR_CODIGO, TIPOS_POR_CODIGO } from '@/lib/catalog';
import { getDb } from './db';
import { analisarFluxoRadar, detectarPicoOcorrencias, semComunicacao, type Anomalia } from './predict/anomalias';
import { disponibilidadeDiaria, riscoDeFalha, taxasPorModelo, type EquipLeve, type EventoStatusLeve } from './predict/manutencao';
import { recomendarReforco, HORAS_AGENTE_POR_OCORRENCIA, MINIMO_POR_REGIAO, OCUPACAO_ALVO } from './predict/reforco';
import {
  matrizSemanal, preverProximasHoras, tendenciaSemanal, treinarModeloRisco, indiceRisco, nivelRisco,
  type ModeloRisco, type OcorrenciaLeve, OPCOES_PADRAO,
} from './predict/risco';
import { horaDaSemana } from './util';

const REGIOES_COD = REGIOES.map((r) => r.codigo);
const NOMES = Object.fromEntries(REGIOES.map((r) => [r.codigo, r.nome]));
const SEMANA = 7 * 86400000;

const cache = globalThis as unknown as { __fogoModelo?: { em: number; modelo: ModeloRisco } };

function ocorrenciasLeves(desde: number): OcorrenciaLeve[] {
  const linhas = getDb().prepare('SELECT regiao, inicio, gravidade FROM ocorrencias WHERE inicio >= ?').all(new Date(desde).toISOString()) as {
    regiao: string; inicio: string; gravidade: number;
  }[];
  return linhas.map((l) => ({ regiao: l.regiao, inicio: Date.parse(l.inicio), gravidade: l.gravidade }));
}

/** Modelo de risco treinado, reaproveitado por até 5 minutos. */
export function modeloRisco(agora = Date.now()) {
  const c = cache.__fogoModelo;
  if (c && agora - c.em < 5 * 60000) return c.modelo;
  const modelo = treinarModeloRisco(ocorrenciasLeves(agora - OPCOES_PADRAO.semanas * SEMANA), REGIOES_COD, agora);
  cache.__fogoModelo = { em: agora, modelo };
  return modelo;
}

export function invalidarModelo() {
  delete cache.__fogoModelo;
}

/**
 * Fator de infraestrutura por região: semáforos e radares fora do ar aumentam o risco.
 * 1 + 0,6 × (fração desses equipamentos indisponível). Ex.: metade parada → risco × 1,3.
 */
export function fatorInfraestrutura() {
  const linhas = getDb()
    .prepare(
      `SELECT regiao, SUM(CASE WHEN status != 'operacional' THEN 1 ELSE 0 END) AS fora, COUNT(*) AS total
       FROM equipamentos WHERE (tipo = 'semaforo' OR tipo LIKE 'radar_%') AND status IN ('operacional','mau_funcionamento','em_manutencao','furtado')
       GROUP BY regiao`,
    )
    .all() as { regiao: string; fora: number; total: number }[];
  const out: Record<string, number> = {};
  for (const r of REGIOES_COD) out[r] = 1;
  for (const l of linhas) out[l.regiao] = 1 + 0.6 * (l.total ? l.fora / l.total : 0);
  return out;
}

export function riscoAgora(agora = Date.now()) {
  const modelo = modeloRisco(agora);
  const infra = fatorInfraestrutura();
  const s = horaDaSemana(agora);
  return Object.fromEntries(
    REGIOES_COD.map((r) => {
      const indice = indiceRisco(modelo, r, s, infra[r]);
      return [r, { indice, nivel: nivelRisco(indice), esperadoHora: modelo.taxa[r][s] * infra[r], fatorInfra: infra[r] }];
    }),
  );
}

export function previsaoRisco(horas = 24, agora = Date.now()) {
  const modelo = modeloRisco(agora);
  const infra = fatorInfraestrutura();
  const proximas = preverProximasHoras(modelo, agora, horas, infra);
  const picos = REGIOES_COD.map((r) => {
    const top = [...proximas[r]].sort((a, b) => b.indice - a.indice)[0];
    return { regiao: r, nome: NOMES[r], ...top };
  }).sort((a, b) => b.indice - a.indice);
  const tendencias = tendenciaSemanal(ocorrenciasLeves(agora - 12 * SEMANA), REGIOES_COD, agora, 12).map((t) => ({ ...t, nome: NOMES[t.regiao] }));
  return {
    proximas,
    picos,
    tendencias,
    fatorInfra: infra,
    matriz: Object.fromEntries([['todas', matrizSemanal(modelo)], ...REGIOES_COD.map((r) => [r, matrizSemanal(modelo, r)])]),
    explicacao: {
      oQue: 'Índice de risco (0 a 100) e número esperado de ocorrências por região, hora a hora, nas próximas horas.',
      dados: `${modelo.amostras} ocorrências das últimas ${modelo.opcoes.semanas} semanas (tipo, gravidade, local e horário), ` +
        'mais a situação atual de semáforos e radares de cada região.',
      como: `Taxa de Poisson por região e hora da semana, com peso maior para semanas recentes (meia-vida de ${modelo.opcoes.meiaVidaSemanas} semanas) ` +
        'e suavização pela média da mesma hora do dia. O índice compara a taxa ponderada pela gravidade com o percentil 95 da cidade ' +
        'e sobe até 60% quando semáforos/radares da região estão fora do ar.',
      uso: 'Posicionar equipes antes dos horários críticos, programar manutenções nos horários de menor risco e priorizar regiões em alta.',
    },
  };
}

export function previsaoReforco(agora = Date.now()) {
  const modelo = modeloRisco(agora);
  const agentes = getDb().prepare('SELECT regiao, turno, status FROM agentes').all() as { regiao: string; turno: 'manha' | 'tarde' | 'noite'; status: string }[];
  const turnos = recomendarReforco(modelo, agentes, agora, fatorInfraestrutura(), 3);
  return {
    turnos: turnos.map((t) => ({
      ...t,
      linhas: t.linhas.map((l) => ({ ...l, nome: NOMES[l.regiao] })),
      sugestoes: t.sugestoes.map((s) => ({ ...s, deNome: NOMES[s.de], paraNome: NOMES[s.para] })),
    })),
    explicacao: {
      oQue: 'Quantos agentes cada região precisa nos próximos três turnos e de onde remanejar quem estiver sobrando.',
      dados: 'Ocorrências esperadas pelo modelo de risco + escala atual (turno e base de cada agente cadastrado).',
      como: `Agentes necessários = ocorrências esperadas × ${HORAS_AGENTE_POR_OCORRENCIA} horas-agente ÷ (horas do turno × ${OCUPACAO_ALVO * 100}% de ocupação-alvo), ` +
        `com mínimo de ${MINIMO_POR_REGIAO} por região. O restante do tempo é patrulha preventiva. ` +
        'O remanejamento tira de quem tem mais sobra para quem tem mais falta.',
      uso: 'Montar a escala do próximo turno e decidir deslocamentos antes do pico, não depois.',
    },
  };
}

function equipamentosLeves(): (EquipLeve & { ultimoSinal: string | null })[] {
  return (getDb()
    .prepare('SELECT id, tipo, marca, modelo, regiao, status, instalado_em, manutencao_proxima, numero_serie, bairro, ultimo_sinal FROM equipamentos')
    .all() as Record<string, string | number | null>[]).map((r) => ({
    id: r.id as number, tipo: r.tipo as string, marca: r.marca as string, modelo: r.modelo as string, regiao: r.regiao as string,
    status: r.status as string, instaladoEm: r.instalado_em as string | null, manutencaoProxima: r.manutencao_proxima as string | null,
    numeroSerie: r.numero_serie as string, bairro: r.bairro as string, ultimoSinal: r.ultimo_sinal as string | null,
  }));
}

// Todos os eventos: a reconstrução da situação num dia passado precisa saber o estado anterior à janela.
function eventosLeves(): EventoStatusLeve[] {
  return (getDb().prepare('SELECT equipamento_id, para, em FROM eventos_status').all() as { equipamento_id: number; para: string; em: string }[])
    .map((e) => ({ equipamentoId: e.equipamento_id, para: e.para, em: Date.parse(e.em) }));
}

export function previsaoManutencao(agora = Date.now()) {
  const equips = equipamentosLeves();
  const eventos = eventosLeves();
  const taxas = taxasPorModelo(equips, eventos, agora, 120);
  const riscos = riscoDeFalha(equips, taxas, agora, 7);
  const cidade = disponibilidadeDiaria(equips, eventos, agora, 30)[0];
  const regioes = disponibilidadeDiaria(equips, eventos, agora, 30, (e) => e.regiao).map((s) => ({ ...s, nome: NOMES[s.grupo] }));
  const falhasEsperadas = riscos.reduce((s, r) => s + r.probabilidade7d, 0);
  return {
    topRisco: riscos.slice(0, 15).map((r) => ({ ...r, tipoNome: TIPOS_POR_CODIGO[r.tipo]?.nome ?? r.tipo, regiaoNome: NOMES[r.regiao] })),
    falhasEsperadas7d: Math.round(falhasEsperadas * 10) / 10,
    modelos: taxas.filter((t) => t.equipamentos >= 2).slice(0, 12).map((t) => ({ ...t, tipoNome: TIPOS_POR_CODIGO[t.tipo]?.nome ?? t.tipo })),
    disponibilidade: { cidade, regioes },
    explicacao: {
      oQue: 'Chance de cada equipamento operacional falhar nos próximos 7 dias, modelos que falham acima da média e tendência da disponibilidade.',
      dados: `${eventos.length} mudanças de situação registradas (falhas, reparos, furtos), idade e calendário de manutenção de ${equips.length} equipamentos.`,
      como: 'Taxa de falhas por modelo (falhas ÷ tempo em operação, suavizada pela taxa esperada do tipo), ajustada por idade e por manutenção vencida; ' +
        'probabilidade = 1 − e^(−taxa × 7 dias). A disponibilidade diária é reconstruída do histórico e projetada por regressão linear.',
      uso: 'Antecipar manutenções preventivas dos equipamentos de maior risco, negociar garantia ou trocar modelos problemáticos e evitar que a disponibilidade caia.',
    },
  };
}

/** Risco de falha em 7 dias de um equipamento (null se não estiver operando). */
export function riscoFalhaDe(id: number, agora = Date.now()) {
  const equips = equipamentosLeves();
  const taxas = taxasPorModelo(equips, eventosLeves(), agora, 120);
  return riscoDeFalha(equips.filter((e) => e.id === id), taxas, agora, 7)[0] ?? null;
}

export function detectarAnomalias(agora = Date.now()): Anomalia[] {
  const modelo = modeloRisco(agora);
  const janela = 2;
  const desde = agora - janela * 3600000;
  const obs = Object.fromEntries(
    (getDb().prepare('SELECT regiao, COUNT(*) AS n FROM ocorrencias WHERE inicio >= ? GROUP BY regiao').all(new Date(desde).toISOString()) as { regiao: string; n: number }[]).map((r) => [r.regiao, r.n]),
  );
  const esp: Record<string, number> = {};
  for (const r of REGIOES_COD) {
    esp[r] = 0;
    for (let t = desde; t < agora; t += 3600000) esp[r] += modelo.taxa[r][horaDaSemana(t)] * Math.min(1, (agora - t) / 3600000);
  }
  const anomalias = detectarPicoOcorrencias(obs, esp, NOMES, janela);

  // Radares: fluxo das últimas horas x histórico.
  const db = getDb();
  const radares = db.prepare(`SELECT id, numero_serie, bairro, regiao FROM equipamentos WHERE tipo LIKE 'radar_%' AND status = 'operacional'`).all() as {
    id: number; numero_serie: string; bairro: string; regiao: string;
  }[];
  const leituras = db.prepare('SELECT hora, fluxo FROM leituras WHERE equipamento_id = ? AND hora >= ?');
  const desde14 = new Date(agora - 14 * 86400000).toISOString();
  for (const r of radares) {
    const serie = (leituras.all(r.id, desde14) as { hora: string; fluxo: number }[]).map((l) => ({ hora: Date.parse(l.hora), fluxo: l.fluxo }));
    const a = analisarFluxoRadar(serie, agora);
    if (a.quedaPersistente && a.ultima) {
      anomalias.push({
        tipo: 'queda_fluxo', severidade: 'alto', equipamentoId: r.id, regiao: r.regiao,
        titulo: `Radar ${r.numero_serie} contando poucos veículos`,
        explicacao: `Na última hora contou ${a.ultima.fluxo} veículos; o normal para esse horário é ~${Math.round(a.ultima.esperado)} ` +
          `(${Math.round(a.ultima.razao * 100)}% do esperado). O equipamento ainda responde, mas o sensor pode estar falhando — ` +
          'vale uma vistoria antes que pare de vez.',
      });
    } else if (a.fluxoAtipico && a.ultima) {
      anomalias.push({
        tipo: 'fluxo_atipico', severidade: 'medio', equipamentoId: r.id, regiao: r.regiao,
        titulo: `Fluxo atípico no radar ${r.numero_serie} (${r.bairro})`,
        explicacao: `Fluxo ${a.ultima.razao.toFixed(1)}× acima do normal: pode ser desvio de trânsito, evento ou bloqueio próximo.`,
      });
    }
  }

  const silencio = semComunicacao(
    equipamentosLeves().map((e) => ({ id: e.id, status: e.status, ultimoSinal: e.ultimoSinal, heartbeatSeg: TIPOS_POR_CODIGO[e.tipo]?.heartbeatSeg ?? 60 })),
    agora,
  );
  for (const e of silencio.slice(0, 20)) {
    const eq = db.prepare('SELECT numero_serie, tipo, bairro, regiao, ultimo_sinal FROM equipamentos WHERE id = ?').get(e.id) as Record<string, string>;
    const min = Math.round((agora - Date.parse(eq.ultimo_sinal)) / 60000);
    anomalias.push({
      tipo: 'sem_comunicacao', severidade: 'alto', equipamentoId: e.id, regiao: eq.regiao,
      titulo: `${TIPOS_POR_CODIGO[eq.tipo]?.nome ?? eq.tipo} ${eq.numero_serie} sem comunicação`,
      explicacao: `Consta como operacional, mas não envia sinal há ${min} min (${eq.bairro}). Pode ser queda de energia, rede ou furto.`,
    });
  }
  return anomalias;
}

export const nomeRegiao = (r: string) => REGIAO_POR_CODIGO[r]?.nome ?? r;
