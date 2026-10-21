'use client';

import { Activity, AlertTriangle, CheckCircle2, Cctv, Siren, Users, Wrench, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { pct } from '@/lib/formato';
import type { Resumo } from '@/lib/types';
import { cn } from '@/lib/utils';

function Kpi({ titulo, valor, detalhe, icone: Icone, tom, children }: {
  titulo: string; valor: React.ReactNode; detalhe?: React.ReactNode; icone: React.ElementType; tom?: 'ok' | 'alerta' | 'critico'; children?: React.ReactNode;
}) {
  const cor = tom === 'critico' ? 'text-red-400' : tom === 'alerta' ? 'text-amber-400' : tom === 'ok' ? 'text-emerald-400' : 'text-primary';
  return (
    <Card className="gap-1.5 px-4 py-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {titulo}
        <Icone className={cn('size-4', cor)} />
      </div>
      <div className={cn('text-2xl font-semibold tabular-nums', tom === 'critico' && 'text-red-400')}>{valor}</div>
      {detalhe && <div className="text-xs text-muted-foreground">{detalhe}</div>}
      {children}
    </Card>
  );
}

export function Kpis({ resumo }: { resumo: Resumo | null }) {
  if (!resumo) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }
  const r = resumo;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      <Kpi titulo="Equipamentos" valor={r.totalEquipamentos} icone={Cctv} detalhe={`${r.emServico} em serviço`} />
      <Kpi titulo="Operacionais" valor={r.operacionais} icone={CheckCircle2} tom="ok" detalhe={`${r.porStatus.nao_instalado} a instalar · ${r.porStatus.desativado} desativ.`} />
      <Kpi titulo="Indisponíveis" valor={r.indisponiveis} icone={XCircle} tom={r.indisponiveis > 0 ? 'alerta' : 'ok'}
        detalhe={`${r.porStatus.mau_funcionamento} falha · ${r.porStatus.em_manutencao} manut. · ${r.porStatus.furtado} furto`} />
      <Kpi titulo="Disponibilidade" valor={pct(r.disponibilidade)} icone={Activity} tom={r.disponibilidade < 90 ? 'critico' : r.disponibilidade < 95 ? 'alerta' : 'ok'}>
        <Progress value={r.disponibilidade} className="mt-1 h-1.5" />
      </Kpi>
      <Kpi titulo="Agentes em atividade" valor={r.agentesAtivos} icone={Users} detalhe={`de ${r.agentesTotal} cadastrados`} />
      <Kpi titulo="Ocorrências ativas" valor={r.ocorrenciasAtivas} icone={Siren} tom={r.ocorrenciasAtivas > 8 ? 'alerta' : undefined} detalhe="em andamento agora" />
      <Kpi titulo="Alertas abertos" valor={r.alertasAbertos} icone={AlertTriangle} tom={r.alertasCriticos ? 'critico' : r.alertasAbertos ? 'alerta' : 'ok'}
        detalhe={<span className={r.alertasCriticos ? 'text-red-400' : ''}>{r.alertasCriticos} crítico(s)</span>} />
      <Kpi titulo="Manutenção" valor={r.manutencaoImediata} icone={Wrench} tom={r.manutencaoImediata ? 'alerta' : 'ok'}
        detalhe={`imediata · ${r.manutencaoVencida} vencida(s) · ${r.manutencaoProxima7d} em 7 dias`} />
    </div>
  );
}
