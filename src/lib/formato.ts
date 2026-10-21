// Formatação para as telas (datas no fuso de Marília, números em pt-BR).
const TZ = 'America/Sao_Paulo';

const fmtDataHora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtData = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const fmtNum = new Intl.NumberFormat('pt-BR');

export const dataHora = (iso: string | null | undefined) => (iso ? fmtDataHora.format(new Date(iso)) : '—');
export const hora = (iso: string | null | undefined) => (iso ? fmtHora.format(new Date(iso)) : '—');
/** Datas puras (AAAA-MM-DD) são exibidas sem conversão de fuso. */
export const data = (d: string | null | undefined) => (d ? fmtData.format(new Date(`${d}T00:00:00Z`)) : '—');
export const numero = (n: number) => fmtNum.format(n);
export const pct = (n: number, casas = 1) => `${n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

export function tempoRelativo(iso: string | null | undefined, agora = Date.now()) {
  if (!iso) return 'nunca';
  const s = Math.round((agora - Date.parse(iso)) / 1000);
  if (s < 0) return 'agora';
  if (s < 60) return `há ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

/** Hoje no fuso local, AAAA-MM-DD. */
export function hojeLocal(deslocamentoDias = 0) {
  return new Date(Date.now() - 3 * 3600000 + deslocamentoDias * 86400000).toISOString().slice(0, 10);
}

export function diasAte(d: string | null | undefined) {
  if (!d) return null;
  return Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${hojeLocal()}T00:00:00Z`)) / 86400000);
}
