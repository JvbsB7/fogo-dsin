import type { ManutencaoTipo, StatusAgente, StatusEquipamento, Turno } from './catalog';

export interface Equipamento {
  id: number;
  tipo: string;
  numeroSerie: string;
  marca: string;
  modelo: string;
  orgao: string;
  status: StatusEquipamento;
  cep: string;
  bairro: string;
  regiao: string;
  cidade: string;
  uf: string;
  logradouro: string;
  referencia: string;
  lat: number;
  lng: number;
  manutencaoTipo: ManutencaoTipo;
  /** AAAA-MM-DD */
  manutencaoProxima: string | null;
  ultimaManutencao: string | null;
  instaladoEm: string | null;
  atributos: Record<string, unknown>;
  telemetria: Record<string, unknown>;
  ultimoSinal: string | null;
  observacoes: string;
  criadoEm: string;
  atualizadoEm: string;
}

export type EquipamentoEntrada = Omit<Equipamento, 'id' | 'regiao' | 'telemetria' | 'ultimoSinal' | 'criadoEm' | 'atualizadoEm'>;

export interface Agente {
  id: number;
  nome: string;
  matricula: string;
  funcao: string;
  orgao: string;
  status: StatusAgente;
  turno: Turno;
  telefone: string;
  bairroBase: string;
  regiao: string;
  lat: number;
  lng: number;
  equipamentoId: number | null;
  ocorrenciaId: number | null;
  ultimaAtualizacao: string;
  criadoEm: string;
}

export type AgenteEntrada = Omit<Agente, 'id' | 'regiao' | 'ocorrenciaId' | 'ultimaAtualizacao' | 'criadoEm'>;

export interface Ocorrencia {
  id: number;
  tipo: string;
  gravidade: 1 | 2 | 3;
  bairro: string;
  regiao: string;
  lat: number;
  lng: number;
  inicio: string;
  fim: string | null;
  origem: 'historico' | 'simulador' | 'manual';
  equipamentoId: number | null;
  agenteId: number | null;
  descricao: string;
}

export type NivelAlerta = 'critico' | 'alto' | 'medio' | 'info';

export interface Alerta {
  id: number;
  nivel: NivelAlerta;
  categoria: string;
  titulo: string;
  descricao: string;
  equipamentoId: number | null;
  agenteId: number | null;
  ocorrenciaId: number | null;
  bairro: string | null;
  regiao: string | null;
  criadoEm: string;
  reconhecidoEm: string | null;
}

export interface ResumoRegiao {
  regiao: string;
  nome: string;
  equipamentos: number;
  emServico: number;
  operacionais: number;
  disponibilidade: number;
  ocorrenciasAtivas: number;
  alertasCriticos: number;
  alertasAbertos: number;
  agentesAtivos: number;
  riscoAgora: number;
  situacao: 'normal' | 'atencao' | 'critico';
  motivos: string[];
}

export interface Resumo {
  geradoEm: string;
  totalEquipamentos: number;
  porStatus: Record<StatusEquipamento, number>;
  emServico: number;
  operacionais: number;
  indisponiveis: number;
  disponibilidade: number;
  agentesAtivos: number;
  agentesTotal: number;
  ocorrenciasAtivas: number;
  alertasAbertos: number;
  alertasCriticos: number;
  manutencaoImediata: number;
  manutencaoVencida: number;
  manutencaoProxima7d: number;
  regioes: ResumoRegiao[];
}

/** Mensagens do fluxo em tempo real (SSE). */
export type EventoTempoReal =
  | { tipo: 'equipamento'; dado: Equipamento }
  | { tipo: 'equipamento_removido'; dado: { id: number } }
  | { tipo: 'agente'; dado: Agente }
  | { tipo: 'agente_removido'; dado: { id: number } }
  | { tipo: 'ocorrencia'; dado: Ocorrencia }
  | { tipo: 'alerta'; dado: Alerta }
  | { tipo: 'resumo'; dado: Resumo };

export interface ErroValidacao {
  erro: string;
  campos?: Record<string, string>;
}
