import type { NextRequest } from 'next/server';
import { api } from '@/lib/server/api';
import { previsaoRisco } from '@/lib/server/previsoes';

// GET /api/previsoes/risco?horas=24
export async function GET(req: NextRequest) {
  return api(() => previsaoRisco(Math.min(72, Math.max(1, Number(req.nextUrl.searchParams.get('horas') ?? 24)))));
}
