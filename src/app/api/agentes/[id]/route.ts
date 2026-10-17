import type { NextRequest } from 'next/server';
import { api, corpoJson, idDe, invalido, naoEncontrado } from '@/lib/server/api';
import { getDb } from '@/lib/server/db';
import { linhaParaOcorrencia, matriculaEmUso, obterAgente, obterEquipamento } from '@/lib/server/repo';
import { editarAgente, excluirAgente } from '@/lib/server/servicos';
import { validarAgente } from '@/lib/validacao';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  return api(async () => {
    const id = idDe((await params).id);
    const a = id ? obterAgente(id) : null;
    if (!a) return naoEncontrado('Agente');
    const atendimentos = (getDb().prepare('SELECT * FROM ocorrencias WHERE agente_id = ? ORDER BY inicio DESC LIMIT 10').all(a.id) as Record<string, unknown>[]).map(linhaParaOcorrencia);
    return { ...a, veiculo: a.equipamentoId ? obterEquipamento(a.equipamentoId) : null, atendimentos };
  });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  return api(async () => {
    const id = idDe((await params).id);
    if (!id || !obterAgente(id)) return naoEncontrado('Agente');
    const corpo = await corpoJson(req);
    if (!corpo) return invalido({}, 'Corpo da requisição deve ser um JSON.');
    const v = validarAgente(corpo);
    if (!v.ok) return invalido(v.campos);
    if (matriculaEmUso(v.dado.matricula, id)) return invalido({ matricula: 'Matrícula já cadastrada' });
    return editarAgente(id, v.dado);
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  return api(async () => {
    const id = idDe((await params).id);
    if (!id || !excluirAgente(id)) return naoEncontrado('Agente');
    return new Response(null, { status: 204 });
  });
}
