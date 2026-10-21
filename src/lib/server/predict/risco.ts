// Modelo de risco por região e hora da semana.
//
// Ideia: ocorrências de trânsito se comportam como um processo de Poisson cuja taxa
// depende de onde (região) e de quando (hora da semana: segunda 8h ≠ sábado 23h).
// Estimamos essa taxa a partir do histórico com dois cuidados:
//   1. Decaimento exponencial: semanas recentes pesam mais (meia-vida configurável), então o
//      modelo acompanha mudanças como um bairro que começou a crescer.
//   2. Suavização bayesiana: cada hora da semana tem poucas amostras; puxamos a estimativa
//      para a média daquela hora do dia na região, evitando picos falsos por acaso.
import { horaDaSemana } from '../util';
import { pesoDecaimento, quantil, regressaoLinear, media } from './estatistica';

export interface OcorrenciaLeve {
  regiao: string;
  /** epoch ms */
  inicio: number;
  gravidade: number;
  /** Quanto a ocorrência conta nas estatísticas (padrão 1; ver pesoOcorrencia). */
  peso?: number;
}

export interface OpcoesModelo {
  semanas: number;
  meiaVidaSemanas: number;
  /** Força da suavização (em "semanas equivalentes" de dados da média). */
  forcaPrior: number;
}

export const OPCOES_PADRAO: OpcoesModelo = { semanas: 16, meiaVidaSemanas: 4, forcaPrior: 4 };

export interface ModeloRisco {
  regioes: string[];
  /** Ocorrências esperadas por hora, índice [0..167] = hora da semana (domingo 0h = 0). */
  taxa: Record<string, number[]>;
  /** Mesma taxa ponderada pela gravidade (1 a 3). */
  taxaGravidade: Record<string, number[]>;
  /** Percentil 99 da taxa ponderada entre todas as regiões e horas: vira o "100" do índice. */
  referencia: number;
  geradoEm: number;
  opcoes: OpcoesModelo;
  amostras: number;
}

const SEMANA = 7 * 24 * 3600 * 1000;

export function treinarModeloRisco(ocorrencias: OcorrenciaLeve[], regioes: string[], agora: number, opcoes: OpcoesModelo = OPCOES_PADRAO): ModeloRisco {
  const { semanas, meiaVidaSemanas, forcaPrior } = opcoes;
  const num: Record<string, number[]> = {};
  const numG: Record<string, number[]> = {};
  for (const r of regioes) {
    num[r] = new Array(168).fill(0);
    numG[r] = new Array(168).fill(0);
  }
  let amostras = 0;
  for (const o of ocorrencias) {
    const idade = (agora - o.inicio) / SEMANA;
    if (idade < 0 || idade >= semanas || !num[o.regiao]) continue;
    const w = pesoDecaimento(idade, meiaVidaSemanas) * (o.peso ?? 1);
    const s = horaDaSemana(o.inicio);
    num[o.regiao][s] += w;
    numG[o.regiao][s] += w * o.gravidade;
    amostras += o.peso ?? 1;
  }
  // Cada hora da semana aparece uma vez por semana: a "exposição" é a soma dos pesos das semanas.
  let exposicao = 0;
  for (let j = 0; j < semanas; j++) exposicao += pesoDecaimento(j + 0.5, meiaVidaSemanas);

  const taxa: Record<string, number[]> = {};
  const taxaGravidade: Record<string, number[]> = {};
  for (const r of regioes) {
    const suavizar = (n: number[]) => {
      const bruta = n.map((v) => v / exposicao);
      // Prior: média da mesma hora do dia nos 7 dias da semana.
      const priorHora = Array.from({ length: 24 }, (_, h) => media([0, 1, 2, 3, 4, 5, 6].map((d) => bruta[d * 24 + h])));
      return n.map((v, s) => (v + forcaPrior * priorHora[s % 24]) / (exposicao + forcaPrior));
    };
    taxa[r] = suavizar(num[r]);
    taxaGravidade[r] = suavizar(numG[r]);
  }
  const todas = regioes.flatMap((r) => taxaGravidade[r]);
  return { regioes, taxa, taxaGravidade, referencia: quantil(todas, 0.99) || 1, geradoEm: agora, opcoes, amostras };
}

export type NivelRisco = 'baixo' | 'moderado' | 'alto' | 'critico';

export function nivelRisco(indice: number): NivelRisco {
  if (indice >= 85) return 'critico';
  if (indice >= 65) return 'alto';
  if (indice >= 40) return 'moderado';
  return 'baixo';
}

/** Índice 0–100: taxa ponderada pela gravidade relativa ao p95 da cidade, com fator de infraestrutura. */
export function indiceRisco(modelo: ModeloRisco, regiao: string, s: number, fatorInfra = 1) {
  return Math.min(100, Math.round((100 * modelo.taxaGravidade[regiao][s] * fatorInfra) / modelo.referencia));
}

export interface PontoPrevisao {
  inicio: string;
  hora: number;
  esperado: number;
  indice: number;
  nivel: NivelRisco;
}

/** Previsão hora a hora para as próximas `horas`, por região. */
export function preverProximasHoras(modelo: ModeloRisco, agora: number, horas: number, fatorInfra: Record<string, number> = {}) {
  const inicio = Math.floor(agora / 3600000) * 3600000;
  const out: Record<string, PontoPrevisao[]> = {};
  for (const r of modelo.regioes) {
    out[r] = [];
    for (let i = 0; i < horas; i++) {
      const t = inicio + i * 3600000;
      const s = horaDaSemana(t);
      const f = fatorInfra[r] ?? 1;
      const indice = indiceRisco(modelo, r, s, f);
      out[r].push({ inicio: new Date(t).toISOString(), hora: s % 24, esperado: modelo.taxa[r][s] * f, indice, nivel: nivelRisco(indice) });
    }
  }
  return out;
}

/** Matriz 7 x 24 (dia da semana x hora) de ocorrências esperadas — para o mapa de calor. */
export function matrizSemanal(modelo: ModeloRisco, regiao?: string) {
  const regs = regiao ? [regiao] : modelo.regioes;
  return Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => regs.reduce((s, r) => s + modelo.taxa[r][d * 24 + h], 0)),
  );
}

export interface TendenciaRegiao {
  regiao: string;
  semanal: number[];
  variacaoPctSemana: number;
  r2: number;
  direcao: 'alta' | 'estavel' | 'queda';
}

/** Contagem semanal das últimas `semanas` e inclinação da reta (variação % por semana). */
export function tendenciaSemanal(ocorrencias: OcorrenciaLeve[], regioes: string[], agora: number, semanas = 12): TendenciaRegiao[] {
  return regioes.map((regiao) => {
    const cont = new Array(semanas).fill(0);
    for (const o of ocorrencias) {
      if (o.regiao !== regiao) continue;
      const idx = semanas - 1 - Math.floor((agora - o.inicio) / SEMANA);
      if (idx >= 0 && idx < semanas) cont[idx] += o.peso ?? 1;
    }
    const { inclinacao, r2 } = regressaoLinear(cont.map((_, i) => i), cont);
    const m = media(cont) || 1;
    const variacao = (100 * inclinacao) / m;
    const direcao = r2 >= 0.3 && Math.abs(variacao) >= 2 ? (variacao > 0 ? 'alta' : 'queda') : 'estavel';
    return { regiao, semanal: cont.map((v) => Math.round(v)), variacaoPctSemana: Math.round(variacao * 10) / 10, r2: Math.round(r2 * 100) / 100, direcao };
  });
}
