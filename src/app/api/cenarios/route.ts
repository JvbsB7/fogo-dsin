import type { NextRequest } from 'next/server';
import { api, corpoJson, invalido } from '@/lib/server/api';
import { CENARIOS, dispararCenario, type Cenario } from '@/lib/server/cenarios';

// GET /api/cenarios — cenários de demonstração disponíveis.
export async function GET() {
  return api(() => Object.entries(CENARIOS).map(([codigo, titulo]) => ({ codigo, titulo })));
}

// POST /api/cenarios { cenario } — provoca uma situação crítica para demonstrar a Central.
export async function POST(req: NextRequest) {
  return api(async () => {
    const c = String((await corpoJson(req))?.cenario ?? '');
    if (!(c in CENARIOS)) return invalido({ cenario: 'Cenário inválido' });
    return Response.json(dispararCenario(c as Cenario), { status: 201 });
  });
}
