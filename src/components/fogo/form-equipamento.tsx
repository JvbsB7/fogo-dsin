'use client';

import { ArrowLeft, Crosshair, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  BAIRROS, MANUTENCAO_TIPOS, ORGAOS, REGIAO_POR_CODIGO, STATUS_EQUIPAMENTO, TIPOS_EQUIPAMENTO, TIPOS_POR_CODIGO, type AtributoDef,
} from '@/lib/catalog';
import { hojeLocal } from '@/lib/formato';
import type { Equipamento } from '@/lib/types';
import { validarEquipamento } from '@/lib/validacao';
import { useOperacao } from '@/stores/operacao';
import { Campo } from './campo';
import { Escolha } from './escolha';
import { SeletorLocalCliente } from './mapa-cliente';

type Form = Record<string, unknown> & { atributos: Record<string, unknown> };

function vazio(): Form {
  return {
    tipo: '', numeroSerie: '', marca: '', modelo: '', orgao: '', status: 'operacional', cep: '', bairro: '', cidade: 'Marília', uf: 'SP',
    logradouro: '', referencia: '', lat: '', lng: '', manutencaoTipo: 'periodica', manutencaoProxima: '', ultimaManutencao: '',
    instaladoEm: hojeLocal(), atributos: {}, observacoes: '',
  };
}

function deEquipamento(e: Equipamento): Form {
  return {
    ...e, lat: String(e.lat), lng: String(e.lng), manutencaoProxima: e.manutencaoProxima ?? '', ultimaManutencao: e.ultimaManutencao ?? '',
    instaladoEm: e.instaladoEm ?? '', atributos: { ...e.atributos },
  };
}

