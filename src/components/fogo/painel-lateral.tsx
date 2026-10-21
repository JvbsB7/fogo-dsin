'use client';

import { Check, Crosshair } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OCORRENCIA_POR_CODIGO, REGIAO_POR_CODIGO, TIPOS_POR_CODIGO } from '@/lib/catalog';
import { data, diasAte, hora, tempoRelativo } from '@/lib/formato';
import type { Alerta, Equipamento, Ocorrencia, ResumoRegiao } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useFiltros } from '@/stores/filtros';
import { useOperacao } from '@/stores/operacao';
import { precisaManutencao } from './filtros-central';
import { COR_NIVEL, SeloNivel, SeloSituacao, SeloStatus } from './selos';

const ORDEM_NIVEL = { critico: 0, alto: 1, medio: 2, info: 3 };

export async function reconhecer(id: number) {
  const r = await fetch(`/api/alertas/${id}`, { method: 'PATCH' });
  if (!r.ok) toast.error('Não foi possível reconhecer o alerta.');
}

export function ItemAlerta({ a, compacto }: { a: Alerta; compacto?: boolean }) {
  const { selecionar, focar } = useFiltros();
  const [enviando, setEnviando] = useState(false);
  const localizar = () => {
    if (a.equipamentoId) selecionar({ tipo: 'equipamento', id: a.equipamentoId });
    else if (a.ocorrenciaId) selecionar({ tipo: 'ocorrencia', id: a.ocorrenciaId });
    if (a.regiao) focar(a.regiao);
  };
  return (
    <div className="rounded-lg border bg-card/60 p-3" style={{ borderLeft: `3px solid ${COR_NIVEL[a.nivel]}` }}>
      <div className="flex items-center gap-2">
        <SeloNivel nivel={a.nivel} />
        <span className="text-[11px] text-muted-foreground">{a.categoria}</span>
        <span className="ml-auto text-[11px] text-muted-foreground" title={a.criadoEm}>{tempoRelativo(a.criadoEm)}</span>
      </div>
      <p className="mt-1.5 text-sm font-medium leading-snug">{a.titulo}</p>
      {!compacto && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{a.descricao}</p>}
      <div className="mt-2 flex gap-1.5">
        {(a.equipamentoId || a.ocorrenciaId || a.regiao) && (
          <Button size="xs" variant="outline" onClick={localizar}>
            <Crosshair /> Localizar
          </Button>
        )}
        <Button
          size="xs"
          variant="ghost"
          disabled={enviando}
          onClick={async () => {
            setEnviando(true);
            await reconhecer(a.id);
            setEnviando(false);
          }}
        >
          <Check /> Reconhecer
        </Button>
      </div>
    </div>
  );
}

function ListaAlertas({ alertas }: { alertas: Alerta[] }) {
  if (!alertas.length) return <Vazio texto="Nenhum alerta aberto. A cidade está tranquila." />;
  return (
    <div className="flex flex-col gap-2">
      {alertas.map((a) => <ItemAlerta key={a.id} a={a} />)}
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{texto}</p>;
}

export function CartaoRegiao({ r, onClick }: { r: ResumoRegiao; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-lg border bg-card/60 p-3 text-left transition-colors hover:bg-muted/60">
      <div className="flex items-center justify-between">
        <span className="font-medium">{r.nome}</span>
        <SeloSituacao situacao={r.situacao} />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center">
        {[
          ['Disp.', `${r.disponibilidade}%`],
          ['Risco', r.riscoAgora],
          ['Ocorr.', r.ocorrenciasAtivas],
          ['Agentes', r.agentesAtivos],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md bg-muted/50 py-1">
            <div className="text-sm font-semibold tabular-nums">{v}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
          </div>
        ))}
      </div>
      {r.motivos.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{r.motivos.join(' · ')}</p>}
    </button>
  );
}

