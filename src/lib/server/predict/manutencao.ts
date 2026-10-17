// Previsão de falhas e tendência de disponibilidade dos equipamentos.
//
// - Taxa de falhas por modelo: falhas observadas / tempo em operação, suavizada pela taxa
//   esperada do tipo (para modelos com pouco histórico não parecerem perfeitos ou péssimos).
// - Probabilidade de falha nos próximos 7 dias: processo de Poisson com essa taxa, ajustada
//   por idade e por manutenção vencida.
// - Disponibilidade diária: reconstruída a partir do histórico de situações, com reta de
//   tendência e projeção para a próxima semana.
import { STATUS_EM_SERVICO, TIPOS_POR_CODIGO, type StatusEquipamento } from '@/lib/catalog';
import { regressaoLinear } from './estatistica';

const DIA = 86400000;
const FALHA: string[] = ['mau_funcionamento', 'furtado'];

export interface EquipLeve {
  id: number;
  tipo: string;
  marca: string;
  modelo: string;
  regiao: string;
  status: string;
  instaladoEm: string | null;
  manutencaoProxima: string | null;
  numeroSerie: string;
  bairro: string;
}

export interface EventoStatusLeve {
  equipamentoId: number;
  para: string;
  em: number;
}

export interface TaxaModelo {
  tipo: string;
  marca: string;
  modelo: string;
  equipamentos: number;
  falhas: number;
  exposicaoAnos: number;
  taxaAno: number;
  taxaTipo: number;
  razao: number;
}

/** Peso da taxa esperada do tipo, em anos-equipamento. */
const FORCA_PRIOR_ANOS = 1;

export function taxasPorModelo(equips: EquipLeve[], eventos: EventoStatusLeve[], agora: number, janelaDias = 120): TaxaModelo[] {
  const inicio = agora - janelaDias * DIA;
  const falhasPorEquip = new Map<number, number>();
  for (const ev of eventos) {
    if (ev.em >= inicio && FALHA.includes(ev.para)) falhasPorEquip.set(ev.equipamentoId, (falhasPorEquip.get(ev.equipamentoId) ?? 0) + 1);
  }
  const grupos = new Map<string, TaxaModelo>();
  for (const e of equips) {
    if (!e.instaladoEm || e.status === 'nao_instalado' || e.status === 'desativado') continue;
    const def = TIPOS_POR_CODIGO[e.tipo];
    const chave = `${e.tipo}|${e.marca}|${e.modelo}`;
    const g = grupos.get(chave) ?? { tipo: e.tipo, marca: e.marca, modelo: e.modelo, equipamentos: 0, falhas: 0, exposicaoAnos: 0, taxaAno: 0, taxaTipo: def?.falhasAno ?? 1, razao: 1 };
    const desde = Math.max(inicio, Date.parse(e.instaladoEm));
    g.equipamentos++;
    g.falhas += falhasPorEquip.get(e.id) ?? 0;
    g.exposicaoAnos += Math.max(0, agora - desde) / (365 * DIA);
    grupos.set(chave, g);
  }
  // Taxa real do tipo (observada), usada como referência justa na comparação entre modelos.
  const porTipo = new Map<string, { f: number; a: number }>();
  for (const g of grupos.values()) {
    const t = porTipo.get(g.tipo) ?? { f: 0, a: 0 };
    t.f += g.falhas;
    t.a += g.exposicaoAnos;
    porTipo.set(g.tipo, t);
  }
  return [...grupos.values()]
    .map((g) => {
      const prior = TIPOS_POR_CODIGO[g.tipo]?.falhasAno ?? 1;
      const taxaAno = (g.falhas + prior * FORCA_PRIOR_ANOS) / (g.exposicaoAnos + FORCA_PRIOR_ANOS);
      const t = porTipo.get(g.tipo)!;
      const taxaTipo = (t.f + prior * FORCA_PRIOR_ANOS) / (t.a + FORCA_PRIOR_ANOS);
      return { ...g, taxaAno, taxaTipo, razao: taxaTipo ? taxaAno / taxaTipo : 1, exposicaoAnos: Math.round(g.exposicaoAnos * 10) / 10 };
    })
    .sort((a, b) => b.razao - a.razao);
}

export interface RiscoFalha {
  id: number;
  numeroSerie: string;
  tipo: string;
  modelo: string;
  bairro: string;
  regiao: string;
  probabilidade7d: number;
  fatores: string[];
}

