import { api } from '@/lib/server/api';
import { listarAgentes, listarAlertas, listarEquipamentos, listarOcorrencias } from '@/lib/server/repo';
import { calcularResumo } from '@/lib/server/resumo';
import { simuladorAtivo } from '@/lib/server/simulador';

// Fotografia completa da operação, usada pela Central ao abrir (depois tudo chega pelo SSE).
export async function GET() {
  return api(() => ({
    equipamentos: listarEquipamentos(),
    agentes: listarAgentes(),
    ocorrencias: listarOcorrencias({ ativas: true }),
    alertas: listarAlertas({ abertos: true }),
    resumo: calcularResumo(),
    simulador: simuladorAtivo(),
  }));
}
