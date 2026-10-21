'use client';

import { Download, MapPin, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FUNCOES_AGENTE, FUNCAO_POR_CODIGO, OCORRENCIA_POR_CODIGO, REGIAO_POR_CODIGO, STATUS_AGENTE, STATUS_AGENTE_POR_CODIGO, TIPOS_POR_CODIGO, TURNOS } from '@/lib/catalog';
import { hojeLocal, tempoRelativo } from '@/lib/formato';
import { useFiltros } from '@/stores/filtros';
import { useOperacao } from '@/stores/operacao';
import { EscolhaMultipla } from './escolha';
import { OPCOES_REGIAO } from './filtros-central';
import { Paginacao, baixarCsv } from './paginacao';
import { SeloAgente } from './selos';

const POR_PAGINA = 20;

export function ListaAgentes() {
  const router = useRouter();
  const agentesMapa = useOperacao((s) => s.agentes);
  const equipamentos = useOperacao((s) => s.equipamentos);
  const ocorrencias = useOperacao((s) => s.ocorrencias);
  const { selecionar, focar } = useFiltros();
  const [busca, setBusca] = useState('');
  const [funcoes, setFuncoes] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>([]);
  const [regioes, setRegioes] = useState<string[]>([]);
  const [turnos, setTurnos] = useState<string[]>([]);
  const [pagina, setPagina] = useState(1);

  const todos = useMemo(() => Object.values(agentesMapa), [agentesMapa]);
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return todos
      .filter(
        (a) =>
          (!q || a.nome.toLowerCase().includes(q) || a.matricula.toLowerCase().includes(q)) &&
          (!funcoes.length || funcoes.includes(a.funcao)) &&
          (!status.length || status.includes(a.status)) &&
          (!regioes.length || regioes.includes(a.regiao)) &&
          (!turnos.length || turnos.includes(a.turno)),
      )
      .sort((a, b) => STATUS_AGENTE.findIndex((s) => s.codigo === a.status) - STATUS_AGENTE.findIndex((s) => s.codigo === b.status) || a.nome.localeCompare(b.nome));
  }, [todos, busca, funcoes, status, regioes, turnos]);

  const contagem = useMemo(() => Object.fromEntries(STATUS_AGENTE.map((s) => [s.codigo, todos.filter((a) => a.status === s.codigo).length])), [todos]);
  const paginaAtual = Math.min(pagina, Math.max(1, Math.ceil(lista.length / POR_PAGINA)));
  const visiveis = lista.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);
  const reset = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPagina(1);
  };

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STATUS_AGENTE.map((s) => (
          <Card key={s.codigo} className="gap-1 px-4 py-3">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: s.cor }} />
              {s.rotulo}
            </span>
            <span className="text-2xl font-semibold tabular-nums">{contagem[s.codigo]}</span>
          </Card>
        ))}
      </div>

      <Card className="gap-3 p-4">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_1fr_1fr_1fr_1fr_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar nome ou matrícula…" value={busca} onChange={(e) => reset(setBusca)(e.target.value)} />
          </div>
          <EscolhaMultipla valores={funcoes} aoMudar={reset(setFuncoes)} opcoes={FUNCOES_AGENTE.map((f) => ({ valor: f.codigo, rotulo: `${f.icone} ${f.rotulo}` }))} rotuloVazio="Todas as funções" />
          <EscolhaMultipla valores={status} aoMudar={reset(setStatus)} opcoes={STATUS_AGENTE.map((s) => ({ valor: s.codigo, rotulo: s.rotulo }))} rotuloVazio="Todas as situações" />
          <EscolhaMultipla valores={turnos} aoMudar={reset(setTurnos)} opcoes={TURNOS.map((t) => ({ valor: t.codigo, rotulo: t.rotulo }))} rotuloVazio="Todos os turnos" />
          <EscolhaMultipla valores={regioes} aoMudar={reset(setRegioes)} opcoes={OPCOES_REGIAO} rotuloVazio="Todas as regiões" />
          <Button
            variant="outline"
            disabled={!lista.length}
            onClick={() =>
              baixarCsv(`agentes-${hojeLocal()}.csv`, ['Nome', 'Matrícula', 'Função', 'Órgão', 'Turno', 'Situação', 'Base', 'Região', 'Telefone'],
                lista.map((a) => [a.nome, a.matricula, FUNCAO_POR_CODIGO[a.funcao]?.rotulo, a.orgao, a.turno, STATUS_AGENTE_POR_CODIGO[a.status].rotulo, a.bairroBase, REGIAO_POR_CODIGO[a.regiao]?.nome, a.telefone]))
            }
          >
            <Download /> CSV
          </Button>
          <Link href="/agentes/novo" className={buttonVariants()}>
            <Plus /> Novo
          </Link>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead>Base</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Posição</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((a) => {
                const v = a.equipamentoId ? equipamentos[a.equipamentoId] : null;
                const o = a.ocorrenciaId ? ocorrencias[a.ocorrenciaId] : null;
                return (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => router.push(`/agentes/${a.id}`)}>
                    <TableCell>
                      <span className="block font-medium">{a.nome}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{a.matricula}</span>
                    </TableCell>
                    <TableCell>{FUNCAO_POR_CODIGO[a.funcao]?.icone} {FUNCAO_POR_CODIGO[a.funcao]?.rotulo}</TableCell>
                    <TableCell className="text-muted-foreground">{TURNOS.find((t) => t.codigo === a.turno)?.rotulo}</TableCell>
                    <TableCell>
                      {a.bairroBase}
                      <span className="block text-xs text-muted-foreground">{REGIAO_POR_CODIGO[a.regiao]?.nome}</span>
                    </TableCell>
                    <TableCell>
                      <SeloAgente status={a.status} />
                      {o && <span className="mt-1 block text-xs text-muted-foreground">{OCORRENCIA_POR_CODIGO[o.tipo]?.rotulo} · {o.bairro}</span>}
                    </TableCell>
                    <TableCell className="text-xs">{v ? `${TIPOS_POR_CODIGO[v.tipo]?.icone} ${String(v.atributos.placa ?? v.numeroSerie)}` : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{tempoRelativo(a.ultimaAtualizacao)}</TableCell>
                    <TableCell onClick={(ev) => ev.stopPropagation()}>
                      <Button size="icon-sm" variant="ghost" title="Ver no mapa" disabled={a.status === 'fora_de_servico'}
                        onClick={() => { selecionar({ tipo: 'agente', id: a.id }); focar(a.regiao); router.push('/'); }}>
                        <MapPin />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!visiveis.length && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Nenhum agente encontrado.</TableCell>
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
