// Cenários de demonstração: provocam de propósito situações críticas para mostrar a Central
// reagindo em tempo real. Usam os mesmos serviços da API e do simulador, então o caminho
// (banco → motor de alertas → SSE → telas) é exatamente o de um evento real.
import { BAIRROS } from '@/lib/catalog';
import type { Equipamento } from '@/lib/types';
import { varreduraPeriodica } from './alertas';
import { publicar } from './bus';
import * as repo from './repo';
import { calcularResumo } from './resumo';
import { alterarStatusEquipamento, registrarOcorrencia } from './servicos';

export const CENARIOS = {
  semaforo: 'Semáforo apaga em horário de pico e causa acidente',
  furto: 'Câmera de videomonitoramento furtada',
  pico: 'Pico inesperado de ocorrências num bairro',
} as const;
export type Cenario = keyof typeof CENARIOS;

const sortear = <T,>(lista: T[]) => lista[Math.floor(Math.random() * lista.length)];
const perto = (e: Pick<Equipamento, 'lat' | 'lng'>) => ({ lat: e.lat + (Math.random() - 0.5) * 0.0008, lng: e.lng + (Math.random() - 0.5) * 0.0008 });

export function dispararCenario(c: Cenario): { titulo: string; equipamentoId?: number; ocorrenciaIds: number[] } {
  const inicio = new Date().toISOString();
  const resultado = ((): { titulo: string; equipamentoId?: number; ocorrenciaIds: number[] } => {
    switch (c) {
      case 'semaforo': {
        const s = sortear(repo.listarEquipamentos({ tipo: ['semaforo'], status: ['operacional'] }));
        if (!s) throw new Error('Nenhum semáforo operacional');
        alterarStatusEquipamento(s.id, 'mau_funcionamento', 'telemetria: controlador sem resposta (cenário de demonstração)');
        const o = registrarOcorrencia({
          tipo: 'acidente', gravidade: 3, bairro: s.bairro, regiao: s.regiao, ...perto(s), inicio, origem: 'manual', equipamentoId: s.id,
          descricao: `Colisão no cruzamento do semáforo ${s.numeroSerie} apagado (${s.logradouro})`,
        });
        return { titulo: CENARIOS.semaforo, equipamentoId: s.id, ocorrenciaIds: [o.id] };
      }
      case 'furto': {
        const cam = sortear(repo.listarEquipamentos({ tipo: ['camera'], status: ['operacional'] }));
        if (!cam) throw new Error('Nenhuma câmera operacional');
        alterarStatusEquipamento(cam.id, 'furtado', 'telemetria: sinal perdido e violação do gabinete (cenário de demonstração)');
        const o = registrarOcorrencia({
          tipo: 'vandalismo', gravidade: 2, bairro: cam.bairro, regiao: cam.regiao, ...perto(cam), inicio, origem: 'manual', equipamentoId: cam.id,
          descricao: `Furto da câmera ${cam.numeroSerie} (${cam.logradouro}, ${cam.referencia})`,
        });
        return { titulo: CENARIOS.furto, equipamentoId: cam.id, ocorrenciaIds: [o.id] };
      }
      case 'pico': {
        // Seis registros em poucos minutos num mesmo bairro: o teste de Poisson da varredura
        // deve apontar o pico como fora do padrão.
        const b = sortear(BAIRROS);
        const tipos = ['congestionamento', 'acidente', 'veiculo_quebrado', 'congestionamento', 'infracao_grave', 'acidente'];
        const ids = tipos.map((tipo, i) =>
          registrarOcorrencia({
            tipo, gravidade: tipo === 'acidente' ? 2 : 1, bairro: b.nome, regiao: b.regiao, ...perto(b),
            inicio: new Date(Date.now() - i * 60000).toISOString(), origem: 'manual', equipamentoId: null,
            descricao: `Registro ${i + 1} do pico em ${b.nome}`,
          }, i < 2).id,
        );
        return { titulo: `${CENARIOS.pico} (${b.nome})`, ocorrenciaIds: ids };
      }
    }
  })();
  varreduraPeriodica();
  publicar({ tipo: 'resumo', dado: calcularResumo() });
  return resultado;
}
