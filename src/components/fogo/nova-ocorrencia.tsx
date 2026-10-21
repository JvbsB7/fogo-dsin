'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BAIRROS, REGIAO_POR_CODIGO, TIPOS_OCORRENCIA } from '@/lib/catalog';
import { useFiltros } from '@/stores/filtros';
import { Escolha } from './escolha';

// Registro manual de ocorrência pela Central: o sistema despacha o agente mais próximo.
export function NovaOcorrencia({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const [tipo, setTipo] = useState('acidente');
  const [bairro, setBairro] = useState<string | null>(null);
  const [gravidade, setGravidade] = useState('2');
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const selecionar = useFiltros((s) => s.selecionar);

  const enviar = async () => {
    if (!bairro) {
      toast.error('Selecione o bairro.');
      return;
    }
    setEnviando(true);
    const r = await fetch('/api/ocorrencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, bairro, gravidade: Number(gravidade), descricao }),
    });
    setEnviando(false);
    if (!r.ok) {
      toast.error('Não foi possível registrar a ocorrência.');
      return;
    }
    const o = await r.json();
    toast.success(o.agenteId ? 'Ocorrência registrada e equipe despachada' : 'Ocorrência registrada — nenhuma equipe livre no momento');
    setDescricao('');
    aoFechar();
    selecionar({ tipo: 'ocorrencia', id: o.id });
  };

  return (
    <Dialog open={aberta} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar ocorrência</DialogTitle>
          <DialogDescription>O agente em patrulha mais próximo será despachado automaticamente.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Escolha valor={tipo} aoMudar={setTipo} opcoes={TIPOS_OCORRENCIA.map((t) => ({ valor: t.codigo, rotulo: `${t.icone} ${t.rotulo}` }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Bairro</Label>
              <Escolha valor={bairro} aoMudar={setBairro} placeholder="Selecione" opcoes={BAIRROS.map((b) => ({ valor: b.nome, rotulo: `${b.nome} (${REGIAO_POR_CODIGO[b.regiao]?.nome})` }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Gravidade</Label>
              <Escolha valor={gravidade} aoMudar={setGravidade} opcoes={[{ valor: '1', rotulo: '1 — baixa' }, { valor: '2', rotulo: '2 — média' }, { valor: '3', rotulo: '3 — alta' }]} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que está acontecendo?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button onClick={enviar} disabled={enviando}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
