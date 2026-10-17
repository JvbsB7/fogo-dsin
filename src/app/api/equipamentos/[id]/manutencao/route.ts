import type { NextRequest } from 'next/server';
import { api, idDe, naoEncontrado } from '@/lib/server/api';
import { registrarManutencaoConcluida } from '@/lib/server/servicos';

// POST /api/equipamentos/:id/manutencao — registra manutenção concluída e agenda a próxima.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const id = idDe((await params).id);
    const e = id ? registrarManutencaoConcluida(id) : null;
    return e ?? naoEncontrado('Equipamento');
  });
}
