'use client';

import { Plus, SlidersHorizontal } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { STATUS_EQUIPAMENTO, STATUS_AGENTE, TIPOS_EQUIPAMENTO } from '@/lib/catalog';
import { useFiltros } from '@/stores/filtros';
import { useOperacao } from '@/stores/operacao';
import { DetalheSelecao } from './detalhe';
import { FiltrosCentral, filtrarEquipamentos } from './filtros-central';
import { Kpis } from './kpis';
import { MapaCliente } from './mapa-cliente';
import { NovaOcorrencia } from './nova-ocorrencia';
import { PainelLateral } from './painel-lateral';
import { SimularCenario } from './simular-cenario';

function Legenda() {
  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-[400] hidden max-w-xs rounded-lg border bg-card/90 p-2.5 text-[11px] backdrop-blur lg:block">
      <div className="mb-1 font-medium">Situação</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {STATUS_EQUIPAMENTO.map((s) => (
          <span key={s.codigo} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-2" style={{ borderColor: s.cor }} />
            {s.rotulo}
          </span>
        ))}
        {STATUS_AGENTE.slice(0, 2).map((s) => (
          <span key={s.codigo} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border-2" style={{ borderColor: s.cor }} />
            Agente: {s.rotulo.toLowerCase()}
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-muted-foreground">
        {TIPOS_EQUIPAMENTO.map((t) => <span key={t.codigo} title={t.nome}>{t.icone}</span>)}
        <span>· 🔴 ocorrência</span>
      </div>
    </div>
  );
}

export function Central() {
  const equipamentosMapa = useOperacao((s) => s.equipamentos);
  const agentesMapa = useOperacao((s) => s.agentes);
  const ocorrenciasMapa = useOperacao((s) => s.ocorrencias);
  const resumo = useOperacao((s) => s.resumo);
  const f = useFiltros();
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [novaAberta, setNovaAberta] = useState(false);

  const todos = useMemo(() => Object.values(equipamentosMapa), [equipamentosMapa]);
  const equipamentos = useMemo(
    () => filtrarEquipamentos(todos, f),
    [todos, f.tipos, f.status, f.regioes, f.bairros, f.orgaos, f.somenteManutencao], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Agentes fora de serviço não aparecem no mapa; os filtros de região e bairro valem para todas as camadas
  // (agente pelo bairro da base).
  const agentes = useMemo(
    () =>
      Object.values(agentesMapa).filter(
        (a) =>
          a.status !== 'fora_de_servico' && (!f.regioes.length || f.regioes.includes(a.regiao)) && (!f.bairros.length || f.bairros.includes(a.bairroBase)),
      ),
    [agentesMapa, f.regioes, f.bairros],
  );
  const ocorrencias = useMemo(
    () => Object.values(ocorrenciasMapa).filter((o) => (!f.regioes.length || f.regioes.includes(o.regiao)) && (!f.bairros.length || f.bairros.includes(o.bairro))),
    [ocorrenciasMapa, f.regioes, f.bairros],
  );
  const limparFoco = useCallback(() => f.focar(null), [f.focar]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-4">
      <Kpis resumo={resumo} />

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_380px]">
        <Card className="hidden p-4 xl:block">
          <FiltrosCentral total={todos.length} visiveis={equipamentos.length} />
        </Card>

        <Card className="relative isolate h-[60vh] overflow-hidden p-0 xl:h-[calc(100dvh-15rem)] xl:min-h-[560px]">
          <MapaCliente
            equipamentos={equipamentos}
            agentes={agentes}
            ocorrencias={ocorrencias}
            regioes={resumo?.regioes ?? []}
            camadas={f.camadas}
            selecao={f.selecao}
            aoSelecionar={f.selecionar}
            focoRegiao={f.focoRegiao}
            aoFocar={limparFoco}
            bairros={f.bairros}
            aoClicarRegiao={(r) => f.set({ regioes: f.regioes.length === 1 && f.regioes[0] === r ? [] : [r], bairros: [] })}
          />
          <div className="absolute top-3 right-3 z-[400] flex gap-2">
            <Button size="sm" variant="secondary" className="xl:hidden" onClick={() => setFiltrosAbertos(true)}>
              <SlidersHorizontal /> Filtros
            </Button>
            <SimularCenario />
            <Button size="sm" onClick={() => setNovaAberta(true)}>
              <Plus /> Registrar ocorrência
            </Button>
          </div>
          <Legenda />
        </Card>

        <Card className="flex h-[70vh] min-h-0 flex-col p-3 xl:h-[calc(100dvh-15rem)] xl:min-h-[560px]">
          <PainelLateral equipamentos={todos} />
        </Card>
      </div>

      <Sheet open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
        <SheetContent side="left" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filtros e camadas</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <FiltrosCentral total={todos.length} visiveis={equipamentos.length} />
          </div>
        </SheetContent>
      </Sheet>
      <NovaOcorrencia aberta={novaAberta} aoFechar={() => setNovaAberta(false)} />
      <DetalheSelecao />
    </div>
  );
}
