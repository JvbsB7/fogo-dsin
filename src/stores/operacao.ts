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
  /** Aplica de uma vez os eventos recebidos (um único redesenho das telas). */
  aplicar: (eventos: EventoTempoReal[]) => void;
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

// O simulador manda dezenas de eventos por ciclo (cada agente e veículo que se move). Aplicar
// um por um redesenharia a Central dezenas de vezes seguidas; juntamos tudo a cada 250 ms.
const INTERVALO_LOTE_MS = 250;
let fila: EventoTempoReal[] = [];
let agendado: ReturnType<typeof setTimeout> | null = null;

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
          fila.push(JSON.parse(m.data) as EventoTempoReal);
        } catch {
          return; // mensagem malformada: ignora
        }
        agendado ??= setTimeout(() => {
          const lote = fila;
          fila = [];
          agendado = null;
          get().aplicar(lote);
        }, INTERVALO_LOTE_MS);
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

  aplicar: (eventos) =>
    set((s) => {
      // Cada mapa é copiado no máximo uma vez por lote, e só se algum evento mexer nele.
      const novo: Partial<EstadoOperacao> = {};
      const copia = <K extends 'equipamentos' | 'agentes' | 'ocorrencias' | 'alertas'>(k: K) =>
        (novo[k] ??= { ...s[k] }) as EstadoOperacao[K];
      let criticos = s.novosCriticos;
      for (const e of eventos) {
        switch (e.tipo) {
          case 'equipamento':
            copia('equipamentos')[e.dado.id] = e.dado;
            break;
          case 'equipamento_removido':
            delete copia('equipamentos')[e.dado.id];
            break;
          case 'agente':
            copia('agentes')[e.dado.id] = e.dado;
            break;
          case 'agente_removido':
            delete copia('agentes')[e.dado.id];
            break;
          case 'ocorrencia':
            if (e.dado.fim) delete copia('ocorrencias')[e.dado.id];
            else copia('ocorrencias')[e.dado.id] = e.dado;
            break;
          case 'alerta': {
            const alertas = copia('alertas');
            if (e.dado.reconhecidoEm) {
              delete alertas[e.dado.id];
              break;
            }
            if (!alertas[e.dado.id] && e.dado.nivel === 'critico') criticos = [...criticos, e.dado];
            alertas[e.dado.id] = e.dado;
            break;
          }
          case 'resumo':
            novo.resumo = e.dado;
            novo.simulador = true;
            break;
        }
      }
      return { ...novo, novosCriticos: criticos, ultimaAtualizacao: Date.now() };
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
