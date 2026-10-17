// Recomendação de reforço de agentes por região e turno.
//
// Para cada um dos próximos turnos, somamos as ocorrências esperadas (modelo de risco) em
// cada região e convertemos em agentes necessários. Comparamos com a escala real (agentes
// daquele turno lotados na região) e sugerimos remanejamentos das regiões com sobra para
// as com falta.
import { TURNOS, partesDoTurno, type Turno } from './turnos';
import type { ModeloRisco } from './risco';
import { horaDaSemana } from '../util';

// Premissas operacionais (ajustáveis): cada ocorrência ocupa uma dupla por ~1,5 h (3 horas-agente)
// e só 35% do turno deve ir para atendimento — o resto é patrulha preventiva e deslocamento.
export const HORAS_AGENTE_POR_OCORRENCIA = 3;
export const OCUPACAO_ALVO = 0.35;
/** Toda região mantém pelo menos uma dupla em serviço. */
export const MINIMO_POR_REGIAO = 2;

export interface AgenteEscala {
  regiao: string;
  turno: Turno;
  status: string;
}

export interface LinhaReforco {
  regiao: string;
  esperado: number;
  necessarios: number;
  escalados: number;
  saldo: number;
}

export interface TurnoReforco {
  turno: Turno;
  rotulo: string;
  inicio: string;
  fim: string;
  emAndamento: boolean;
  linhas: LinhaReforco[];
  sugestoes: { de: string; para: string; quantidade: number }[];
}

export function recomendarReforco(
  modelo: ModeloRisco,
  agentes: AgenteEscala[],
  agora: number,
  fatorInfra: Record<string, number> = {},
  quantosTurnos = 3,
): TurnoReforco[] {
  const out: TurnoReforco[] = [];
  let cursor = agora;
  for (let k = 0; k < quantosTurnos; k++) {
    const { turno, inicio, fim } = partesDoTurno(cursor);
    const emAndamento = k === 0;
    const linhas: LinhaReforco[] = modelo.regioes.map((regiao) => {
      // A escala é dimensionada para o turno inteiro, mesmo o que já está em andamento.
      let esperado = 0;
      for (let t = inicio; t < fim; t += 3600000) {
        esperado += modelo.taxa[regiao][horaDaSemana(t)] * (fatorInfra[regiao] ?? 1);
      }
      const horasTurno = (fim - inicio) / 3600000;
      const necessarios = Math.max(MINIMO_POR_REGIAO, Math.ceil((esperado * HORAS_AGENTE_POR_OCORRENCIA) / (horasTurno * OCUPACAO_ALVO)));
      const escalados = agentes.filter(
        (a) => a.regiao === regiao && a.turno === turno && (emAndamento ? a.status !== 'fora_de_servico' : true),
      ).length;
      return { regiao, esperado: Math.round(esperado * 10) / 10, necessarios, escalados, saldo: escalados - necessarios };
    });
    out.push({
      turno, rotulo: TURNOS.find((t) => t.codigo === turno)!.rotulo,
      inicio: new Date(inicio).toISOString(), fim: new Date(fim).toISOString(), emAndamento, linhas,
      sugestoes: sugerirRemanejamento(linhas),
    });
    cursor = fim + 1000;
  }
  return out;
}

/** Guloso: tira de quem tem mais sobra e dá para quem tem mais falta, sem deixar ninguém negativo. */
export function sugerirRemanejamento(linhas: LinhaReforco[]) {
  const sobra = linhas.filter((l) => l.saldo > 0).map((l) => ({ regiao: l.regiao, q: l.saldo })).sort((a, b) => b.q - a.q);
  const falta = linhas.filter((l) => l.saldo < 0).map((l) => ({ regiao: l.regiao, q: -l.saldo })).sort((a, b) => b.q - a.q);
  const sugestoes: { de: string; para: string; quantidade: number }[] = [];
  for (const f of falta) {
    for (const s of sobra) {
      if (!f.q) break;
      const q = Math.min(f.q, s.q);
      if (q > 0) {
        sugestoes.push({ de: s.regiao, para: f.regiao, quantidade: q });
        f.q -= q;
        s.q -= q;
      }
    }
  }
  return sugestoes;
}
