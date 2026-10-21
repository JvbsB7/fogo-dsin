'use client';

import { CheckCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { REGIAO_POR_CODIGO } from '@/lib/catalog';
import { dataHora } from '@/lib/formato';
import type { Alerta, NivelAlerta } from '@/lib/types';
import { useOperacao } from '@/stores/operacao';
import { EscolhaMultipla } from './escolha';
import { OPCOES_REGIAO } from './filtros-central';
import { ItemAlerta, reconhecer } from './painel-lateral';
import { SeloNivel } from './selos';
import { useApi } from './use-api';

const NIVEIS: { valor: NivelAlerta; rotulo: string }[] = [
  { valor: 'critico', rotulo: 'Crítico' }, { valor: 'alto', rotulo: 'Alto' }, { valor: 'medio', rotulo: 'Médio' }, { valor: 'info', rotulo: 'Info' },
];
const ORDEM = { critico: 0, alto: 1, medio: 2, info: 3 };

export function PaginaAlertas() {
  const alertasMapa = useOperacao((s) => s.alertas);
  const [niveis, setNiveis] = useState<string[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [regioes, setRegioes] = useState<string[]>([]);
  const historico = useApi<Alerta[]>('/api/alertas', 30000);

  const abertos = useMemo(() => Object.values(alertasMapa), [alertasMapa]);
  const opcoesCategoria = useMemo(() => [...new Set(abertos.map((a) => a.categoria))].sort().map((c) => ({ valor: c, rotulo: c })), [abertos]);
  const filtrados = useMemo(
    () =>
      abertos
        .filter((a) => (!niveis.length || niveis.includes(a.nivel)) && (!categorias.length || categorias.includes(a.categoria)) && (!regioes.length || (a.regiao && regioes.includes(a.regiao))))
        .sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel] || b.criadoEm.localeCompare(a.criadoEm)),
    [abertos, niveis, categorias, regioes],
  );
  const contagem = useMemo(() => Object.fromEntries(NIVEIS.map((n) => [n.valor, abertos.filter((a) => a.nivel === n.valor).length])), [abertos]);

  const reconhecerFiltrados = async () => {
    if (!confirm(`Reconhecer ${filtrados.length} alerta(s)?`)) return;
    await Promise.all(filtrados.map((a) => reconhecer(a.id)));
    toast.success('Alertas reconhecidos');
  };

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {NIVEIS.map((n) => (
          <Card key={n.valor} className="gap-1 px-4 py-3">
            <SeloNivel nivel={n.valor} />
            <span className="text-2xl font-semibold tabular-nums">{contagem[n.valor]}</span>
          </Card>
        ))}
      </div>
      <Tabs defaultValue="abertos">
        <TabsList>
          <TabsTrigger value="abertos">Abertos ({abertos.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="abertos" className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
            <EscolhaMultipla valores={niveis} aoMudar={setNiveis} opcoes={NIVEIS} rotuloVazio="Todos os níveis" />
            <EscolhaMultipla valores={categorias} aoMudar={setCategorias} opcoes={opcoesCategoria} rotuloVazio="Todas as categorias" />
            <EscolhaMultipla valores={regioes} aoMudar={setRegioes} opcoes={OPCOES_REGIAO} rotuloVazio="Todas as regiões" />
            <Button variant="outline" disabled={!filtrados.length} onClick={reconhecerFiltrados}>
              <CheckCheck /> Reconhecer {filtrados.length}
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {filtrados.map((a) => <ItemAlerta key={a.id} a={a} />)}
          </div>
          {!filtrados.length && <p className="py-12 text-center text-sm text-muted-foreground">Nenhum alerta aberto com esses filtros.</p>}
        </TabsContent>
        <TabsContent value="historico">
          <Card className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nível</TableHead>
                  <TableHead>Alerta</TableHead>
                  <TableHead>Região</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Encerrado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.dado?.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell><SeloNivel nivel={a.nivel} /></TableCell>
                    <TableCell className="max-w-md whitespace-normal">
                      <span className="block text-sm">{a.titulo}</span>
                      <span className="block text-xs text-muted-foreground">{a.categoria}</span>
                    </TableCell>
                    <TableCell className="text-sm">{a.regiao ? REGIAO_POR_CODIGO[a.regiao]?.nome : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{dataHora(a.criadoEm)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.reconhecidoEm ? dataHora(a.reconhecidoEm) : <span className="text-amber-400">aberto</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
