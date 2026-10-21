'use client';

// Estado da operação em tempo real. Uma única conexão SSE alimenta todas as telas:
// a Central, o inventário e a lista de agentes enxergam a mesma cidade, ao vivo.
import { create } from 'zustand';
import type { Agente, Alerta, Equipamento, EventoTempoReal, Ocorrencia, Resumo } from '@/lib/types';

type PorId<T> = Record<number, T>;

interface EstadoOperacao {
  equipamentos: PorId<Equipamento>;
  agentes: PorId<Agente>;
  ocorrencias: PorId<Ocorrencia>;
  alertas: PorId<Alerta>;
  resumo: Resumo | null;
  carregado: boolean;
  conectado: boolean;
  simulador: boolean;
  ultimaAtualizacao: number;
  /** Alertas críticos que chegaram e ainda não viraram notificação na tela. */
  novosCriticos: Alerta[];
  iniciar: () => () => void;
  recarregar: () => Promise<void>;
  aplicar: (e: EventoTempoReal) => void;
  consumirCriticos: () => Alerta[];
  /** Atualização otimista depois de uma ação feita na própria tela. */
  upsertEquipamento: (e: Equipamento) => void;
  upsertAgente: (a: Agente) => void;
  removerEquipamento: (id: number) => void;
  removerAgente: (id: number) => void;
}

const indexar = <T extends { id: number }>(lista: T[]) => Object.fromEntries(lista.map((x) => [x.id, x])) as PorId<T>;

let fonte: EventSource | null = null;
let assinantes = 0;

export const useOperacao = create<EstadoOperacao>((set, get) => ({
  equipamentos: {},
  agentes: {},
  ocorrencias: {},
  alertas: {},
  resumo: null,
  carregado: false,
  conectado: false,
  simulador: false,
  ultimaAtualizacao: 0,
  novosCriticos: [],

  recarregar: async () => {
    const r = await fetch('/api/estado', { cache: 'no-store' });
    if (!r.ok) throw new Error('Falha ao carregar o estado da operação');
    const d = (await r.json()) as {
      equipamentos: Equipamento[]; agentes: Agente[]; ocorrencias: Ocorrencia[]; alertas: Alerta[]; resumo: Resumo; simulador: boolean;
    };
    set({
      equipamentos: indexar(d.equipamentos), agentes: indexar(d.agentes), ocorrencias: indexar(d.ocorrencias),
      alertas: indexar(d.alertas), resumo: d.resumo, simulador: d.simulador, carregado: true, ultimaAtualizacao: Date.now(),
    });
  },

  iniciar: () => {
    assinantes++;
    if (!fonte) {
      get().recarregar().catch(() => set({ carregado: true }));
      fonte = new EventSource('/api/tempo-real');
      fonte.onopen = () => {
        // Ao reconectar, sincroniza tudo de novo para não perder eventos do intervalo.
        if (get().carregado && !get().conectado) get().recarregar().catch(() => {});
        set({ conectado: true });
      };
      fonte.onerror = () => set({ conectado: false });
      fonte.onmessage = (m) => {
        try {
          get().aplicar(JSON.parse(m.data) as EventoTempoReal);
        } catch {
          /* mensagem malformada: ignora */
        }
      };
    }
    return () => {
      assinantes--;
      if (assinantes <= 0 && fonte) {
        fonte.close();
        fonte = null;
        set({ conectado: false });
      }
    };
  },

  aplicar: (e) =>
    set((s) => {
      const agora = Date.now();
      switch (e.tipo) {
        case 'equipamento':
          return { equipamentos: { ...s.equipamentos, [e.dado.id]: e.dado }, ultimaAtualizacao: agora };
        case 'equipamento_removido': {
          const { [e.dado.id]: _, ...resto } = s.equipamentos;
          return { equipamentos: resto, ultimaAtualizacao: agora };
        }
        case 'agente':
          return { agentes: { ...s.agentes, [e.dado.id]: e.dado }, ultimaAtualizacao: agora };
        case 'agente_removido': {
          const { [e.dado.id]: _, ...resto } = s.agentes;
          return { agentes: resto, ultimaAtualizacao: agora };
        }
        case 'ocorrencia': {
          if (e.dado.fim) {
            const { [e.dado.id]: _, ...resto } = s.ocorrencias;
            return { ocorrencias: resto, ultimaAtualizacao: agora };
          }
          return { ocorrencias: { ...s.ocorrencias, [e.dado.id]: e.dado }, ultimaAtualizacao: agora };
        }
        case 'alerta': {
          if (e.dado.reconhecidoEm) {
            const { [e.dado.id]: _, ...resto } = s.alertas;
            return { alertas: resto, ultimaAtualizacao: agora };
          }
          const novo = !s.alertas[e.dado.id];
          return {
            alertas: { ...s.alertas, [e.dado.id]: e.dado },
            novosCriticos: novo && e.dado.nivel === 'critico' ? [...s.novosCriticos, e.dado] : s.novosCriticos,
            ultimaAtualizacao: agora,
          };
        }
        case 'resumo':
          return { resumo: e.dado, simulador: true, ultimaAtualizacao: agora };
        default:
          return {};
      }
    }),

  consumirCriticos: () => {
    const l = get().novosCriticos;
    if (l.length) set({ novosCriticos: [] });
    return l;
  },

  upsertEquipamento: (e) => set((s) => ({ equipamentos: { ...s.equipamentos, [e.id]: e } })),
  upsertAgente: (a) => set((s) => ({ agentes: { ...s.agentes, [a.id]: a } })),
  removerEquipamento: (id) =>
    set((s) => {
      const { [id]: _, ...resto } = s.equipamentos;
      return { equipamentos: resto };
    }),
  removerAgente: (id) =>
    set((s) => {
      const { [id]: _, ...resto } = s.agentes;
      return { agentes: resto };
    }),
}));