function ListaManutencao({ equipamentos }: { equipamentos: Equipamento[] }) {
  const selecionar = useFiltros((s) => s.selecionar);
  const itens = useMemo(
    () =>
      equipamentos
        .filter((e) => precisaManutencao(e))
        .map((e) => ({ e, dias: e.manutencaoTipo === 'imediata' ? -999 : (diasAte(e.manutencaoProxima) ?? 0) }))
        .sort((a, b) => a.dias - b.dias),
    [equipamentos],
  );
  if (!itens.length) return <Vazio texto="Nenhuma manutenção pendente nos próximos 7 dias." />;
  return (
    <div className="flex flex-col gap-1.5">
      {itens.map(({ e, dias }) => (
        <button key={e.id} onClick={() => selecionar({ tipo: 'equipamento', id: e.id })} className="flex items-center gap-3 rounded-lg border bg-card/60 p-2.5 text-left hover:bg-muted/60">
          <span className="text-lg">{TIPOS_POR_CODIGO[e.tipo]?.icone}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{e.numeroSerie}</span>
            <span className="block truncate text-xs text-muted-foreground">{TIPOS_POR_CODIGO[e.tipo]?.nome} · {e.bairro}</span>
          </span>
          <span className={cn('shrink-0 text-right text-xs', dias < 0 ? 'text-red-400' : 'text-amber-400')}>
            {e.manutencaoTipo === 'imediata' ? 'Imediata' : dias < 0 ? `Vencida há ${-dias}d` : dias === 0 ? 'Hoje' : `Em ${dias}d`}
            <span className="block text-muted-foreground">{e.manutencaoTipo === 'imediata' ? <SeloStatus status={e.status} /> : data(e.manutencaoProxima)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function ListaOcorrencias({ ocorrencias }: { ocorrencias: Ocorrencia[] }) {
  const selecionar = useFiltros((s) => s.selecionar);
  const agentes = useOperacao((s) => s.agentes);
  if (!ocorrencias.length) return <Vazio texto="Nenhuma ocorrência em andamento." />;
  return (
    <div className="flex flex-col gap-1.5">
      {ocorrencias.map((o) => (
        <button key={o.id} onClick={() => selecionar({ tipo: 'ocorrencia', id: o.id })} className="flex items-center gap-3 rounded-lg border bg-card/60 p-2.5 text-left hover:bg-muted/60">
          <span className="text-lg">{OCORRENCIA_POR_CODIGO[o.tipo]?.icone}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{OCORRENCIA_POR_CODIGO[o.tipo]?.rotulo}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {o.bairro} · {REGIAO_POR_CODIGO[o.regiao]?.nome} · {o.agenteId ? `equipe: ${agentes[o.agenteId]?.nome ?? '—'}` : 'sem equipe'}
            </span>
          </span>
          <span className="shrink-0 text-right text-xs text-muted-foreground">
            {hora(o.inicio)}
            <span className="block" style={{ color: o.gravidade === 3 ? '#ef4444' : o.gravidade === 2 ? '#f97316' : undefined }}>grav. {o.gravidade}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function PainelLateral({ equipamentos }: { equipamentos: Equipamento[] }) {
  const alertasMapa = useOperacao((s) => s.alertas);
  const ocorrenciasMapa = useOperacao((s) => s.ocorrencias);
  const resumo = useOperacao((s) => s.resumo);
  const { focar, set } = useFiltros();
  const alertas = useMemo(
    () => Object.values(alertasMapa).sort((a, b) => ORDEM_NIVEL[a.nivel] - ORDEM_NIVEL[b.nivel] || b.criadoEm.localeCompare(a.criadoEm)),
    [alertasMapa],
  );
  const ocorrencias = useMemo(() => Object.values(ocorrenciasMapa).sort((a, b) => b.gravidade - a.gravidade || b.inicio.localeCompare(a.inicio)), [ocorrenciasMapa]);
  const manut = useMemo(() => equipamentos.filter((e) => precisaManutencao(e)).length, [equipamentos]);

  return (
    <Tabs defaultValue="alertas" className="h-full min-h-0">
      <TabsList className="w-full">
        <TabsTrigger value="alertas">Alertas {alertas.length > 0 && <span className="text-xs text-red-400">{alertas.length}</span>}</TabsTrigger>
        <TabsTrigger value="regioes">Regiões</TabsTrigger>
        <TabsTrigger value="manutencao">Manut. <span className="text-xs text-amber-400">{manut}</span></TabsTrigger>
        <TabsTrigger value="ocorrencias">Ocorr. <span className="text-xs">{ocorrencias.length}</span></TabsTrigger>
      </TabsList>
      <ScrollArea className="min-h-0 flex-1 pr-2">
        <TabsContent value="alertas"><ListaAlertas alertas={alertas} /></TabsContent>
        <TabsContent value="regioes">
          <div className="flex flex-col gap-2">
            {resumo?.regioes.map((r) => (
              <CartaoRegiao key={r.regiao} r={r} onClick={() => { focar(r.regiao); set({ regioes: [r.regiao] }); }} />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="manutencao"><ListaManutencao equipamentos={equipamentos} /></TabsContent>
        <TabsContent value="ocorrencias"><ListaOcorrencias ocorrencias={ocorrencias} /></TabsContent>
      </ScrollArea>
    </Tabs>
  );
}
