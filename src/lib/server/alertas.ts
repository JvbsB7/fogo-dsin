// Motor de alertas: transforma mudanças de situação, ocorrências graves, anomalias e
// previsões em alertas priorizados. Cada problema tem uma "chave" para não duplicar
// enquanto o alerta estiver aberto, e é fechado sozinho quando a causa some.
import { OCORRENCIA_POR_CODIGO, TIPOS_POR_CODIGO } from '@/lib/catalog';
import type { Equipamento, Ocorrencia } from '@/lib/types';
import { publicar } from './bus';
import { getDb } from './db';
import { detectarAnomalias, nomeRegiao, previsaoRisco } from './previsoes';
import { abrirAlerta, listarAlertas, resolverAlertasPorChave, type NovoAlerta } from './repo';

function emitir(a: NovoAlerta) {
  const novo = abrirAlerta(a);
  if (novo) publicar({ tipo: 'alerta', dado: novo });
  return novo;
}

function resolver(chave: string) {
  const ids = resolverAlertasPorChave(chave);
  if (ids.length) {
    for (const a of listarAlertas({ limite: 500 }).filter((x) => ids.includes(x.id))) publicar({ tipo: 'alerta', dado: a });
  }
}

export function avaliarEquipamento(e: Equipamento) {
  const def = TIPOS_POR_CODIGO[e.tipo];
  const nome = `${def?.nome ?? e.tipo} ${e.numeroSerie}`;
  const local = `${e.logradouro}, ${e.referencia} — ${e.bairro}`;
  const chaveFalha = `equip:${e.id}:falha`;
  const chaveFurto = `equip:${e.id}:furto`;
  if (e.status === 'mau_funcionamento') {
    const semaforo = e.tipo === 'semaforo';
    emitir({
      nivel: semaforo ? 'critico' : 'alto', categoria: 'Equipamento', chave: chaveFalha, equipamentoId: e.id, bairro: e.bairro, regiao: e.regiao,
      titulo: semaforo ? `Semáforo em falha — cruzamento sem sinalização` : `${nome} com mau funcionamento`,
      descricao: `${local}. ${semaforo ? 'Risco imediato de acidente: enviar agente para orientar o trânsito e acionar manutenção.' : 'Manutenção imediata necessária.'}`,
    });
  } else if (e.status === 'furtado') {
    emitir({
      nivel: 'critico', categoria: 'Segurança', chave: chaveFurto, equipamentoId: e.id, bairro: e.bairro, regiao: e.regiao,
      titulo: `Furto ou vandalismo: ${nome}`, descricao: `${local}. Acionar Guarda Municipal e registrar boletim de ocorrência.`,
    });
  }
  // A causa some quando a situação muda (ex.: furtado → desativado também encerra o alerta de furto).
  if (e.status !== 'mau_funcionamento') resolver(chaveFalha);
  if (e.status !== 'furtado') resolver(chaveFurto);
  if (e.status === 'operacional') resolver(`anom:sem_comunicacao:${e.id}`);
  const limiteVencida = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  if (e.status !== 'operacional' || !e.manutencaoProxima || e.manutencaoProxima >= limiteVencida) resolver(`manut:${e.id}:vencida`);
}

/** Encerra os alertas abertos de um equipamento ou agente que foi excluído do cadastro. */
export function resolverAlertasDe(campo: 'equipamento_id' | 'agente_id', id: number) {
  const chaves = getDb()
    .prepare(`SELECT DISTINCT chave FROM alertas WHERE reconhecido_em IS NULL AND ${campo} = ?`)
    .all(id) as { chave: string }[];
  for (const { chave } of chaves) resolver(chave);
}

