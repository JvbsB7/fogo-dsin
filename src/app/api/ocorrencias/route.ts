import type { NextRequest } from 'next/server';
import { BAIRROS, OCORRENCIA_POR_CODIGO } from '@/lib/catalog';
import { api, corpoJson, invalido } from '@/lib/server/api';
import { listarOcorrencias } from '@/lib/server/repo';
import { registrarOcorrencia } from '@/lib/server/servicos';

// GET /api/ocorrencias?ativas=1&horas=24
export async function GET(req: NextRequest) {
  return api(() => {
    const sp = req.nextUrl.searchParams;
    const horas = Number(sp.get('horas') ?? 0);
    return listarOcorrencias({
      ativas: sp.get('ativas') === '1',
      desde: horas > 0 ? new Date(Date.now() - horas * 3600000).toISOString() : undefined,
      limite: Math.min(2000, Number(sp.get('limite') ?? 500)),
    });
  });
}

// POST /api/ocorrencias — registro manual pela Central (despacha o agente mais próximo).
export async function POST(req: NextRequest) {
  return api(async () => {
    const c = await corpoJson(req);
    const campos: Record<string, string> = {};
    const tipo = String(c?.tipo ?? '');
    if (!OCORRENCIA_POR_CODIGO[tipo]) campos.tipo = 'Tipo inválido';
    const bairro = BAIRROS.find((b) => b.nome === c?.bairro);
    if (!bairro) campos.bairro = 'Bairro inválido';
    const gravidade = Number(c?.gravidade ?? 1);
    if (![1, 2, 3].includes(gravidade)) campos.gravidade = 'Gravidade de 1 a 3';
    if (Object.keys(campos).length || !bairro) return invalido(campos);
    const lat = Number.isFinite(Number(c?.lat)) && c?.lat !== undefined ? Number(c.lat) : bairro.lat;
    const lng = Number.isFinite(Number(c?.lng)) && c?.lng !== undefined ? Number(c.lng) : bairro.lng;
    const o = registrarOcorrencia({
      tipo, gravidade: gravidade as 1 | 2 | 3, bairro: bairro.nome, regiao: bairro.regiao, lat, lng,
      inicio: new Date().toISOString(), origem: 'manual', equipamentoId: null, descricao: String(c?.descricao ?? '').trim() || OCORRENCIA_POR_CODIGO[tipo].rotulo,
    });
    return Response.json(o, { status: 201 });
  });
}
