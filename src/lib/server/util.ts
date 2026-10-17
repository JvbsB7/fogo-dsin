// Utilitários do servidor: gerador pseudoaleatório reprodutível e datas no fuso de Marília.

/** Mulberry32: gerador determinístico, para o seed gerar sempre a mesma cidade. */
export function criarRng(semente: number) {
  let a = semente >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next: rnd,
    int: (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min,
    pick: <T,>(lista: readonly T[]): T => lista[Math.floor(rnd() * lista.length)],
    chance: (p: number) => rnd() < p,
    /** Normal padrão (Box-Muller). */
    normal: () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd()),
    /** Amostra de Poisson (Knuth) — adequado para lambdas pequenos, como os daqui. */
    poisson: (lambda: number) => {
      if (lambda <= 0) return 0;
      const L = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= rnd();
      } while (p > L);
      return k - 1;
    },
  };
}
export type Rng = ReturnType<typeof criarRng>;

// Marília fica em UTC-3 o ano todo (sem horário de verão desde 2019).
const OFFSET_MS = -3 * 3600 * 1000;

export const agoraISO = () => new Date().toISOString();

/** Hora local (0–23) e dia da semana local (0 = domingo) de um instante. */
export function partesLocais(d: Date | string | number) {
  const t = new Date(typeof d === 'string' ? Date.parse(d) : d).getTime() + OFFSET_MS;
  const local = new Date(t);
  return { hora: local.getUTCHours(), diaSemana: local.getUTCDay(), data: local.toISOString().slice(0, 10) };
}

/** Índice de 0 a 167 da hora da semana (domingo 00h = 0). */
export function horaDaSemana(d: Date | string | number) {
  const { hora, diaSemana } = partesLocais(d);
  return diaSemana * 24 + hora;
}

/** Data local AAAA-MM-DD de hoje somada a n dias. */
export function dataLocal(deslocamentoDias = 0, base: Date = new Date()) {
  return partesLocais(base.getTime() + deslocamentoDias * 86400000).data;
}

export function diasEntre(dataA: string, dataB: string) {
  return Math.round((Date.parse(dataB) - Date.parse(dataA)) / 86400000);
}

/** Distância aproximada em metros (equirretangular — suficiente em escala de cidade). */
export function distanciaM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const x = ((lng2 - lng1) * Math.PI) / 180 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  const y = ((lat2 - lat1) * Math.PI) / 180;
  return Math.sqrt(x * x + y * y) * R;
}

export const arred = (v: number, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas;
