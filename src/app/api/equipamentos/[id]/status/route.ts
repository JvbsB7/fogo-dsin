import type { NextRequest } from 'next/server';
import { STATUS_CODIGOS, type StatusEquipamento } from '@/lib/catalog';
import { api, corpoJson, idDe, invalido, naoEncontrado } from '@/lib/server/api';
import { obterEquipamento } from '@/lib/server/repo';
import { alterarStatusEquipamento } from '@/lib/server/servicos';

// PATCH /api/equipamentos/:id/status  { "status": "furtado", "motivo": "constatado em vistoria" }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const id = idDe((await params).id);
    if (!id || !obterEquipamento(id)) return naoEncontrado('Equipamento');
    const corpo = await corpoJson(req);
    const status = String(corpo?.status ?? '') as StatusEquipamento;
    if (!STATUS_CODIGOS.includes(status)) return invalido({ status: 'Situação inválida' });
    const motivo = String(corpo?.motivo ?? '').trim() || 'alteração manual';
    return alterarStatusEquipamento(id, status, motivo);
  });
}
