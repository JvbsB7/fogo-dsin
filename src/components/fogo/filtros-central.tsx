'use client';

import { FilterX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ORGAOS, REGIOES, STATUS_EQUIPAMENTO, TIPOS_EQUIPAMENTO } from '@/lib/catalog';
import { hojeLocal } from '@/lib/formato';
import type { Equipamento } from '@/lib/types';
import { useFiltros, type Camadas } from '@/stores/filtros';
import { EscolhaMultipla } from './escolha';

export const OPCOES_TIPO = TIPOS_EQUIPAMENTO.map((t) => ({ valor: t.codigo, rotulo: `${t.icone} ${t.nome}` }));
export const OPCOES_STATUS = STATUS_EQUIPAMENTO.map((s) => ({
  valor: s.codigo,
  rotulo: (
    <span className="flex items-center gap-2">
      <span className="size-2 rounded-full" style={{ backgroundColor: s.cor }} />
      {s.rotulo}
    </span>
  ),
}));
export const OPCOES_REGIAO = REGIOES.map((r) => ({ valor: r.codigo, rotulo: r.nome }));
export const OPCOES_ORGAO = ORGAOS.map((o) => ({ valor: o.codigo, rotulo: `${o.codigo} — ${o.nome}` }));

export function precisaManutencao(e: Equipamento, limite = hojeLocal(7)) {
  if (e.status === 'nao_instalado' || e.status === 'desativado') return false;
  return e.manutencaoTipo === 'imediata' || (!!e.manutencaoProxima && e.manutencaoProxima <= limite);
}

/** Aplica os filtros da Central a uma lista de equipamentos. */
export function filtrarEquipamentos(lista: Equipamento[], f: { tipos: string[]; status: string[]; regioes: string[]; orgaos: string[]; somenteManutencao: boolean }) {
  const limite = hojeLocal(7);
  return lista.filter(
    (e) =>
      (!f.tipos.length || f.tipos.includes(e.tipo)) &&
      (!f.status.length || f.status.includes(e.status)) &&
      (!f.regioes.length || f.regioes.includes(e.regiao)) &&
      (!f.orgaos.length || f.orgaos.includes(e.orgao)) &&
      (!f.somenteManutencao || precisaManutencao(e, limite)),
  );
}

const CAMADAS: { chave: keyof Camadas; rotulo: string }[] = [
  { chave: 'equipamentos', rotulo: 'Equipamentos' },
  { chave: 'agentes', rotulo: 'Agentes' },
  { chave: 'ocorrencias', rotulo: 'Ocorrências' },
  { chave: 'regioes', rotulo: 'Situação das regiões' },
];

export function FiltrosCentral({ total, visiveis }: { total: number; visiveis: number }) {
  const f = useFiltros();
  const ativos = f.tipos.length + f.status.length + f.regioes.length + f.orgaos.length + (f.somenteManutencao ? 1 : 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">Tipo de equipamento</Label>
        <EscolhaMultipla valores={f.tipos} aoMudar={(tipos) => f.set({ tipos })} opcoes={OPCOES_TIPO} rotuloVazio="Todos os tipos" />
      </div>
      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">Situação</Label>
        <EscolhaMultipla valores={f.status} aoMudar={(status) => f.set({ status })} opcoes={OPCOES_STATUS} rotuloVazio="Todas as situações" />
      </div>
      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">Região</Label>
        <EscolhaMultipla valores={f.regioes} aoMudar={(regioes) => f.set({ regioes })} opcoes={OPCOES_REGIAO} rotuloVazio="Toda a cidade" />
      </div>
      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">Órgão responsável</Label>
        <EscolhaMultipla valores={f.orgaos} aoMudar={(orgaos) => f.set({ orgaos })} opcoes={OPCOES_ORGAO} rotuloVazio="Todos os órgãos" />
      </div>
      <label className="flex items-center justify-between gap-2 text-sm">
        Precisa de manutenção (7 dias)
        <Switch checked={f.somenteManutencao} onCheckedChange={(v) => f.set({ somenteManutencao: v })} />
      </label>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {visiveis} de {total} equipamentos
        </span>
        {ativos > 0 && (
          <Button variant="ghost" size="xs" onClick={f.limpar}>
            <FilterX /> Limpar ({ativos})
          </Button>
        )}
      </div>
      <div className="grid gap-2 border-t pt-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Camadas do mapa</span>
        {CAMADAS.map((c) => (
          <label key={c.chave} className="flex items-center justify-between text-sm">
            {c.rotulo}
            <Switch checked={f.camadas[c.chave]} onCheckedChange={() => f.alternarCamada(c.chave)} />
          </label>
        ))}
      </div>
    </div>
  );
}
