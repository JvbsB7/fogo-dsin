import type { NextRequest } from 'next/server';
import { api, corpoJson, invalido, lista } from '@/lib/server/api';
import { listarEquipamentos, numeroSerieEmUso } from '@/lib/server/repo';
import { criarEquipamento } from '@/lib/server/servicos';
import { validarEquipamento } from '@/lib/validacao';

// GET /api/equipamentos?tipo=camera,radar_velocidade&status=operacional&regiao=centro&bairro=...&orgao=...&busca=...
export async function GET(req: NextRequest) {
  return api(() => {
    const sp = req.nextUrl.searchParams;
    return listarEquipamentos({
      tipo: lista(sp, 'tipo'), status: lista(sp, 'status'), regiao: lista(sp, 'regiao'),
      bairro: lista(sp, 'bairro'), orgao: lista(sp, 'orgao'), busca: sp.get('busca') ?? undefined,
    });
  });
}

export async function POST(req: NextRequest) {
  return api(async () => {
    const corpo = await corpoJson(req);
    if (!corpo) return invalido({}, 'Corpo da requisição deve ser um JSON.');
    const v = validarEquipamento(corpo);
    if (!v.ok) return invalido(v.campos);
    if (numeroSerieEmUso(v.dado.numeroSerie)) return invalido({ numeroSerie: 'Número de série já cadastrado' });
    return Response.json(criarEquipamento(v.dado), { status: 201 });
  });
}
