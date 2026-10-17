import type { NextRequest } from 'next/server';
import { api, corpoJson, idDe, invalido, naoEncontrado } from '@/lib/server/api';
import { getDb } from '@/lib/server/db';
import { numeroSerieEmUso, obterEquipamento } from '@/lib/server/repo';
import { editarEquipamento, excluirEquipamento, historicoEquipamento } from '@/lib/server/servicos';
import { riscoFalhaDe } from '@/lib/server/previsoes';
import { validarEquipamento } from '@/lib/validacao';

type Ctx = { params: Promise<{ id: string }> };

// Ficha completa: dados, histórico de situação, fluxo das últimas 48h (radares),
// agente vinculado (viaturas) e risco previsto de falha.
export async function GET(_req: NextRequest, { params }: Ctx) {
  return api(async () => {
    const id = idDe((await params).id);
    const e = id ? obterEquipamento(id) : null;
    if (!e) return naoEncontrado('Equipamento');
    const leituras = e.tipo.startsWith('radar_')
      ? (getDb().prepare('SELECT hora, fluxo FROM leituras WHERE equipamento_id = ? AND hora >= ? ORDER BY hora').all(e.id, new Date(Date.now() - 48 * 3600000).toISOString()) as { hora: string; fluxo: number }[])
      : [];
    const agente = getDb().prepare('SELECT id, nome, matricula, status FROM agentes WHERE equipamento_id = ?').get(e.id) ?? null;
    const risco = riscoFalhaDe(e.id);
    return { ...e, historico: historicoEquipamento(e.id), leituras, agente, risco };
  });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  return api(async () => {
    const id = idDe((await params).id);
    if (!id || !obterEquipamento(id)) return naoEncontrado('Equipamento');
    const corpo = await corpoJson(req);
    if (!corpo) return invalido({}, 'Corpo da requisição deve ser um JSON.');
    const v = validarEquipamento(corpo);
    if (!v.ok) return invalido(v.campos);
    if (numeroSerieEmUso(v.dado.numeroSerie, id)) return invalido({ numeroSerie: 'Número de série já cadastrado' });
    return editarEquipamento(id, v.dado);
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  return api(async () => {
    const id = idDe((await params).id);
    if (!id || !excluirEquipamento(id)) return naoEncontrado('Equipamento');
    return new Response(null, { status: 204 });
  });
}
