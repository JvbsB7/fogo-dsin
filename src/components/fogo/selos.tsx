import { Badge } from '@/components/ui/badge';
import { STATUS_AGENTE_POR_CODIGO, STATUS_POR_CODIGO, type StatusAgente, type StatusEquipamento } from '@/lib/catalog';
import type { NivelAlerta } from '@/lib/types';
import { cn } from '@/lib/utils';

function Selo({ cor, children, className }: { cor: string; children: React.ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn('gap-1.5 border-transparent font-medium', className)} style={{ backgroundColor: `${cor}22`, color: cor }}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: cor }} />
      {children}
    </Badge>
  );
}

export function SeloStatus({ status, className }: { status: StatusEquipamento; className?: string }) {
  const s = STATUS_POR_CODIGO[status];
  return <Selo cor={s?.cor ?? '#888'} className={className}>{s?.rotulo ?? status}</Selo>;
}

export function SeloAgente({ status }: { status: StatusAgente }) {
  const s = STATUS_AGENTE_POR_CODIGO[status];
  return <Selo cor={s?.cor ?? '#888'}>{s?.rotulo ?? status}</Selo>;
}

export const COR_NIVEL: Record<NivelAlerta | 'baixo' | 'moderado', string> = {
  critico: '#ef4444',
  alto: '#f97316',
  medio: '#eab308',
  moderado: '#eab308',
  info: '#38bdf8',
  baixo: '#22c55e',
};
const ROTULO_NIVEL: Record<string, string> = { critico: 'Crítico', alto: 'Alto', medio: 'Médio', moderado: 'Moderado', info: 'Info', baixo: 'Baixo' };

export function SeloNivel({ nivel }: { nivel: keyof typeof COR_NIVEL }) {
  return <Selo cor={COR_NIVEL[nivel]}>{ROTULO_NIVEL[nivel]}</Selo>;
}

export const COR_SITUACAO = { normal: '#22c55e', atencao: '#eab308', critico: '#ef4444' } as const;
const ROTULO_SITUACAO = { normal: 'Normal', atencao: 'Atenção', critico: 'Crítico' };

export function SeloSituacao({ situacao }: { situacao: keyof typeof COR_SITUACAO }) {
  return <Selo cor={COR_SITUACAO[situacao]}>{ROTULO_SITUACAO[situacao]}</Selo>;
}
