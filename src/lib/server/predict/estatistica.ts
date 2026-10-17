// Ferramentas estatísticas pequenas e sem dependências usadas pelo módulo preditivo.

export const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const media = (xs: number[]) => (xs.length ? soma(xs) / xs.length : 0);

export function mediana(xs: number[]) {
  if (!xs.length) return 0;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

export function quantil(xs: number[], q: number) {
  if (!xs.length) return 0;
  const o = [...xs].sort((a, b) => a - b);
  const pos = (o.length - 1) * q;
  const base = Math.floor(pos);
  const resto = pos - base;
  return o[base + 1] !== undefined ? o[base] + resto * (o[base + 1] - o[base]) : o[base];
}

/** P(X >= k) para X ~ Poisson(lambda): a chance de ver k ou mais eventos por acaso. */
export function poissonCaudaSuperior(k: number, lambda: number) {
  if (k <= 0) return 1;
  if (lambda <= 0) return 0;
  // 1 - P(X <= k-1), somando termos em escala log para não estourar.
  let termo = Math.exp(-lambda);
  let acumulada = termo;
  for (let i = 1; i < k; i++) {
    termo *= lambda / i;
    acumulada += termo;
  }
  return Math.max(0, 1 - acumulada);
}

/** Regressão linear simples (mínimos quadrados). */
export function regressaoLinear(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 2) return { inclinacao: 0, intercepto: ys[0] ?? 0, r2: 0 };
  const mx = media(xs);
  const my = media(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  const inclinacao = sxx ? sxy / sxx : 0;
  const intercepto = my - inclinacao * mx;
  const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
  return { inclinacao, intercepto, r2 };
}

/** Peso de decaimento exponencial: dados de `idade` atrás valem 0,5^(idade/meiaVida). */
export const pesoDecaimento = (idade: number, meiaVida: number) => Math.pow(0.5, idade / meiaVida);