export function riscoDeFalha(equips: EquipLeve[], taxas: TaxaModelo[], agora: number, horizonteDias = 7): RiscoFalha[] {
  const porChave = new Map(taxas.map((t) => [`${t.tipo}|${t.marca}|${t.modelo}`, t]));
  const hoje = new Date(agora).toISOString().slice(0, 10);
  return equips
    .filter((e) => e.status === 'operacional')
    .map((e) => {
      const t = porChave.get(`${e.tipo}|${e.marca}|${e.modelo}`);
      let taxaAno = t?.taxaAno ?? TIPOS_POR_CODIGO[e.tipo]?.falhasAno ?? 1;
      const fatores: string[] = [];
      if (t && t.razao >= 1.4 && t.falhas >= 3) fatores.push(`modelo ${e.modelo} falha ${t.razao.toFixed(1)}× mais que a média do tipo`);
      const anos = e.instaladoEm ? (agora - Date.parse(e.instaladoEm)) / (365 * DIA) : 0;
      if (anos >= 3) fatores.push(`${anos.toFixed(1)} anos de uso`);
      taxaAno *= 1 + 0.1 * anos;
      if (e.manutencaoProxima && e.manutencaoProxima < hoje) {
        const atraso = (Date.parse(hoje) - Date.parse(e.manutencaoProxima)) / DIA;
        taxaAno *= 1 + Math.min(1.5, atraso / 30);
        fatores.push(`manutenção vencida há ${Math.round(atraso)} dias`);
      }
      const probabilidade7d = 1 - Math.exp(-(taxaAno / 365) * horizonteDias);
      return { id: e.id, numeroSerie: e.numeroSerie, tipo: e.tipo, modelo: e.modelo, bairro: e.bairro, regiao: e.regiao, probabilidade7d, fatores };
    })
    .sort((a, b) => b.probabilidade7d - a.probabilidade7d);
}

export interface SerieDisponibilidade {
  grupo: string;
  dias: { data: string; disponibilidade: number }[];
  inclinacaoPpDia: number;
  r2: number;
  projecao7d: number;
}

/**
 * Reconstrói a disponibilidade (operacionais / em serviço) no fim de cada dia, por grupo
 * (região ou cidade), a partir do histórico de mudanças de situação.
 */
export function disponibilidadeDiaria(
  equips: EquipLeve[],
  eventos: EventoStatusLeve[],
  agora: number,
  dias = 30,
  grupoDe: (e: EquipLeve) => string = () => 'cidade',
): SerieDisponibilidade[] {
  const porEquip = new Map<number, EventoStatusLeve[]>();
  for (const ev of eventos) {
    const l = porEquip.get(ev.equipamentoId) ?? [];
    l.push(ev);
    porEquip.set(ev.equipamentoId, l);
  }
  for (const l of porEquip.values()) l.sort((a, b) => a.em - b.em);
  const statusEm = (id: number, t: number): string | null => {
    const l = porEquip.get(id);
    if (!l) return null;
    let s: string | null = null;
    for (const ev of l) {
      if (ev.em > t) break;
      s = ev.para;
    }
    return s;
  };
  const grupos = new Map<string, { data: string; ok: number; total: number }[]>();
  for (let d = dias - 1; d >= 0; d--) {
    const t = d === 0 ? agora : agora - d * DIA;
    const data = new Date(t - 3 * 3600000).toISOString().slice(0, 10);
    const cont = new Map<string, { ok: number; total: number }>();
    for (const e of equips) {
      const s = statusEm(e.id, t) as StatusEquipamento | null;
      if (!s || !STATUS_EM_SERVICO.includes(s)) continue;
      const g = grupoDe(e);
      const c = cont.get(g) ?? { ok: 0, total: 0 };
      c.total++;
      if (s === 'operacional') c.ok++;
      cont.set(g, c);
    }
    for (const [g, c] of cont) {
      const l = grupos.get(g) ?? [];
      l.push({ data, ...c });
      grupos.set(g, l);
    }
  }
  return [...grupos.entries()].map(([grupo, l]) => {
    const serie = l.map((x) => ({ data: x.data, disponibilidade: x.total ? (100 * x.ok) / x.total : 100 }));
    const { inclinacao, intercepto, r2 } = regressaoLinear(serie.map((_, i) => i), serie.map((x) => x.disponibilidade));
    const projecao = Math.max(0, Math.min(100, intercepto + inclinacao * (serie.length - 1 + 7)));
    return { grupo, dias: serie.map((x) => ({ ...x, disponibilidade: Math.round(x.disponibilidade * 10) / 10 })), inclinacaoPpDia: Math.round(inclinacao * 100) / 100, r2: Math.round(r2 * 100) / 100, projecao7d: Math.round(projecao * 10) / 10 };
  });
}
