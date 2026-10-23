'use client';

import { ArrowUpDown, Download, MapPin, Pencil, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ORGAOS, REGIAO_POR_CODIGO, STATUS_POR_CODIGO, TIPOS_POR_CODIGO, TIPOS_EQUIPAMENTO } from '@/lib/catalog';
import { data, diasAte, hojeLocal, tempoRelativo } from '@/lib/formato';
import type { Equipamento } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useFiltros } from '@/stores/filtros';
import { useOperacao } from '@/stores/operacao';
import { EscolhaMultipla } from './escolha';
import { OPCOES_ORGAO, OPCOES_REGIAO, OPCOES_STATUS, OPCOES_TIPO, filtrarEquipamentos, opcoesBairro } from './filtros-central';
import { Paginacao, baixarCsv } from './paginacao';
import { SeloStatus } from './selos';

type Coluna = 'numeroSerie' | 'tipo' | 'bairro' | 'status' | 'manutencaoProxima' | 'ultimoSinal';
const POR_PAGINA = 25;

function Manutencao({ e }: { e: Equipamento }) {
  if (e.status === 'nao_instalado' || e.status === 'desativado') return <span className="text-muted-foreground">—</span>;
  if (e.manutencaoTipo === 'imediata') return <span className="font-medium text-red-400">Imediata</span>;
  const d = diasAte(e.manutencaoProxima);
  return (
    <span className={cn(d !== null && d < 0 ? 'text-red-400' : d !== null && d <= 7 ? 'text-amber-400' : '')}>
      {data(e.manutencaoProxima)}
      {d !== null && d < 0 && <span className="block text-[11px]">vencida há {-d}d</span>}
      {d !== null && d >= 0 && d <= 7 && <span className="block text-[11px]">em {d}d</span>}
    </span>
  );
}

function Cabecalho({ col, ordem, aoOrdenar, children }: {
  col: Coluna; ordem: { col: Coluna; asc: boolean }; aoOrdenar: (c: Coluna) => void; children: React.ReactNode;
}) {
  return (
    <TableHead>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => aoOrdenar(col)}>
        {children}
        <ArrowUpDown className={cn('size-3', ordem.col === col ? 'text-primary' : 'opacity-40')} />
      </button>
    </TableHead>
  );
}