export function avaliarOcorrencia(o: Ocorrencia) {
  if (o.fim) {
    resolver(`ocorr:${o.id}`);
    return;
  }
  const def = OCORRENCIA_POR_CODIGO[o.tipo];
  if (o.gravidade >= 3 || o.tipo === 'acidente') {
    emitir({
      nivel: o.gravidade >= 3 ? 'critico' : 'alto', categoria: 'Ocorrência', chave: `ocorr:${o.id}`, ocorrenciaId: o.id, bairro: o.bairro, regiao: o.regiao,
      titulo: `${def?.rotulo ?? o.tipo} — ${o.bairro}`,
      descricao: `${o.descricao}. Gravidade ${o.gravidade}/3${o.agenteId ? ', equipe já despachada.' : ', aguardando equipe.'}`,
    });
  }
}

/** Varredura periódica: anomalias, manutenção muito atrasada e risco previsto para a próxima hora. */
export function varreduraPeriodica(agora = Date.now()) {
  const anomalias = detectarAnomalias(agora);
  const chavesAtivas = new Set<string>();
  for (const a of anomalias) {
    const chave = `anom:${a.tipo}:${a.equipamentoId ?? a.regiao}`;
    chavesAtivas.add(chave);
    emitir({
      nivel: a.severidade, categoria: 'Anomalia', chave, equipamentoId: a.equipamentoId ?? null,
      regiao: a.regiao ?? null, titulo: a.titulo, descricao: a.explicacao,
    });
  }
  // Anomalias que deixaram de existir são fechadas.
  const abertas = getDb().prepare(`SELECT DISTINCT chave FROM alertas WHERE reconhecido_em IS NULL AND chave LIKE 'anom:%'`).all() as { chave: string }[];
  for (const { chave } of abertas) if (!chavesAtivas.has(chave)) resolver(chave);

  // Manutenção vencida há mais de 30 dias em equipamento de segurança viária.
  const hoje = new Date(agora).toISOString().slice(0, 10);
  const limite = new Date(agora - 30 * 86400000).toISOString().slice(0, 10);
  const vencidos = getDb()
    .prepare(
      `SELECT id, numero_serie, tipo, bairro, regiao, manutencao_proxima FROM equipamentos
       WHERE status = 'operacional' AND manutencao_proxima < ? AND (tipo LIKE 'radar_%' OR tipo = 'semaforo')`,
    )
    .all(limite) as { id: number; numero_serie: string; tipo: string; bairro: string; regiao: string; manutencao_proxima: string }[];
  const chavesVencidas = new Set(vencidos.map((v) => `manut:${v.id}:vencida`));
  const manutAbertas = getDb().prepare(`SELECT DISTINCT chave FROM alertas WHERE reconhecido_em IS NULL AND chave LIKE 'manut:%'`).all() as { chave: string }[];
  for (const { chave } of manutAbertas) if (!chavesVencidas.has(chave)) resolver(chave);
  for (const v of vencidos) {
    const dias = Math.round((Date.parse(hoje) - Date.parse(v.manutencao_proxima)) / 86400000);
    emitir({
      nivel: 'medio', categoria: 'Manutenção', chave: `manut:${v.id}:vencida`, equipamentoId: v.id, bairro: v.bairro, regiao: v.regiao,
      titulo: `${TIPOS_POR_CODIGO[v.tipo]?.nome} ${v.numero_serie} com manutenção vencida há ${dias} dias`,
      descricao: v.tipo.startsWith('radar_') ? 'Radar sem aferição em dia pode ter autuações contestadas.' : 'Risco maior de falha em horário de pico.',
    });
  }

  // Alerta preventivo: risco crítico previsto nas próximas 2 horas.
  const previsao = previsaoRisco(3, agora);
  for (const [regiao, pontos] of Object.entries(previsao.proximas)) {
    const critico = pontos.slice(1, 3).find((p) => p.nivel === 'critico');
    const chave = `prev:${regiao}`;
    if (critico) {
      emitir({
        nivel: 'medio', categoria: 'Preditivo', chave, regiao,
        titulo: `Risco crítico previsto às ${critico.hora}h — ${nomeRegiao(regiao)}`,
        descricao: `Índice ${critico.indice}/100 e ~${critico.esperado.toFixed(1)} ocorrências esperadas por hora. Considere reforçar a região antes do pico.`,
      });
    } else resolver(chave);
  }
  return anomalias.length;
}
