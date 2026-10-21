'use client';

import { ArrowDownRight, ArrowRight, ArrowUpRight, BrainCircuit, Info, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { REGIOES, REGIAO_POR_CODIGO, TIPOS_POR_CODIGO } from '@/lib/catalog';
import { data, dataHora, hora, pct } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { useFiltros } from '@/stores/filtros';
import { useRouter } from 'next/navigation';
import { COR_NIVEL, SeloNivel } from './selos';
import { useAgora } from './use-agora';
import { useApi } from './use-api';

interface Explicacao {
  oQue: string;
  dados: string;
  como: string;
  uso: string;
}

function BlocoExplicacao({ e }: { e?: Explicacao }) {
  if (!e) return null;
  const itens = [
    ['O que é previsto', e.oQue],
    ['Dados considerados', e.dados],
    ['Como é calculado', e.como],
    ['Como ajuda a decidir', e.uso],
  ];
  return (
    <details className="group rounded-lg border bg-muted/30 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
        <Info className="size-3.5" /> Como esta previsão funciona
        <span className="ml-auto group-open:hidden">mostrar</span>
        <span className="ml-auto hidden group-open:inline">ocultar</span>
      </summary>
      <dl className="grid gap-3 border-t px-3 py-3 md:grid-cols-2">
        {itens.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-semibold text-primary">{k}</dt>
            <dd className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

const configRegioes = Object.fromEntries(REGIOES.map((r) => [r.codigo, { label: r.nome, color: r.cor }])) satisfies ChartConfig;
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ------------------------------------------------------------------ risco

interface PontoPrevisao { inicio: string; hora: number; esperado: number; indice: number; nivel: 'baixo' | 'moderado' | 'alto' | 'critico' }
interface RespostaRisco {
  proximas: Record<string, PontoPrevisao[]>;
  picos: (PontoPrevisao & { regiao: string; nome: string })[];
  tendencias: { regiao: string; nome: string; semanal: number[]; variacaoPctSemana: number; r2: number; direcao: 'alta' | 'estavel' | 'queda' }[];
  fatorInfra: Record<string, number>;
  matriz: Record<string, number[][]>;
  explicacao: Explicacao;
}

function MapaCalor({ matriz }: { matriz: number[][] }) {
  const max = Math.max(...matriz.flat(), 0.001);
  const agora = new Date(useAgora() - 3 * 3600000);
  const diaAtual = agora.getUTCDay();
  const horaAtual = agora.getUTCHours();
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-[3px] text-[10px]">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center text-muted-foreground">{h % 3 === 0 ? `${h}h` : ''}</span>
        ))}
        {matriz.map((linha, d) => (
          <div key={d} className="contents">
            <span className="self-center text-muted-foreground">{DIAS[d]}</span>
            {linha.map((v, h) => {
              const t = v / max;
              return (
                <span
                  key={h}
                  title={`${DIAS[d]} ${h}h — ${v.toFixed(2)} ocorrências esperadas/hora`}
                  className={cn('aspect-square rounded-[3px]', d === diaAtual && h === horaAtual && 'ring-2 ring-primary')}
                  style={{ backgroundColor: `color-mix(in oklch, oklch(0.62 0.22 30) ${Math.round(t * 100)}%, oklch(0.25 0.03 255))` }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        menos
        <span className="h-2 w-24 rounded-full" style={{ background: 'linear-gradient(90deg, oklch(0.25 0.03 255), oklch(0.62 0.22 30))' }} />
        mais ocorrências esperadas · contorno = agora
      </div>
    </div>
  );
}

function SecaoRisco() {
  const { dado } = useApi<RespostaRisco>('/api/previsoes/risco?horas=24');
  const [regiaoCalor, setRegiaoCalor] = useState('todas');
  const serie = useMemo(() => {
    if (!dado) return [];
    const base = dado.proximas[REGIOES[0].codigo] ?? [];
    return base.map((p, i) => ({ hora: hora(p.inicio), ...Object.fromEntries(REGIOES.map((r) => [r.codigo, dado.proximas[r.codigo]?.[i]?.indice ?? 0])) }));
  }, [dado]);

  return (
    <>
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Risco nas próximas 24 horas</CardTitle>
          <CardDescription>Índice de 0 a 100 por região — acima de 85 é crítico.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!dado ? (
            <Skeleton className="h-72" />
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {dado.picos.map((p) => (
                  <div key={p.regiao} className="rounded-lg border p-2.5" style={{ borderTop: `3px solid ${COR_NIVEL[p.nivel]}` }}>
                    <div className="text-xs text-muted-foreground">{p.nome}</div>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-xl font-semibold tabular-nums">{p.indice}</span>
                      <SeloNivel nivel={p.nivel} />
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      pico às {p.hora}h · ~{p.esperado.toFixed(1)} ocorr./h
                      {dado.fatorInfra[p.regiao] > 1.01 && ` · +${Math.round((dado.fatorInfra[p.regiao] - 1) * 100)}% infraestrutura`}
                    </div>
                  </div>
                ))}
              </div>
              <ChartContainer config={configRegioes} className="h-64 w-full">
                <LineChart data={serie} margin={{ left: -16, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeOpacity={0.12} />
                  <XAxis dataKey="hora" tickLine={false} axisLine={false} minTickGap={24} fontSize={11} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={11} />
                  <ReferenceLine y={85} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.6} />
                  <ReferenceLine y={65} stroke="#f97316" strokeDasharray="4 4" strokeOpacity={0.4} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {REGIOES.map((r) => (
                    <Line key={r.codigo} dataKey={r.codigo} stroke={`var(--color-${r.codigo})`} dot={false} strokeWidth={2} type="monotone" />
                  ))}
                </LineChart>
              </ChartContainer>
            </>
          )}
          <BlocoExplicacao e={dado?.explicacao} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Padrão semanal de ocorrências</CardTitle>
          <CardDescription>Quando cada região costuma precisar de atenção.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <ToggleGroup value={[regiaoCalor]} onValueChange={(v) => v[0] && setRegiaoCalor(v[0])} variant="outline" size="sm" className="flex-wrap">
            <ToggleGroupItem value="todas">Cidade</ToggleGroupItem>
            {REGIOES.map((r) => <ToggleGroupItem key={r.codigo} value={r.codigo}>{r.nome.replace('Zona ', '')}</ToggleGroupItem>)}
          </ToggleGroup>
          {dado ? <MapaCalor matriz={dado.matriz[regiaoCalor]} /> : <Skeleton className="h-52" />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tendência por região</CardTitle>
          <CardDescription>Ocorrências por semana nas últimas 12 semanas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {!dado
            ? <Skeleton className="h-52" />
            : dado.tendencias.map((t) => {
                const Icone = t.direcao === 'alta' ? ArrowUpRight : t.direcao === 'queda' ? ArrowDownRight : ArrowRight;
                return (
                  <div key={t.regiao} className="grid grid-cols-[110px_1fr_110px] items-center gap-3">
                    <span className="text-sm">{t.nome}</span>
                    <ChartContainer config={{ v: { label: 'Ocorrências', color: REGIAO_POR_CODIGO[t.regiao]?.cor } }} className="h-9 w-full">
                      <BarChart data={t.semanal.map((v, i) => ({ s: `${12 - i} sem. atrás`, v }))} margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
                        <ChartTooltip content={<ChartTooltipContent hideIndicator labelKey="s" />} />
                        <Bar dataKey="v" fill="var(--color-v)" radius={2} />
                      </BarChart>
                    </ChartContainer>
                    <span className={cn('flex items-center justify-end gap-1 text-xs', t.direcao === 'alta' ? 'text-red-400' : t.direcao === 'queda' ? 'text-emerald-400' : 'text-muted-foreground')}>
                      <Icone className="size-3.5" />
                      {t.variacaoPctSemana > 0 ? '+' : ''}
                      {t.variacaoPctSemana}%/sem
                    </span>
                  </div>
                );
              })}
          <p className="text-xs text-muted-foreground">Alta/queda só é marcada quando a reta explica bem os dados (R² ≥ 0,3), para não confundir oscilação com tendência.</p>
        </CardContent>
      </Card>
    </>
  );
}

// ------------------------------------------------------------------ reforço

interface RespostaReforco {
  turnos: {
    turno: string; rotulo: string; inicio: string; fim: string; emAndamento: boolean;
    linhas: { regiao: string; nome: string; esperado: number; necessarios: number; escalados: number; saldo: number }[];
    sugestoes: { de: string; para: string; deNome: string; paraNome: string; quantidade: number }[];
  }[];
  explicacao: Explicacao;
}

function SecaoReforco() {
  const { dado } = useApi<RespostaReforco>('/api/previsoes/reforco');
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reforço de agentes por turno</CardTitle>
        <CardDescription>Necessidade prevista x escala atual, com sugestões de remanejamento.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!dado ? (
          <Skeleton className="h-64" />
        ) : (
          <Tabs defaultValue={dado.turnos[0]?.inicio}>
            <TabsList>
              {dado.turnos.map((t) => (
                <TabsTrigger key={t.inicio} value={t.inicio}>
                  {t.rotulo.split(' ')[0]} {t.emAndamento ? '(agora)' : dataHora(t.inicio).slice(0, 5)}
                </TabsTrigger>
              ))}
            </TabsList>
            {dado.turnos.map((t) => (
              <TabsContent key={t.inicio} value={t.inicio} className="grid gap-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Região</TableHead>
                      <TableHead className="text-right">Ocorr. esperadas</TableHead>
                      <TableHead className="text-right">Necessários</TableHead>
                      <TableHead className="text-right">Escalados</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {t.linhas.map((l) => (
                      <TableRow key={l.regiao}>
                        <TableCell>{l.nome}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.esperado.toFixed(1)}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.necessarios}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.escalados}</TableCell>
                        <TableCell className={cn('text-right font-semibold tabular-nums', l.saldo < 0 ? 'text-red-400' : l.saldo > 2 ? 'text-sky-300' : 'text-emerald-400')}>
                          {l.saldo > 0 ? `+${l.saldo}` : l.saldo}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {t.sugestoes.length ? (
                  <ul className="grid gap-1.5">
                    {t.sugestoes.map((s, i) => (
                      <li key={i} className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
                        <ArrowRight className="size-4 text-primary" />
                        Deslocar <strong>{s.quantidade}</strong> agente(s) de <strong>{s.deNome}</strong> para <strong>{s.paraNome}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t.linhas.some((l) => l.saldo < 0) ? 'Falta gente e não há sobra em outras regiões: considere convocar reforço extra.' : 'Escala adequada ao risco previsto para este turno.'}
                  </p>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
        <BlocoExplicacao e={dado?.explicacao} />
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ anomalias

interface RespostaAnomalias {
  anomalias: { tipo: string; severidade: 'critico' | 'alto' | 'medio'; titulo: string; explicacao: string; regiao?: string; equipamentoId?: number }[];
  explicacao: Explicacao;
}

function SecaoAnomalias() {
  const { dado, recarregar } = useApi<RespostaAnomalias>('/api/previsoes/anomalias', 30000);
  const { selecionar, focar } = useFiltros();
  const router = useRouter();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comportamentos fora do padrão agora</CardTitle>
        <CardDescription>Sinais precoces que a central não veria só olhando a situação cadastrada.</CardDescription>
        <CardAction>
          <Button size="icon-sm" variant="ghost" onClick={recarregar} title="Atualizar"><RefreshCw /></Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-2">
        {!dado ? (
          <Skeleton className="h-40" />
        ) : !dado.anomalias.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nada fora do padrão no momento.</p>
        ) : (
          dado.anomalias.map((a, i) => (
            <button
              key={i}
              className="rounded-lg border p-3 text-left hover:bg-muted/50"
              style={{ borderLeft: `3px solid ${COR_NIVEL[a.severidade]}` }}
              onClick={() => {
                if (a.equipamentoId) selecionar({ tipo: 'equipamento', id: a.equipamentoId });
                if (a.regiao) focar(a.regiao);
                router.push('/');
              }}
            >
              <div className="flex items-center gap-2">
                <SeloNivel nivel={a.severidade} />
                <span className="text-sm font-medium">{a.titulo}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{a.explicacao}</p>
            </button>
          ))
        )}
        <BlocoExplicacao e={dado?.explicacao} />
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ manutenção

interface RespostaManutencao {
  topRisco: { id: number; numeroSerie: string; tipo: string; tipoNome: string; modelo: string; bairro: string; regiaoNome: string; probabilidade7d: number; fatores: string[] }[];
  falhasEsperadas7d: number;
  modelos: { tipo: string; tipoNome: string; marca: string; modelo: string; equipamentos: number; falhas: number; exposicaoAnos: number; taxaAno: number; razao: number }[];
  disponibilidade: {
    cidade: { dias: { data: string; disponibilidade: number }[]; inclinacaoPpDia: number; r2: number; projecao7d: number };
    regioes: { grupo: string; nome: string; dias: { data: string; disponibilidade: number }[]; inclinacaoPpDia: number; r2: number; projecao7d: number }[];
  };
  explicacao: Explicacao;
}

const configDisp = { disponibilidade: { label: 'Disponibilidade', color: 'var(--chart-3)' }, projecao: { label: 'Projeção', color: 'var(--chart-1)' } } satisfies ChartConfig;

function SecaoManutencao() {
  const { dado } = useApi<RespostaManutencao>('/api/previsoes/manutencao');
  const { selecionar } = useFiltros();
  const router = useRouter();
  const serieDisp = useMemo(() => {
    if (!dado) return [];
    const c = dado.disponibilidade.cidade;
    const pontos = c.dias.map((d) => ({ data: data(d.data).slice(0, 5), disponibilidade: d.disponibilidade, projecao: null as number | null }));
    const ultimo = c.dias[c.dias.length - 1];
    if (ultimo) {
      pontos[pontos.length - 1].projecao = ultimo.disponibilidade;
      const passo = (c.projecao7d - ultimo.disponibilidade) / 7;
      for (let i = 1; i <= 7; i++) {
        const d = new Date(Date.parse(`${ultimo.data}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
        pontos.push({ data: data(d).slice(0, 5), disponibilidade: null as unknown as number, projecao: Math.round((ultimo.disponibilidade + passo * i) * 10) / 10 });
      }
    }
    return pontos;
  }, [dado]);

  return (
    <>
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Manutenção preditiva</CardTitle>
          <CardDescription>
            {dado ? <>~<strong className="text-foreground">{dado.falhasEsperadas7d}</strong> falhas esperadas na próxima semana. Os equipamentos abaixo concentram o risco.</> : 'Calculando…'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Por quê</TableHead>
                  <TableHead className="text-right">Falha em 7d</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dado?.topRisco.slice(0, 8).map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => { selecionar({ tipo: 'equipamento', id: r.id }); router.push('/'); }}>
                    <TableCell>
                      <span className="block font-mono text-xs">{TIPOS_POR_CODIGO[r.tipo]?.icone} {r.numeroSerie}</span>
                      <span className="block text-xs text-muted-foreground">{r.bairro}</span>
                    </TableCell>
                    <TableCell className="max-w-56 text-xs whitespace-normal text-muted-foreground">{r.fatores.join('; ') || 'taxa normal do modelo'}</TableCell>
                    <TableCell className={cn('text-right font-semibold tabular-nums', r.probabilidade7d > 0.2 ? 'text-red-400' : 'text-amber-400')}>
                      {pct(r.probabilidade7d * 100)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid content-start gap-2">
            <h4 className="text-sm font-medium">Modelos que mais falham (vs. média do tipo)</h4>
            {dado?.modelos.slice(0, 7).map((m) => (
              <div key={`${m.tipo}-${m.modelo}`} className="grid grid-cols-[1fr_120px_52px] items-center gap-2 text-sm">
                <span className="truncate">
                  {m.marca} {m.modelo} <span className="text-xs text-muted-foreground">· {m.tipoNome} ({m.equipamentos} un., {m.falhas} falhas)</span>
                </span>
                <span className="h-2 rounded-full bg-muted">
                  <span className={cn('block h-2 rounded-full', m.razao >= 1.4 ? 'bg-red-400' : m.razao >= 1.1 ? 'bg-amber-400' : 'bg-emerald-400')}
                    style={{ width: `${Math.min(100, (m.razao / 2.5) * 100)}%` }} />
                </span>
                <span className="text-right tabular-nums">{m.razao.toFixed(1)}×</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">1,0× = falha como a média do seu tipo. Útil para acionar garantia ou evitar o modelo em novas compras.</p>
          </div>
          <div className="lg:col-span-2">
            <BlocoExplicacao e={dado?.explicacao} />
          </div>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Disponibilidade dos equipamentos: últimos 30 dias e projeção</CardTitle>
          <CardDescription>
            {dado && (
              <>
                Cidade: {dado.disponibilidade.cidade.inclinacaoPpDia > 0 ? '+' : ''}
                {dado.disponibilidade.cidade.inclinacaoPpDia} p.p./dia · projeção em 7 dias: <strong className="text-foreground">{pct(dado.disponibilidade.cidade.projecao7d)}</strong>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {dado ? (
            <ChartContainer config={configDisp} className="h-64 w-full">
              <AreaChart data={serieDisp} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.12} />
                <XAxis dataKey="data" tickLine={false} axisLine={false} minTickGap={24} fontSize={11} />
                <YAxis domain={['dataMin - 2', 100]} tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => `${Math.round(v)}%`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area dataKey="disponibilidade" stroke="var(--color-disponibilidade)" fill="var(--color-disponibilidade)" fillOpacity={0.15} strokeWidth={2} connectNulls={false} />
                <Area dataKey="projecao" stroke="var(--color-projecao)" fill="transparent" strokeDasharray="5 5" strokeWidth={2} connectNulls />
              </AreaChart>
            </ChartContainer>
          ) : (
            <Skeleton className="h-64" />
          )}
          <div className="grid content-start gap-2">
            {dado?.disponibilidade.regioes
              .sort((a, b) => a.inclinacaoPpDia - b.inclinacaoPpDia)
              .map((r) => {
                const atual = r.dias[r.dias.length - 1]?.disponibilidade ?? 100;
                const queda = r.inclinacaoPpDia < -0.1 && r.r2 >= 0.2;
                return (
                  <div key={r.grupo} className="rounded-lg border p-2.5 text-sm">
                    <div className="flex justify-between">
                      <span>{r.nome}</span>
                      <span className="tabular-nums">{pct(atual)}</span>
                    </div>
                    <div className={cn('text-xs', queda ? 'text-red-400' : 'text-muted-foreground')}>
                      {queda ? `Em queda: ${r.inclinacaoPpDia} p.p./dia → ${pct(r.projecao7d)} em 7 dias` : `Estável (${r.inclinacaoPpDia > 0 ? '+' : ''}${r.inclinacaoPpDia} p.p./dia)`}
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export function Previsoes() {
  return (
    <div className="grid gap-4">
      <Card className="flex-row items-start gap-3 border-primary/30 bg-primary/5 p-4">
        <BrainCircuit className="mt-0.5 size-5 shrink-0 text-primary" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          <strong className="text-foreground">PROMETHEUS já enxerga o presente; aqui ele tenta enxergar amanhã.</strong> As previsões usam o histórico de
          ocorrências, falhas e telemetria guardado pelo F.O.G.O. e são recalculadas a cada minuto. Todos os modelos são estatísticos e explicáveis
          (sem caixa-preta): cada bloco diz o que prevê, com quais dados e como usar.
        </p>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <SecaoRisco />
        <SecaoReforco />
        <SecaoAnomalias />
        <SecaoManutencao />
      </div>
    </div>
  );
}