export function Inventario() {
  const router = useRouter();
  const equipamentosMapa = useOperacao((s) => s.equipamentos);
  const carregado = useOperacao((s) => s.carregado);
  const { selecionar, focar } = useFiltros();
  const [busca, setBusca] = useState('');
  const [tipos, setTipos] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>([]);
  const [regioes, setRegioes] = useState<string[]>([]);
  const [bairros, setBairros] = useState<string[]>([]);
  const [orgaos, setOrgaos] = useState<string[]>([]);
  const [somenteManutencao, setSomenteManutencao] = useState(false);
  const [ordem, setOrdem] = useState<{ col: Coluna; asc: boolean }>({ col: 'numeroSerie', asc: true });
  const [pagina, setPagina] = useState(1);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrados = filtrarEquipamentos(Object.values(equipamentosMapa), { tipos, status, regioes, bairros, orgaos, somenteManutencao }).filter(
      (e) =>
        !q ||
        [e.numeroSerie, e.marca, e.modelo, e.logradouro, e.referencia, e.bairro, TIPOS_POR_CODIGO[e.tipo]?.nome].some((v) => v?.toLowerCase().includes(q)),
    );
    const val = (e: Equipamento) =>
      ordem.col === 'tipo' ? (TIPOS_POR_CODIGO[e.tipo]?.nome ?? '') : ordem.col === 'status' ? STATUS_POR_CODIGO[e.status].rotulo : ((e[ordem.col] as string | null) ?? '');
    return filtrados.sort((a, b) => val(a).localeCompare(val(b), 'pt-BR') * (ordem.asc ? 1 : -1));
  }, [equipamentosMapa, busca, tipos, status, regioes, bairros, orgaos, somenteManutencao, ordem]);

  const paginaAtual = Math.min(pagina, Math.max(1, Math.ceil(lista.length / POR_PAGINA)));
  const visiveis = lista.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);
  const resetar = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPagina(1);
  };

  const ordenar = (col: Coluna) => setOrdem((o) => ({ col, asc: o.col === col ? !o.asc : true }));

  const exportar = () =>
    baixarCsv(
      `equipamentos-${hojeLocal()}.csv`,
      ['Número de série', 'Tipo', 'Marca', 'Modelo', 'Órgão', 'Situação', 'Logradouro', 'Referência', 'Bairro', 'Região', 'CEP', 'Cidade', 'UF', 'Latitude', 'Longitude', 'Manutenção', 'Próxima manutenção', 'Última manutenção', 'Instalado em'],
      lista.map((e) => [
        e.numeroSerie, TIPOS_POR_CODIGO[e.tipo]?.nome, e.marca, e.modelo, ORGAOS.find((o) => o.codigo === e.orgao)?.nome, STATUS_POR_CODIGO[e.status].rotulo,
        e.logradouro, e.referencia, e.bairro, REGIAO_POR_CODIGO[e.regiao]?.nome, e.cep, e.cidade, e.uf, e.lat.toFixed(6), e.lng.toFixed(6), e.manutencaoTipo,
        e.manutencaoProxima, e.ultimaManutencao, e.instaladoEm,
      ]),
    );

  const porGrupo = useMemo(() => {
    const cont: Record<string, number> = {};
    for (const e of Object.values(equipamentosMapa)) cont[TIPOS_POR_CODIGO[e.tipo]?.grupo ?? 'Outros'] = (cont[TIPOS_POR_CODIGO[e.tipo]?.grupo ?? 'Outros'] ?? 0) + 1;
    return [...new Set(TIPOS_EQUIPAMENTO.map((t) => t.grupo))].map((g) => [g, cont[g] ?? 0] as const);
  }, [equipamentosMapa]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {porGrupo.map(([g, n]) => (
          <span key={g} className="rounded-full border bg-card px-3 py-1 text-xs">
            {g} <span className="font-semibold tabular-nums">{n}</span>
          </span>
        ))}
      </div>

      <Card className="gap-3 p-4">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_1fr_1fr_1fr_1fr_1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar nº de série, marca, rua, bairro…" value={busca} onChange={(e) => resetar(setBusca)(e.target.value)} />
          </div>
          <EscolhaMultipla valores={tipos} aoMudar={resetar(setTipos)} opcoes={OPCOES_TIPO} rotuloVazio="Todos os tipos" />
          <EscolhaMultipla valores={status} aoMudar={resetar(setStatus)} opcoes={OPCOES_STATUS} rotuloVazio="Todas as situações" />
          <EscolhaMultipla valores={regioes} aoMudar={resetar(setRegioes)} opcoes={OPCOES_REGIAO} rotuloVazio="Todas as regiões" />
          <EscolhaMultipla valores={bairros} aoMudar={resetar(setBairros)} opcoes={opcoesBairro(regioes)} rotuloVazio="Todos os bairros" />
          <EscolhaMultipla valores={orgaos} aoMudar={resetar(setOrgaos)} opcoes={OPCOES_ORGAO} rotuloVazio="Todos os órgãos" />
          <label className="flex items-center gap-2 text-sm whitespace-nowrap">
            <Switch checked={somenteManutencao} onCheckedChange={resetar(setSomenteManutencao)} /> Manutenção
          </label>
          <Button variant="outline" onClick={exportar} disabled={!lista.length}>
            <Download /> CSV
          </Button>
          <Link href="/equipamentos/novo" className={buttonVariants()}>
            <Plus /> Novo
          </Link>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <Cabecalho col="numeroSerie" ordem={ordem} aoOrdenar={ordenar}>Nº de série</Cabecalho>
                <Cabecalho col="tipo" ordem={ordem} aoOrdenar={ordenar}>Tipo</Cabecalho>
                <TableHead>Marca / modelo</TableHead>
                <Cabecalho col="bairro" ordem={ordem} aoOrdenar={ordenar}>Local</Cabecalho>
                <Cabecalho col="status" ordem={ordem} aoOrdenar={ordenar}>Situação</Cabecalho>
                <Cabecalho col="manutencaoProxima" ordem={ordem} aoOrdenar={ordenar}>Próx. manutenção</Cabecalho>
                <Cabecalho col="ultimoSinal" ordem={ordem} aoOrdenar={ordenar}>Último sinal</Cabecalho>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((e) => (
                <TableRow key={e.id} className="cursor-pointer" onClick={() => router.push(`/equipamentos/${e.id}`)}>
                  <TableCell className="font-mono text-xs">{e.numeroSerie}</TableCell>
                  <TableCell>
                    <span className="mr-1.5">{TIPOS_POR_CODIGO[e.tipo]?.icone}</span>
                    {TIPOS_POR_CODIGO[e.tipo]?.nome}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.marca} {e.modelo}
                  </TableCell>
                  <TableCell>
                    <span className="block">{e.bairro}</span>
                    <span className="block max-w-56 truncate text-xs text-muted-foreground">
                      {e.logradouro}, {e.referencia}
                    </span>
                  </TableCell>
                  <TableCell><SeloStatus status={e.status} /></TableCell>
                  <TableCell><Manutencao e={e} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.status === 'nao_instalado' ? '—' : tempoRelativo(e.ultimoSinal)}</TableCell>
                  <TableCell onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Ver no mapa"
                        onClick={() => {
                          selecionar({ tipo: 'equipamento', id: e.id });
                          focar(e.regiao);
                          router.push('/');
                        }}
                      >
                        <MapPin />
                      </Button>
                      <Link href={`/equipamentos/${e.id}`} className={buttonVariants({ size: 'icon-sm', variant: 'ghost' })} title="Editar">
                        <Pencil />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!visiveis.length && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    {carregado ? 'Nenhum equipamento encontrado com esses filtros.' : 'Carregando inventário…'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <Paginacao pagina={paginaAtual} total={lista.length} porPagina={POR_PAGINA} aoMudar={setPagina} />
      </Card>
    </div>
  );
}
