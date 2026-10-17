// Detecção de comportamentos fora do padrão — o que pode indicar um problema agora,
// antes de alguém reclamar.
import { partesLocais } from '../util';
import { mediana, poissonCaudaSuperior } from './estatistica';

export interface Anomalia {
  tipo: 'pico_ocorrencias' | 'queda_fluxo' | 'fluxo_atipico' | 'sem_comunicacao';
  severidade: 'critico' | 'alto' | 'medio';
  titulo: string;
  explicacao: string;
  regiao?: string;
  equipamentoId?: number;
  /** Quão improvável é isso acontecer por acaso (quando aplicável). */
  probabilidade?: number;
}

/**
 * Pico de ocorrências: compara o observado nas últimas horas com o esperado pelo modelo.
 * Se a chance de ver tantas ocorrências por acaso (Poisson) for < 1%, é anomalia.
 */
export function detectarPicoOcorrencias(observado: Record<string, number>, esperado: Record<string, number>, nomes: Record<string, string>, janelaHoras: number): Anomalia[] {
  const out: Anomalia[] = [];
  for (const regiao of Object.keys(esperado)) {
    const obs = observado[regiao] ?? 0;
    const esp = esperado[regiao];
    const p = poissonCaudaSuperior(obs, esp);
    if (obs >= 3 && p < 0.01) {
      out.push({
        tipo: 'pico_ocorrencias', severidade: p < 0.001 ? 'critico' : 'alto', regiao, probabilidade: p,
        titulo: `Pico de ocorrências — ${nomes[regiao] ?? regiao}`,
        explicacao: `${obs} ocorrências nas últimas ${janelaHoras}h, quando o normal para este dia e horário é ${esp.toFixed(1)}. ` +
          `A chance de isso ser acaso é de ${(p * 100).toFixed(p < 0.001 ? 3 : 2)}%.`,
      });
    }
  }
  return out;
}

export interface LeituraFluxo {
  /** epoch ms do início da hora */
  hora: number;
  fluxo: number;
}

/**
 * Queda de fluxo em radar: se nas últimas 3 horas o radar contou bem menos veículos do que
 * a mediana histórica daquela hora (dia útil x fim de semana), o sensor provavelmente está
 * falhando — mesmo que ainda responda "estou vivo".
 */
export function analisarFluxoRadar(serie: LeituraFluxo[], agora: number) {
  const corte = agora - 6 * 3600000;
  const historico = serie.filter((l) => l.hora < corte);
  const recentes = serie.filter((l) => l.hora >= agora - 3 * 3600000 - 1).sort((a, b) => a.hora - b.hora);
  const base = (t: number) => {
    const { hora, diaSemana } = partesLocais(t);
    const fds = diaSemana === 0 || diaSemana === 6;
    return mediana(
      historico
        .filter((l) => {
          const p = partesLocais(l.hora);
          return p.hora === hora && (p.diaSemana === 0 || p.diaSemana === 6) === fds;
        })
        .map((l) => l.fluxo),
    );
  };
  const razoes = recentes
    .map((l) => ({ hora: l.hora, fluxo: l.fluxo, esperado: base(l.hora) }))
    .filter((x) => x.esperado >= 30)
    .map((x) => ({ ...x, razao: x.fluxo / x.esperado }));
  const baixas = razoes.filter((x) => x.razao < 0.4).length;
  const altas = razoes.filter((x) => x.razao > 2.5).length;
  const ultima = razoes[razoes.length - 1];
  return { razoes, quedaPersistente: razoes.length >= 2 && baixas >= 2, fluxoAtipico: razoes.length >= 2 && altas >= 2, ultima };
}

export interface EquipamentoSinal {
  id: number;
  status: string;
  ultimoSinal: string | null;
  heartbeatSeg: number;
}

/** Equipamento "operacional" que parou de mandar sinal de vida (4 sinais perdidos, mínimo de 3 min). */
export function semComunicacao(equipamentos: EquipamentoSinal[], agora: number) {
  return equipamentos.filter((e) => {
    if (e.status !== 'operacional' || !e.ultimoSinal) return false;
    const limite = Math.max(3 * 60, e.heartbeatSeg * 4) * 1000;
    return agora - Date.parse(e.ultimoSinal) > limite;
  });
}
