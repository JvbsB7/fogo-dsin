import { api } from '@/lib/server/api';
import { detectarAnomalias } from '@/lib/server/previsoes';

export async function GET() {
  return api(() => ({
    anomalias: detectarAnomalias(),
    explicacao: {
      oQue: 'Comportamentos fora do padrão agora: picos de ocorrências, radares contando poucos veículos e equipamentos que pararam de responder.',
      dados: 'Ocorrências das últimas 2 horas x esperado pelo modelo; fluxo horário dos radares x mediana dos últimos 14 dias; sinal de vida (heartbeat) dos dispositivos.',
      como: 'Teste de Poisson (chance < 1% de ser acaso), razão fluxo/mediana abaixo de 40% em 2 das últimas 3 horas, e 4 sinais de vida perdidos.',
      uso: 'Agir antes da reclamação: vistoriar o radar que está morrendo, mandar equipe para o pico inesperado, checar furto do equipamento mudo.',
    },
  }));
}
