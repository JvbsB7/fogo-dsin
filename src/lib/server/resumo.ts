// Indicadores da Central de Operações (KPIs gerais e situação consolidada por região).
import { REGIOES, STATUS_AGENTE_ATIVOS, STATUS_CODIGOS, STATUS_EM_SERVICO, type StatusEquipamento } from '@/lib/catalog';
import type { Resumo, ResumoRegiao } from '@/lib/types';
import { getDb } from './db';
import { riscoAgora } from './previsoes';
import { agoraISO, dataLocal } from './util';

const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : 100);

export function calcularResumo(): Resumo {
  const db = getDb();
  const porStatus = Object.fromEntries(STATUS_CODIGOS.map((s) => [s, 0])) as Record<StatusEquipamento, number>;
  const porRegiaoStatus = db.prepare('SELECT regiao, status, COUNT(*) AS n FROM equipamentos GROUP BY regiao, status').all() as {
    regiao: string; status: StatusEquipamento; n: number;
  }[];
  for (const l of porRegiaoStatus) porStatus[l.status] += l.n;
  const total = Object.values(porStatus).reduce((a, b) => a + b, 0);
  const emServico = STATUS_EM_SERVICO.reduce((s, k) => s + porStatus[k], 0);
  const operacionais = porStatus.operacional;

  const hoje = dataLocal();
  const em7 = dataLocal(7);
  const manut = db
    .prepare(
      `SELECT
         SUM(CASE WHEN manutencao_tipo = 'imediata' THEN 1 ELSE 0 END) AS imediata,
         SUM(CASE WHEN manutencao_tipo != 'imediata' AND manutencao_proxima < ? THEN 1 ELSE 0 END) AS vencida,
         SUM(CASE WHEN manutencao_tipo != 'imediata' AND manutencao_proxima >= ? AND manutencao_proxima <= ? THEN 1 ELSE 0 END) AS proxima
       FROM equipamentos WHERE status NOT IN ('nao_instalado', 'desativado')`,
    )
    .get(hoje, hoje, em7) as { imediata: number; vencida: number; proxima: number };

  const ativos = `(${STATUS_AGENTE_ATIVOS.map((s) => `'${s}'`).join(',')})`;
  const agentesPorRegiao = Object.fromEntries(
    (db.prepare(`SELECT regiao, COUNT(*) AS n FROM agentes WHERE status IN ${ativos} GROUP BY regiao`).all() as { regiao: string; n: number }[]).map((r) => [r.regiao, r.n]),
  );
  const agentesTotal = (db.prepare('SELECT COUNT(*) AS n FROM agentes').get() as { n: number }).n;
  const ocorrPorRegiao = Object.fromEntries(
    (db.prepare('SELECT regiao, COUNT(*) AS n FROM ocorrencias WHERE fim IS NULL GROUP BY regiao').all() as { regiao: string; n: number }[]).map((r) => [r.regiao, r.n]),
  );
  const alertasPorRegiao = db
    .prepare(`SELECT regiao, SUM(CASE WHEN nivel = 'critico' THEN 1 ELSE 0 END) AS criticos, COUNT(*) AS abertos FROM alertas WHERE reconhecido_em IS NULL GROUP BY regiao`)
    .all() as { regiao: string | null; criticos: number; abertos: number }[];
  const alertasReg = Object.fromEntries(alertasPorRegiao.filter((a) => a.regiao).map((a) => [a.regiao!, a]));
  const alertasTot = alertasPorRegiao.reduce((s, a) => ({ c: s.c + a.criticos, a: s.a + a.abertos }), { c: 0, a: 0 });
  const risco = riscoAgora();

  const regioes: ResumoRegiao[] = REGIOES.map((r) => {
    const linhas = porRegiaoStatus.filter((l) => l.regiao === r.codigo);
    const eq = linhas.reduce((s, l) => s + l.n, 0);
    const serv = linhas.filter((l) => STATUS_EM_SERVICO.includes(l.status)).reduce((s, l) => s + l.n, 0);
    const op = linhas.find((l) => l.status === 'operacional')?.n ?? 0;
    const disp = pct(op, serv);
    const al = alertasReg[r.codigo] ?? { criticos: 0, abertos: 0 };
    const oc = ocorrPorRegiao[r.codigo] ?? 0;
    const rk = risco[r.codigo];
    const motivos: string[] = [];
    if (al.criticos) motivos.push(`${al.criticos} alerta(s) crítico(s)`);
    if (disp < 92) motivos.push(`disponibilidade ${disp}%`);
    if (rk.indice >= 65) motivos.push(`risco ${rk.nivel} agora (${rk.indice})`);
    if (oc >= 3) motivos.push(`${oc} ocorrências em andamento`);
    if ((agentesPorRegiao[r.codigo] ?? 0) === 0) motivos.push('sem agentes em serviço');
    const critico = al.criticos > 0 || disp < 80 || rk.indice >= 85;
    const atencao = !critico && (al.abertos > 0 || disp < 92 || rk.indice >= 65 || oc >= 3 || (agentesPorRegiao[r.codigo] ?? 0) === 0);
    return {
      regiao: r.codigo, nome: r.nome, equipamentos: eq, emServico: serv, operacionais: op, disponibilidade: disp,
      ocorrenciasAtivas: oc, alertasCriticos: al.criticos, alertasAbertos: al.abertos, agentesAtivos: agentesPorRegiao[r.codigo] ?? 0,
      riscoAgora: rk.indice, situacao: critico ? 'critico' : atencao ? 'atencao' : 'normal', motivos,
    };
  });

  return {
    geradoEm: agoraISO(),
    totalEquipamentos: total,
    porStatus,
    emServico,
    operacionais,
    indisponiveis: emServico - operacionais,
    disponibilidade: pct(operacionais, emServico),
    agentesAtivos: Object.values(agentesPorRegiao).reduce((a, b) => a + b, 0),
    agentesTotal,
    ocorrenciasAtivas: Object.values(ocorrPorRegiao).reduce((a, b) => a + b, 0),
    alertasAbertos: alertasTot.a,
    alertasCriticos: alertasTot.c,
    manutencaoImediata: manut.imediata ?? 0,
    manutencaoVencida: manut.vencida ?? 0,
    manutencaoProxima7d: manut.proxima ?? 0,
    regioes,
  };
}
