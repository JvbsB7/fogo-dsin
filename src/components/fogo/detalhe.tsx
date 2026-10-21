'use client';

// Ficha do item selecionado no mapa (equipamento, agente ou ocorrência), com ações rápidas.
import { CheckCircle2, ExternalLink, Pencil, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  FUNCAO_POR_CODIGO, MANUTENCAO_TIPOS, OCORRENCIA_POR_CODIGO, ORGAOS, REGIAO_POR_CODIGO, STATUS_EQUIPAMENTO, STATUS_POR_CODIGO,
  TIPOS_POR_CODIGO, TURNOS, type StatusEquipamento,
} from '@/lib/catalog';
import { data, dataHora, hora, pct, tempoRelativo } from '@/lib/formato';
import type { Agente, Equipamento, Ocorrencia } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useFiltros } from '@/stores/filtros';
import { useOperacao } from '@/stores/operacao';
import { Escolha } from './escolha';
import { SeloAgente, SeloStatus } from './selos';

function Linha({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right">{v ?? '—'}</span>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
      {children}
    </section>
  );
}

export function valorAtributo(v: unknown) {
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

interface Extras {
  historico: { de: string | null; para: StatusEquipamento; em: string; motivo: string }[];
  leituras: { hora: string; fluxo: number }[];
  agente: { id: number; nome: string; matricula: string; status: string } | null;
  risco: { probabilidade7d: number; fatores: string[] } | null;
}

const configFluxo = { fluxo: { label: 'Veículos/h', color: 'var(--chart-2)' } } satisfies ChartConfig;

function DetalheEquipamento({ e }: { e: Equipamento }) {
  const [extras, setExtras] = useState<Extras | null>(null);
  // null = "manter a situação atual" (acompanha as mudanças que chegam ao vivo).
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const novoStatus = escolhido ?? e.status;
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const upsert = useOperacao((s) => s.upsertEquipamento);
  const def = TIPOS_POR_CODIGO[e.tipo];

  useEffect(() => {
    let vivo = true;
    fetch(`/api/equipamentos/${e.id}`).then(async (r) => {
      if (r.ok && vivo) setExtras(await r.json());
    });
    return () => {
      vivo = false;
    };
  }, [e.id, e.status, e.ultimaManutencao]);

  const acao = async (url: string, init: RequestInit, sucesso: string) => {
    setEnviando(true);
    try {
      const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } });
      if (!r.ok) throw new Error((await r.json()).erro);
      upsert(await r.json());
      toast.success(sucesso);
      setMotivo('');
      setEscolhido(null);
    } catch (err) {
      toast.error((err as Error).message || 'Falha ao executar a ação');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <SeloStatus status={e.status} />
        <span className="text-xs text-muted-foreground">sinal {tempoRelativo(e.ultimoSinal)}</span>
      </div>

      <Secao titulo="Ações rápidas">
        <div className="grid gap-2 rounded-lg border p-3">
          <div className="flex gap-2">
            <Escolha valor={novoStatus} aoMudar={setEscolhido} opcoes={STATUS_EQUIPAMENTO.map((s) => ({ valor: s.codigo, rotulo: s.rotulo }))} />
            <Button
              disabled={enviando || novoStatus === e.status}
              onClick={() => acao(`/api/equipamentos/${e.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: novoStatus, motivo }) }, 'Situação atualizada')}
            >
              Aplicar
            </Button>
          </div>
          <Input placeholder="Motivo (opcional)" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={enviando} onClick={() => acao(`/api/equipamentos/${e.id}/manutencao`, { method: 'POST' }, 'Manutenção registrada')}>
              <Wrench /> Manutenção concluída
            </Button>
            <Link href={`/equipamentos/${e.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              <Pencil /> Editar cadastro
            </Link>
          </div>
        </div>
      </Secao>

      {extras?.risco && (
        <Secao titulo="Previsão de falha (7 dias)">
          <div className="rounded-lg border p-3">
            <div className="flex items-baseline gap-2">
              <span className={cn('text-2xl font-semibold', extras.risco.probabilidade7d > 0.2 ? 'text-red-400' : extras.risco.probabilidade7d > 0.08 ? 'text-amber-400' : 'text-emerald-400')}>
                {pct(extras.risco.probabilidade7d * 100)}
              </span>
              <span className="text-xs text-muted-foreground">de chance de falhar na próxima semana</span>
            </div>
            {extras.risco.fatores.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Fatores: {extras.risco.fatores.join('; ')}</p>}
          </div>
        </Secao>
      )}

      <Secao titulo="Identificação">
        <Linha k="Número de série" v={<span className="font-mono">{e.numeroSerie}</span>} />
        <Linha k="Marca / modelo" v={`${e.marca} ${e.modelo}`} />
        <Linha k="Órgão" v={ORGAOS.find((o) => o.codigo === e.orgao)?.nome} />
        <Linha k="Instalado em" v={data(e.instaladoEm)} />
      </Secao>

      <Secao titulo="Localização">
        <Linha k="Endereço" v={`${e.logradouro}, ${e.referencia}`} />
        <Linha k="Bairro" v={`${e.bairro} (${REGIAO_POR_CODIGO[e.regiao]?.nome})`} />
        <Linha k="CEP / cidade" v={`${e.cep} · ${e.cidade}/${e.uf}`} />
        <Linha
          k="GPS"
          v={
            <a className="inline-flex items-center gap-1 font-mono text-xs text-sky-300 hover:underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${e.lat}&mlon=${e.lng}#map=18/${e.lat}/${e.lng}`}>
              {e.lat.toFixed(5)}, {e.lng.toFixed(5)} <ExternalLink className="size-3" />
            </a>
          }
        />
      </Secao>

      <Secao titulo="Manutenção">
        <Linha k="Necessidade" v={MANUTENCAO_TIPOS.find((m) => m.codigo === e.manutencaoTipo)?.rotulo} />
        <Linha k="Próxima" v={data(e.manutencaoProxima)} />
        <Linha k="Última" v={data(e.ultimaManutencao)} />
        <Linha k="Intervalo do tipo" v={`${def?.intervaloManutencaoDias} dias`} />
      </Secao>

      {def && def.atributos.length > 0 && (
        <Secao titulo="Características">
          {def.atributos.map((a) => <Linha key={a.campo} k={a.rotulo} v={valorAtributo(e.atributos[a.campo])} />)}
        </Secao>
      )}

      {Object.keys(e.telemetria).length > 0 && (
        <Secao titulo="Telemetria">
          {Object.entries(e.telemetria).map(([k, v]) => <Linha key={k} k={k.replaceAll('_', ' ')} v={valorAtributo(v)} />)}
        </Secao>
      )}

      {extras?.agente && (
        <Secao titulo="Em uso por">
          <Linha k={extras.agente.nome} v={extras.agente.matricula} />
        </Secao>
      )}

      {!!extras?.leituras.length && (
        <Secao titulo="Fluxo de veículos — últimas 48h">
          <ChartContainer config={configFluxo} className="h-40 w-full">
            <LineChart data={extras.leituras.map((l) => ({ hora: hora(l.hora), fluxo: l.fluxo }))} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.15} />
              <XAxis dataKey="hora" tickLine={false} axisLine={false} minTickGap={40} fontSize={10} />
              <YAxis tickLine={false} axisLine={false} fontSize={10} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line dataKey="fluxo" stroke="var(--color-fluxo)" dot={false} strokeWidth={2} />
            </LineChart>
          </ChartContainer>
        </Secao>
      )}

      {!!extras?.historico.length && (
        <Secao titulo="Histórico de situação">
          <ol className="relative ml-1 border-l pl-4">
            {extras.historico.slice(0, 10).map((h, i) => (
              <li key={i} className="mb-2 text-sm">
                <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full" style={{ backgroundColor: STATUS_POR_CODIGO[h.para]?.cor }} />
                <span className="font-medium">{STATUS_POR_CODIGO[h.para]?.rotulo}</span>
                <span className="text-muted-foreground"> · {h.motivo}</span>
                <span className="block text-xs text-muted-foreground">{dataHora(h.em)}</span>
              </li>
            ))}
          </ol>
        </Secao>
      )}
    </div>
  );
}

function DetalheAgente({ a }: { a: Agente }) {
  const equipamentos = useOperacao((s) => s.equipamentos);
  const ocorrencias = useOperacao((s) => s.ocorrencias);
  const veiculo = a.equipamentoId ? equipamentos[a.equipamentoId] : null;
  const atendendo = a.ocorrenciaId ? ocorrencias[a.ocorrenciaId] : null;
  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      <div className="flex items-center gap-2">
        <SeloAgente status={a.status} />
        <span className="text-xs text-muted-foreground">posição {tempoRelativo(a.ultimaAtualizacao)}</span>
      </div>
      <Secao titulo="Dados">
        <Linha k="Matrícula" v={<span className="font-mono">{a.matricula}</span>} />
        <Linha k="Função" v={FUNCAO_POR_CODIGO[a.funcao]?.rotulo} />
        <Linha k="Órgão" v={ORGAOS.find((o) => o.codigo === a.orgao)?.nome} />
        <Linha k="Turno" v={TURNOS.find((t) => t.codigo === a.turno)?.rotulo} />
        <Linha k="Base" v={`${a.bairroBase} (${REGIAO_POR_CODIGO[a.regiao]?.nome})`} />
        <Linha k="Telefone" v={a.telefone} />
        <Linha k="Veículo" v={veiculo ? `${TIPOS_POR_CODIGO[veiculo.tipo]?.icone} ${String(veiculo.atributos.placa ?? veiculo.numeroSerie)}` : '—'} />
      </Secao>
      {atendendo && (
        <Secao titulo="Atendendo agora">
          <Linha k={OCORRENCIA_POR_CODIGO[atendendo.tipo]?.rotulo ?? atendendo.tipo} v={`${atendendo.bairro} · desde ${hora(atendendo.inicio)}`} />
        </Secao>
      )}
      <Link href={`/agentes/${a.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        <Pencil /> Editar cadastro
      </Link>
    </div>
  );
}

function DetalheOcorrencia({ o }: { o: Ocorrencia }) {
  const agentes = useOperacao((s) => s.agentes);
  const [enviando, setEnviando] = useState(false);
  const selecionar = useFiltros((s) => s.selecionar);
  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      <Secao titulo="Ocorrência">
        <Linha k="Tipo" v={OCORRENCIA_POR_CODIGO[o.tipo]?.rotulo} />
        <Linha k="Gravidade" v={`${o.gravidade}/3`} />
        <Linha k="Início" v={dataHora(o.inicio)} />
        <Linha k="Local" v={`${o.bairro} (${REGIAO_POR_CODIGO[o.regiao]?.nome})`} />
        <Linha k="Descrição" v={o.descricao} />
        <Linha k="Origem" v={o.origem === 'simulador' ? 'Sensores / simulador' : o.origem === 'manual' ? 'Registro manual' : 'Histórico'} />
        <Linha k="Equipe" v={o.agenteId ? (agentes[o.agenteId]?.nome ?? `#${o.agenteId}`) : 'aguardando'} />
      </Secao>
      <Button
        disabled={enviando}
        onClick={async () => {
          setEnviando(true);
          const r = await fetch(`/api/ocorrencias/${o.id}`, { method: 'PATCH' });
          setEnviando(false);
          if (r.ok) {
            toast.success('Ocorrência encerrada');
            selecionar(null);
          } else toast.error('Falha ao encerrar');
        }}
      >
        <CheckCircle2 /> Encerrar ocorrência
      </Button>
    </div>
  );
}

export function DetalheSelecao() {
  const selecao = useFiltros((s) => s.selecao);
  const selecionar = useFiltros((s) => s.selecionar);
  const e = useOperacao((s) => (selecao?.tipo === 'equipamento' ? s.equipamentos[selecao.id] : undefined));
  const a = useOperacao((s) => (selecao?.tipo === 'agente' ? s.agentes[selecao.id] : undefined));
  const o = useOperacao((s) => (selecao?.tipo === 'ocorrencia' ? s.ocorrencias[selecao.id] : undefined));
  const aberto = Boolean(e || a || o);
  const titulo = e ? `${TIPOS_POR_CODIGO[e.tipo]?.icone} ${TIPOS_POR_CODIGO[e.tipo]?.nome}` : a ? `${FUNCAO_POR_CODIGO[a.funcao]?.icone} ${a.nome}` : o ? `${OCORRENCIA_POR_CODIGO[o.tipo]?.icone} Ocorrência #${o.id}` : '';
  const sub = e ? `${e.numeroSerie} · ${e.bairro}` : a ? FUNCAO_POR_CODIGO[a.funcao]?.rotulo : o ? o.bairro : '';

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && selecionar(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{titulo}</SheetTitle>
          <SheetDescription>{sub}</SheetDescription>
        </SheetHeader>
        <Separator />
        {e && <DetalheEquipamento key={e.id} e={e} />}
        {a && <DetalheAgente a={a} />}
        {o && <DetalheOcorrencia o={o} />}
      </SheetContent>
    </Sheet>
  );
}
