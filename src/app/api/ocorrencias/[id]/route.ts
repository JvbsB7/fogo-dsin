import type { NextRequest } from 'next/server';
import { api, idDe, naoEncontrado } from '@/lib/server/api';
import { finalizarOcorrencia } from '@/lib/server/servicos';

// PATCH /api/ocorrencias/:id — encerra a ocorrência e libera o agente.
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const id = idDe((await params).id);
    const o = id ? finalizarOcorrencia(id) : null;
    return o ?? naoEncontrado('Ocorrência');
  });
}
