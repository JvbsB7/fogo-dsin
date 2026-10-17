import type { NextRequest } from 'next/server';
import { api, idDe, naoEncontrado } from '@/lib/server/api';
import { reconhecerAlerta } from '@/lib/server/servicos';

// PATCH /api/alertas/:id — operador reconhece (fecha) o alerta.
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const id = idDe((await params).id);
    const a = id ? reconhecerAlerta(id) : null;
    return a ?? naoEncontrado('Alerta');
  });
}
