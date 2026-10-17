import type { NextRequest } from 'next/server';
import { api } from '@/lib/server/api';
import { listarAlertas } from '@/lib/server/repo';

// GET /api/alertas?abertos=1
export async function GET(req: NextRequest) {
  return api(() => listarAlertas({ abertos: req.nextUrl.searchParams.get('abertos') === '1', limite: 300 }));
}
