import { bancoVazio, getDb } from './db';
import { popularBanco } from './seed';
import { iniciarSimulador } from './simulador';

/** Garante que existe uma cidade para operar: na primeira execução, gera os dados de demonstração. */
export function prepararBanco() {
  getDb();
  if (bancoVazio()) {
    const s = popularBanco();
    console.log(`[fogo] banco criado com ${s.equipamentos} equipamentos, ${s.agentes} agentes e ${s.ocorrencias} ocorrências históricas`);
  }
}

export function iniciar() {
  prepararBanco();
  if (process.env.FOGO_SIMULADOR !== 'off') iniciarSimulador();
}
