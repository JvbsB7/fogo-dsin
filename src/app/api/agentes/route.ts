import type { NextRequest } from 'next/server';
import { api, corpoJson, invalido, lista } from '@/lib/server/api';
import { listarAgentes, matriculaEmUso } from '@/lib/server/repo';
import { criarAgente } from '@/lib/server/servicos';
import { validarAgente } from '@/lib/validacao';

export async function GET(req: NextRequest) {
  return api(() => {
    const sp = req.nextUrl.searchParams;
    return listarAgentes({ regiao: lista(sp, 'regiao'), status: lista(sp, 'status'), funcao: lista(sp, 'funcao'), busca: sp.get('busca') ?? undefined });
  });
}

export async function POST(req: NextRequest) {
  return api(async () => {
    const corpo = await corpoJson(req);
    if (!corpo) return invalido({}, 'Corpo da requisição deve ser um JSON.');
    const v = validarAgente(corpo);
    if (!v.ok) return invalido(v.campos);
    if (matriculaEmUso(v.dado.matricula)) return invalido({ matricula: 'Matrícula já cadastrada' });
    return Response.json(criarAgente(v.dado), { status: 201 });
  });
}
