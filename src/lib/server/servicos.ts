// Casos de uso com efeitos colaterais: gravam no banco, avisam as telas (SSE) e passam
// pelo motor de alertas. API e simulador usam as mesmas funções, então um equipamento
// marcado como furtado pela tela ou pela telemetria gera exatamente o mesmo efeito.
import { TIPOS_POR_CODIGO, type StatusEquipamento } from '@/lib/catalog';
import type { AgenteEntrada, EquipamentoEntrada, Ocorrencia } from '@/lib/types';
import { avaliarEquipamento, avaliarOcorrencia } from './alertas';
import { publicar } from './bus';
import { getDb } from './db';
import { invalidarModelo } from './previsoes';
import * as repo from './repo';
import { distanciaM } from './util';

export function criarEquipamento(e: EquipamentoEntrada) {
  const id = repo.inserirEquipamento(e);
  const eq = repo.obterEquipamento(id)!;
  publicar({ tipo: 'equipamento', dado: eq });
  avaliarEquipamento(eq);
  return eq;
}

export function editarEquipamento(id: number, e: EquipamentoEntrada) {
  const eq = repo.atualizarEquipamento(id, e);
  if (eq) {
    publicar({ tipo: 'equipamento', dado: eq });
    avaliarEquipamento(eq);
  }
  return eq;
}

export function excluirEquipamento(id: number) {
  const ok = repo.removerEquipamento(id);
  if (ok) publicar({ tipo: 'equipamento_removido', dado: { id } });
  return ok;
}

export function alterarStatusEquipamento(id: number, status: StatusEquipamento, motivo: string) {
  const eq = repo.mudarStatusEquipamento(id, status, motivo);
  if (eq) {
    publicar({ tipo: 'equipamento', dado: eq });
    avaliarEquipamento(eq);
  }
  return eq;
}

export function registrarManutencaoConcluida(id: number) {
  const atual = repo.obterEquipamento(id);
  if (!atual) return null;
  const eq = repo.concluirManutencao(id, TIPOS_POR_CODIGO[atual.tipo]?.intervaloManutencaoDias ?? 180);
  if (eq) {
    publicar({ tipo: 'equipamento', dado: eq });
    avaliarEquipamento(eq);
  }
  return eq;
}

export function criarAgente(a: AgenteEntrada) {
  const ag = repo.obterAgente(repo.inserirAgente(a))!;
  publicar({ tipo: 'agente', dado: ag });
  return ag;
}

export function editarAgente(id: number, a: AgenteEntrada) {
  const ag = repo.atualizarAgente(id, a);
  if (ag) publicar({ tipo: 'agente', dado: ag });
  return ag;
}

export function excluirAgente(id: number) {
  const ok = repo.removerAgente(id);
  if (ok) publicar({ tipo: 'agente_removido', dado: { id } });
  return ok;
}

/** Despacha o agente em patrulha mais próximo (preferindo a mesma região). */
export function despacharAgente(o: Ocorrencia) {
  const livres = repo.listarAgentes({ status: ['em_patrulha'] });
  if (!livres.length) return null;
  const escolhido = livres
    .map((a) => ({ a, d: distanciaM(a.lat, a.lng, o.lat, o.lng) * (a.regiao === o.regiao ? 1 : 1.5) }))
    .sort((x, y) => x.d - y.d)[0].a;
  repo.moverAgente(escolhido.id, escolhido.lat, escolhido.lng, 'em_ocorrencia', o.id);
  repo.atribuirAgenteOcorrencia(o.id, escolhido.id);
  publicar({ tipo: 'agente', dado: repo.obterAgente(escolhido.id)! });
  return escolhido;
}

export function registrarOcorrencia(o: Omit<Ocorrencia, 'id' | 'agenteId' | 'fim'>, despachar = true) {
  const id = repo.inserirOcorrencia({ ...o, fim: null, agenteId: null });
  let oc = repo.obterOcorrencia(id)!;
  if (despachar) {
    despacharAgente(oc);
    oc = repo.obterOcorrencia(id)!;
  }
  invalidarModelo();
  publicar({ tipo: 'ocorrencia', dado: oc });
  avaliarOcorrencia(oc);
  return oc;
}

export function finalizarOcorrencia(id: number) {
  const oc = repo.encerrarOcorrencia(id);
  if (!oc) return null;
  if (oc.agenteId) {
    const ag = repo.obterAgente(oc.agenteId);
    if (ag && ag.ocorrenciaId === id) {
      repo.moverAgente(ag.id, ag.lat, ag.lng, 'em_patrulha', null);
      publicar({ tipo: 'agente', dado: repo.obterAgente(ag.id)! });
    }
  }
  publicar({ tipo: 'ocorrencia', dado: oc });
  avaliarOcorrencia(oc);
  return oc;
}

export function reconhecerAlerta(id: number) {
  const a = repo.reconhecerAlerta(id);
  if (a) publicar({ tipo: 'alerta', dado: a });
  return a;
}

/** Histórico de situação de um equipamento (para a ficha de detalhes). */
export function historicoEquipamento(id: number) {
  return getDb().prepare('SELECT de, para, em, motivo FROM eventos_status WHERE equipamento_id = ? ORDER BY em DESC LIMIT 30').all(id) as {
    de: string | null; para: string; em: string; motivo: string;
  }[];
}
