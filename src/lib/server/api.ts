import { connection } from 'next/server';
import { prepararBanco } from './boot';

/**
 * Envolve um handler da API: aguarda a requisição (o better-sqlite3 é síncrono e, sem isso,
 * o Next poderia pré-renderizar a consulta no build), garante o banco e padroniza erros.
 */
export async function api<T>(fn: () => T | Promise<T>): Promise<Response> {
  await connection();
  try {
    prepararBanco();
    const r = await fn();
    return r instanceof Response ? r : Response.json(r);
  } catch (err) {
    console.error('[api]', err);
    return Response.json({ erro: 'Erro interno ao processar a requisição.' }, { status: 500 });
  }
}

export const naoEncontrado = (o = 'Registro') => Response.json({ erro: `${o} não encontrado.` }, { status: 404 });
export const invalido = (campos: Record<string, string>, erro = 'Verifique os campos destacados.') =>
  Response.json({ erro, campos }, { status: 400 });

export function idDe(valor: string) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Lê "a,b,c" (ou parâmetros repetidos) da query string como lista. */
export function lista(sp: URLSearchParams, nome: string) {
  const v = sp.getAll(nome).flatMap((x) => x.split(',')).map((x) => x.trim()).filter(Boolean);
  return v.length ? v : undefined;
}

export async function corpoJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
