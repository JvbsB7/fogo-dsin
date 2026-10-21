'use client';

// Filtros e camadas da Central (persistidos no navegador para o operador não perder a visão).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Camadas {
  equipamentos: boolean;
  agentes: boolean;
  ocorrencias: boolean;
  regioes: boolean;
}

export type Selecao = { tipo: 'equipamento' | 'agente' | 'ocorrencia'; id: number } | null;

interface EstadoFiltros {
  tipos: string[];
  status: string[];
  regioes: string[];
  orgaos: string[];
  bairro: string | null;
  somenteManutencao: boolean;
  camadas: Camadas;
  selecao: Selecao;
  /** Região para centralizar o mapa (pedido pontual, não persistido). */
  focoRegiao: string | null;
  set: (p: Partial<Omit<EstadoFiltros, 'set' | 'limpar' | 'alternarCamada' | 'selecionar' | 'focar'>>) => void;
  alternarCamada: (c: keyof Camadas) => void;
  limpar: () => void;
  selecionar: (s: Selecao) => void;
  focar: (regiao: string | null) => void;
}

const VAZIO = { tipos: [], status: [], regioes: [], orgaos: [], bairro: null, somenteManutencao: false };

export const useFiltros = create<EstadoFiltros>()(
  persist(
    (set) => ({
      ...VAZIO,
      camadas: { equipamentos: true, agentes: true, ocorrencias: true, regioes: true },
      selecao: null,
      focoRegiao: null,
      set: (p) => set(p),
      alternarCamada: (c) => set((s) => ({ camadas: { ...s.camadas, [c]: !s.camadas[c] } })),
      limpar: () => set(VAZIO),
      selecionar: (selecao) => set({ selecao }),
      focar: (focoRegiao) => set({ focoRegiao }),
    }),
    {
      name: 'fogo-filtros',
      partialize: (s) => ({ tipos: s.tipos, status: s.status, regioes: s.regioes, orgaos: s.orgaos, somenteManutencao: s.somenteManutencao, camadas: s.camadas }),
    },
  ),
);
