import {
  BAIRROS, FUNCOES_AGENTE, MANUTENCAO_TIPOS, ORGAOS, REGIOES, STATUS_AGENTE, STATUS_EQUIPAMENTO, TIPOS_EQUIPAMENTO, TIPOS_OCORRENCIA, TURNOS,
} from '@/lib/catalog';

// Dados de referência para quem integrar com a API (as telas importam o catálogo direto).
export async function GET() {
  return Response.json({
    tiposEquipamento: TIPOS_EQUIPAMENTO.map(({ falhasAno: _f, marcas, ...t }) => ({ ...t, marcasSugeridas: Object.keys(marcas) })),
    statusEquipamento: STATUS_EQUIPAMENTO, manutencaoTipos: MANUTENCAO_TIPOS, orgaos: ORGAOS, funcoesAgente: FUNCOES_AGENTE,
    statusAgente: STATUS_AGENTE, turnos: TURNOS, tiposOcorrencia: TIPOS_OCORRENCIA, regioes: REGIOES, bairros: BAIRROS,
  });
}
