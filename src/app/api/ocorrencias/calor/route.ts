import type { NextRequest } from 'next/server';
import { api } from '@/lib/server/api';
import { pesoOcorrencia } from '@/lib/server/config';
import { getDb } from '@/lib/server/db';

/** Lado da célula em graus (~450 m em Marília). */
const CELULA = 0.004;

// GET /api/ocorrencias/calor?dias=30 — ocorrências agrupadas numa grade para o mapa de calor
// da Central. Cada célula soma gravidade × peso (simuladas valem 1/aceleração, ver config.ts).
export async function GET(req: NextRequest) {
  return api(() => {
    const dias = Math.min(120, Math.max(1, Number(req.nextUrl.searchParams.get('dias') ?? 30)));
    const desde = new Date(Date.now() - dias * 86400000).toISOString();
    const linhas = getDb().prepare('SELECT lat, lng, gravidade, origem FROM ocorrencias WHERE inicio >= ?').all(desde) as {
      lat: number; lng: number; gravidade: number; origem: string;
    }[];
    const celulas = new Map<string, { i: number; j: number; valor: number; n: number }>();
    for (const l of linhas) {
      const i = Math.floor(l.lat / CELULA);
      const j = Math.floor(l.lng / CELULA);
      const c = celulas.get(`${i}:${j}`) ?? { i, j, valor: 0, n: 0 };
      c.valor += l.gravidade * pesoOcorrencia(l.origem);
      c.n += 1;
      celulas.set(`${i}:${j}`, c);
    }
    const lista = [...celulas.values()];
    const max = Math.max(...lista.map((c) => c.valor), 0.001);
    return {
      dias,
      total: linhas.length,
      celulas: lista.map((c) => ({
        sul: c.i * CELULA, oeste: c.j * CELULA, norte: (c.i + 1) * CELULA, leste: (c.j + 1) * CELULA,
        n: c.n, intensidade: Number((c.valor / max).toFixed(3)),
      })),
    };
  });
}