function CampoAtributo({ def, valor, erro, aoMudar }: { def: AtributoDef; valor: unknown; erro?: string; aoMudar: (v: unknown) => void }) {
  const id = `attr-${def.campo}`;
  if (def.tipo === 'bool') {
    return (
      <label htmlFor={id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
        {def.rotulo}
        <Switch id={id} checked={valor === true} onCheckedChange={aoMudar} />
      </label>
    );
  }
  if (def.tipo === 'select') {
    return (
      <Campo rotulo={def.rotulo} erro={erro} obrigatorio={def.obrigatorio}>
        <Escolha valor={(valor as string) || null} aoMudar={aoMudar} opcoes={def.opcoes!.map((o) => ({ valor: o, rotulo: o }))} invalido={!!erro} />
      </Campo>
    );
  }
  if (def.tipo === 'multiselect') {
    const lista = Array.isArray(valor) ? (valor as string[]) : [];
    return (
      <Campo rotulo={def.rotulo} erro={erro}>
        <div className="flex flex-wrap gap-3 rounded-lg border px-3 py-2">
          {def.opcoes!.map((o) => (
            <label key={o} className="flex items-center gap-1.5 text-sm">
              <Checkbox checked={lista.includes(o)} onCheckedChange={(c) => aoMudar(c ? [...lista, o] : lista.filter((x) => x !== o))} />
              {o}
            </label>
          ))}
        </div>
      </Campo>
    );
  }
  return (
    <Campo rotulo={def.rotulo} erro={erro} obrigatorio={def.obrigatorio} htmlFor={id}>
      <Input
        id={id}
        type={def.tipo === 'number' ? 'number' : 'text'}
        min={def.min}
        max={def.max}
        value={(valor as string | number | undefined) ?? ''}
        onChange={(e) => aoMudar(e.target.value)}
        aria-invalid={!!erro || undefined}
      />
    </Campo>
  );
}

export function FormEquipamento({ inicial }: { inicial?: Equipamento }) {
  const router = useRouter();
  const upsert = useOperacao((s) => s.upsertEquipamento);
  const remover = useOperacao((s) => s.removerEquipamento);
  const [f, setF] = useState<Form>(() => (inicial ? deEquipamento(inicial) : vazio()));
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const def = TIPOS_POR_CODIGO[f.tipo as string];
  const marcas = useMemo(() => (def ? Object.keys(def.marcas) : []), [def]);
  const modelos = useMemo(() => (def && f.marca ? (def.marcas[f.marca as string] ?? []) : []), [def, f.marca]);

  const set = (campo: string, valor: unknown) => {
    setF((x) => ({ ...x, [campo]: valor }));
    setErros(({ [campo]: _, ...resto }) => resto);
  };
  const setAttr = (campo: string, valor: unknown) => {
    setF((x) => ({ ...x, atributos: { ...x.atributos, [campo]: valor } }));
    setErros(({ [`atributos.${campo}`]: _, ...resto }) => resto);
  };
  const mudarTipo = (tipo: string) => {
    const novo = TIPOS_POR_CODIGO[tipo];
    setF((x) => {
      const proxima = x.manutencaoProxima || hojeLocal(novo?.intervaloManutencaoDias ?? 180);
      return { ...x, tipo, orgao: novo?.orgao ?? x.orgao, atributos: {}, manutencaoProxima: proxima };
    });
    setErros({});
  };
  const usarCentroBairro = () => {
    const b = BAIRROS.find((x) => x.nome === f.bairro);
    if (!b) return toast.info('Escolha o bairro primeiro.');
    setF((x) => ({ ...x, lat: b.lat.toFixed(6), lng: b.lng.toFixed(6), cep: x.cep || `${b.cep}-000` }));
  };

  const salvar = async () => {
    const v = validarEquipamento(f);
    if (!v.ok) {
      setErros(v.campos);
      toast.error('Verifique os campos destacados.');
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch(inicial ? `/api/equipamentos/${inicial.id}` : '/api/equipamentos', {
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
      toast.success(inicial ? 'Equipamento atualizado' : 'Equipamento cadastrado');
      router.push('/equipamentos');
    } finally {
      setEnviando(false);
    }
  };

  const excluir = async () => {
    if (!inicial || !confirm(`Excluir ${inicial.numeroSerie}? O histórico dele também some.`)) return;
    const r = await fetch(`/api/equipamentos/${inicial.id}`, { method: 'DELETE' });
    if (r.ok) {
      remover(inicial.id);
      toast.success('Equipamento excluído');
      router.push('/equipamentos');
    } else toast.error('Não foi possível excluir.');
  };

  const lat = f.lat === '' ? null : Number(f.lat);
  const lng = f.lng === '' ? null : Number(f.lng);

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/equipamentos" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft /> Inventário
        </Link>
        <h2 className="flex-1 text-lg font-semibold">{inicial ? `Editar ${inicial.numeroSerie}` : 'Novo equipamento'}</h2>
        {inicial && (
          <Button variant="destructive" size="sm" onClick={excluir}>
            <Trash2 /> Excluir
          </Button>
        )}
        <Button onClick={salvar} disabled={enviando}>
          <Save /> Salvar
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identificação</CardTitle>
            <CardDescription>O tipo define as características específicas pedidas mais abaixo.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Tipo de equipamento" erro={erros.tipo} obrigatorio className="sm:col-span-2">
              <Escolha valor={(f.tipo as string) || null} aoMudar={mudarTipo} invalido={!!erros.tipo} placeholder="Escolha o tipo"
                opcoes={TIPOS_EQUIPAMENTO.map((t) => ({ valor: t.codigo, rotulo: `${t.icone} ${t.nome}` }))} />
            </Campo>
            <Campo rotulo="Número de série" erro={erros.numeroSerie} obrigatorio htmlFor="ns">
              <Input id="ns" value={f.numeroSerie as string} onChange={(e) => set('numeroSerie', e.target.value)} aria-invalid={!!erros.numeroSerie || undefined} className="font-mono uppercase" />
            </Campo>
            <Campo rotulo="Órgão responsável" erro={erros.orgao}>
              <Escolha valor={(f.orgao as string) || null} aoMudar={(v) => set('orgao', v)} opcoes={ORGAOS.map((o) => ({ valor: o.codigo, rotulo: o.nome }))} />
            </Campo>
            <Campo rotulo="Marca" erro={erros.marca} obrigatorio htmlFor="marca">
              <Input id="marca" list="marcas" value={f.marca as string} onChange={(e) => set('marca', e.target.value)} aria-invalid={!!erros.marca || undefined} />
              <datalist id="marcas">{marcas.map((m) => <option key={m} value={m} />)}</datalist>
            </Campo>
            <Campo rotulo="Modelo" erro={erros.modelo} obrigatorio htmlFor="modelo">
              <Input id="modelo" list="modelos" value={f.modelo as string} onChange={(e) => set('modelo', e.target.value)} aria-invalid={!!erros.modelo || undefined} />
              <datalist id="modelos">{modelos.map((m) => <option key={m} value={m} />)}</datalist>
            </Campo>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Situação e manutenção</CardTitle>
            <CardDescription>Manutenção imediata é marcada automaticamente quando o equipamento falha.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Situação atual" erro={erros.status} obrigatorio>
              <Escolha valor={f.status as string} aoMudar={(v) => set('status', v)} opcoes={STATUS_EQUIPAMENTO.map((s) => ({ valor: s.codigo, rotulo: s.rotulo }))} />
            </Campo>
            <Campo rotulo="Instalado em" erro={erros.instaladoEm} htmlFor="inst" dica={f.status === 'nao_instalado' ? 'Opcional enquanto não instalado' : undefined}>
              <Input id="inst" type="date" value={f.instaladoEm as string} onChange={(e) => set('instaladoEm', e.target.value)} aria-invalid={!!erros.instaladoEm || undefined} />
            </Campo>
            <Campo rotulo="Necessidade de manutenção" erro={erros.manutencaoTipo}>
              <Escolha valor={f.manutencaoTipo as string} aoMudar={(v) => set('manutencaoTipo', v)} opcoes={MANUTENCAO_TIPOS.map((m) => ({ valor: m.codigo, rotulo: m.rotulo }))} />
            </Campo>
            <Campo rotulo="Próxima manutenção" erro={erros.manutencaoProxima} htmlFor="prox" dica={def ? `Intervalo sugerido: ${def.intervaloManutencaoDias} dias` : undefined}>
              <Input id="prox" type="date" value={f.manutencaoProxima as string} onChange={(e) => set('manutencaoProxima', e.target.value)} aria-invalid={!!erros.manutencaoProxima || undefined} />
            </Campo>
            <Campo rotulo="Última manutenção" erro={erros.ultimaManutencao} htmlFor="ult">
              <Input id="ult" type="date" value={f.ultimaManutencao as string} onChange={(e) => set('ultimaManutencao', e.target.value)} />
            </Campo>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Localização da instalação ou da base</CardTitle>
            <CardDescription>Clique no mapa ou arraste o marcador para definir as coordenadas GPS.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="grid content-start gap-3 sm:grid-cols-2">
              <Campo rotulo="Bairro" erro={erros.bairro} obrigatorio>
                <Escolha valor={(f.bairro as string) || null} aoMudar={(v) => set('bairro', v)} invalido={!!erros.bairro}
                  opcoes={BAIRROS.map((b) => ({ valor: b.nome, rotulo: `${b.nome} · ${REGIAO_POR_CODIGO[b.regiao]?.nome}` }))} />
              </Campo>
              <Campo rotulo="CEP" erro={erros.cep} obrigatorio htmlFor="cep">
                <Input id="cep" inputMode="numeric" placeholder="17500-000" value={f.cep as string} onChange={(e) => set('cep', e.target.value)} aria-invalid={!!erros.cep || undefined} />
              </Campo>
              <Campo rotulo="Rua / avenida / rodovia" erro={erros.logradouro} obrigatorio htmlFor="logr" className="sm:col-span-2">
                <Input id="logr" value={f.logradouro as string} onChange={(e) => set('logradouro', e.target.value)} aria-invalid={!!erros.logradouro || undefined} />
              </Campo>
              <Campo rotulo="Referência" erro={erros.referencia} obrigatorio htmlFor="ref" className="sm:col-span-2" dica='Ex.: "nº 181", "oposto ao nº 181", "KM 203", "S/N", "em frente ao Mercado do Tio"'>
                <Input id="ref" value={f.referencia as string} onChange={(e) => set('referencia', e.target.value)} aria-invalid={!!erros.referencia || undefined} />
              </Campo>
              <Campo rotulo="Cidade" htmlFor="cid">
                <Input id="cid" value={f.cidade as string} onChange={(e) => set('cidade', e.target.value)} />
              </Campo>
              <Campo rotulo="UF" htmlFor="uf">
                <Input id="uf" maxLength={2} value={f.uf as string} onChange={(e) => set('uf', e.target.value.toUpperCase())} />
              </Campo>
              <Campo rotulo="Latitude" erro={erros.lat} obrigatorio htmlFor="lat">
                <Input id="lat" inputMode="decimal" value={f.lat as string} onChange={(e) => set('lat', e.target.value)} aria-invalid={!!erros.lat || undefined} className="font-mono" />
              </Campo>
              <Campo rotulo="Longitude" erro={erros.lng} obrigatorio htmlFor="lng">
                <Input id="lng" inputMode="decimal" value={f.lng as string} onChange={(e) => set('lng', e.target.value)} aria-invalid={!!erros.lng || undefined} className="font-mono" />
              </Campo>
              <Button variant="outline" size="sm" className="sm:col-span-2" onClick={usarCentroBairro}>
                <Crosshair /> Usar o centro do bairro
              </Button>
            </div>
            <SeletorLocalCliente lat={lat} lng={lng} aoMudar={(la, ln) => setF((x) => ({ ...x, lat: la.toFixed(6), lng: ln.toFixed(6) }))} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Características {def ? `— ${def.nome}` : ''}</CardTitle>
            <CardDescription>{def ? 'Propriedades próprias deste tipo de equipamento.' : 'Escolha o tipo de equipamento para ver as características.'}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {def?.atributos.map((a) => (
              <CampoAtributo key={`${def.codigo}-${a.campo}`} def={a} valor={f.atributos[a.campo]} erro={erros[`atributos.${a.campo}`]} aoMudar={(v) => setAttr(a.campo, v)} />
            ))}
            <Campo rotulo="Observações" htmlFor="obs" className="sm:col-span-2 lg:col-span-3">
              <Textarea id="obs" value={f.observacoes as string} onChange={(e) => set('observacoes', e.target.value)} />
            </Campo>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
