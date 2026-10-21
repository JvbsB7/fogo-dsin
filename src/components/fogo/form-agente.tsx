'use client';

import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BAIRROS, FUNCOES_AGENTE, FUNCAO_POR_CODIGO, ORGAOS, REGIAO_POR_CODIGO, STATUS_AGENTE, TIPOS_POR_CODIGO, TURNOS } from '@/lib/catalog';
import type { Agente } from '@/lib/types';
import { validarAgente } from '@/lib/validacao';
import { useOperacao } from '@/stores/operacao';
import { Campo } from './campo';
import { Escolha } from './escolha';
import { SeletorLocalCliente } from './mapa-cliente';

const VEICULO_POR_FUNCAO: Record<string, string> = { agente_transito: 'moto_agente', guarda_municipal: 'viatura_gcm', policial_militar: 'viatura_pm' };

export function FormAgente({ inicial }: { inicial?: Agente }) {
  const router = useRouter();
  const upsert = useOperacao((s) => s.upsertAgente);
  const remover = useOperacao((s) => s.removerAgente);
  const equipamentos = useOperacao((s) => s.equipamentos);
  const [f, setF] = useState<Record<string, unknown>>(() =>
    inicial
      ? { ...inicial, lat: String(inicial.lat), lng: String(inicial.lng), equipamentoId: inicial.equipamentoId ? String(inicial.equipamentoId) : '' }
      : { nome: '', matricula: '', funcao: '', orgao: '', status: 'em_patrulha', turno: 'manha', telefone: '', bairroBase: '', lat: '', lng: '', equipamentoId: '' },
  );
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  const veiculos = useMemo(() => {
    const tipo = VEICULO_POR_FUNCAO[f.funcao as string];
    return Object.values(equipamentos)
      .filter((e) => e.tipo === tipo && e.status !== 'desativado')
      .map((e) => ({ valor: String(e.id), rotulo: `${TIPOS_POR_CODIGO[e.tipo]?.icone} ${String(e.atributos.placa ?? e.numeroSerie)} ${e.atributos.prefixo ? `(${e.atributos.prefixo})` : ''}` }));
  }, [equipamentos, f.funcao]);

  const set = (campo: string, valor: unknown) => {
    setF((x) => ({ ...x, [campo]: valor }));
    setErros(({ [campo]: _, ...resto }) => resto);
  };

  const salvar = async () => {
    const v = validarAgente(f);
    if (!v.ok) {
      setErros(v.campos);
      toast.error('Verifique os campos destacados.');
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch(inicial ? `/api/agentes/${inicial.id}` : '/api/agentes', {
        method: inicial ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v.dado),
      });
      const corpo = await r.json();
      if (!r.ok) {
        setErros(corpo.campos ?? {});
        toast.error(corpo.erro ?? 'Não foi possível salvar.');
        return;
      }
      upsert(corpo);
      toast.success(inicial ? 'Agente atualizado' : 'Agente cadastrado');
      router.push('/agentes');
    } finally {
      setEnviando(false);
    }
  };

  const excluir = async () => {
    if (!inicial || !confirm(`Remover ${inicial.nome} do cadastro?`)) return;
    const r = await fetch(`/api/agentes/${inicial.id}`, { method: 'DELETE' });
    if (r.ok) {
      remover(inicial.id);
      toast.success('Agente removido');
      router.push('/agentes');
    } else toast.error('Não foi possível remover.');
  };

  const lat = f.lat === '' ? null : Number(f.lat);
  const lng = f.lng === '' ? null : Number(f.lng);

  return (
    <div className="mx-auto grid max-w-4xl gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/agentes" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft /> Agentes
        </Link>
        <h2 className="flex-1 text-lg font-semibold">{inicial ? `Editar ${inicial.nome}` : 'Novo agente'}</h2>
        {inicial && (
          <Button variant="destructive" size="sm" onClick={excluir}>
            <Trash2 /> Remover
          </Button>
        )}
        <Button onClick={salvar} disabled={enviando}>
          <Save /> Salvar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do profissional</CardTitle>
          <CardDescription>Agentes de trânsito, guardas municipais e policiais que atuam nas operações de mobilidade e segurança.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome completo" erro={erros.nome} obrigatorio htmlFor="nome">
            <Input id="nome" value={f.nome as string} onChange={(e) => set('nome', e.target.value)} aria-invalid={!!erros.nome || undefined} />
          </Campo>
          <Campo rotulo="Matrícula" erro={erros.matricula} obrigatorio htmlFor="mat">
            <Input id="mat" className="font-mono uppercase" value={f.matricula as string} onChange={(e) => set('matricula', e.target.value)} aria-invalid={!!erros.matricula || undefined} />
          </Campo>
          <Campo rotulo="Função" erro={erros.funcao} obrigatorio>
            <Escolha valor={(f.funcao as string) || null} invalido={!!erros.funcao} placeholder="Escolha a função"
              aoMudar={(v) => setF((x) => ({ ...x, funcao: v, orgao: FUNCAO_POR_CODIGO[v]?.orgao ?? x.orgao, equipamentoId: '' }))}
              opcoes={FUNCOES_AGENTE.map((fn) => ({ valor: fn.codigo, rotulo: `${fn.icone} ${fn.rotulo}` }))} />
          </Campo>
          <Campo rotulo="Órgão" erro={erros.orgao}>
            <Escolha valor={(f.orgao as string) || null} aoMudar={(v) => set('orgao', v)} opcoes={ORGAOS.map((o) => ({ valor: o.codigo, rotulo: o.nome }))} />
          </Campo>
          <Campo rotulo="Turno" erro={erros.turno} obrigatorio>
            <Escolha valor={f.turno as string} aoMudar={(v) => set('turno', v)} opcoes={TURNOS.map((t) => ({ valor: t.codigo, rotulo: t.rotulo }))} />
          </Campo>
          <Campo rotulo="Situação" erro={erros.status} obrigatorio>
            <Escolha valor={f.status as string} aoMudar={(v) => set('status', v)} opcoes={STATUS_AGENTE.map((s) => ({ valor: s.codigo, rotulo: s.rotulo }))} />
          </Campo>
          <Campo rotulo="Telefone" erro={erros.telefone} htmlFor="tel">
            <Input id="tel" inputMode="tel" placeholder="(14) 99999-0000" value={f.telefone as string} onChange={(e) => set('telefone', e.target.value)} aria-invalid={!!erros.telefone || undefined} />
          </Campo>
          <Campo rotulo="Veículo vinculado" erro={erros.equipamentoId} dica={f.funcao ? undefined : 'Escolha a função para listar os veículos'}>
            <Escolha valor={(f.equipamentoId as string) || null} aoMudar={(v) => set('equipamentoId', v === 'nenhum' ? '' : v)} desabilitado={!f.funcao}
              opcoes={[{ valor: 'nenhum', rotulo: 'Nenhum' }, ...veiculos]} placeholder="Nenhum" />
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Base e posição</CardTitle>
          <CardDescription>Em operação, a posição é atualizada em tempo real pelo GPS do agente (simulado).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid content-start gap-3">
            <Campo rotulo="Bairro da base" erro={erros.bairroBase} obrigatorio>
              <Escolha valor={(f.bairroBase as string) || null} invalido={!!erros.bairroBase}
                aoMudar={(v) => {
                  const b = BAIRROS.find((x) => x.nome === v);
                  setF((x) => ({ ...x, bairroBase: v, ...(b && (x.lat === '' || !inicial) ? { lat: b.lat.toFixed(6), lng: b.lng.toFixed(6) } : {}) }));
                }}
                opcoes={BAIRROS.map((b) => ({ valor: b.nome, rotulo: `${b.nome} · ${REGIAO_POR_CODIGO[b.regiao]?.nome}` }))} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Latitude" htmlFor="alat">
                <Input id="alat" className="font-mono" value={f.lat as string} onChange={(e) => set('lat', e.target.value)} />
              </Campo>
              <Campo rotulo="Longitude" htmlFor="alng">
                <Input id="alng" className="font-mono" value={f.lng as string} onChange={(e) => set('lng', e.target.value)} />
              </Campo>
            </div>
          </div>
          <SeletorLocalCliente lat={lat} lng={lng} aoMudar={(la, ln) => setF((x) => ({ ...x, lat: la.toFixed(6), lng: ln.toFixed(6) }))} />
        </CardContent>
      </Card>
    </div>
  );
}
