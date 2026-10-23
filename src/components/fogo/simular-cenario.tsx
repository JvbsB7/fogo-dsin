'use client';

import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { buttonVariants } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useFiltros } from '@/stores/filtros';

const CENARIOS = [
  { codigo: 'semaforo', rotulo: '🚦 Semáforo apaga e causa acidente' },
  { codigo: 'furto', rotulo: '📹 Furto de câmera' },
  { codigo: 'pico', rotulo: '📈 Pico de ocorrências num bairro' },
];

// Demonstração: provoca uma situação crítica real (pelo mesmo caminho da telemetria) para
// mostrar a Central percebendo, alertando e despachando equipes.
export function SimularCenario() {
  const [enviando, setEnviando] = useState(false);
  const selecionar = useFiltros((s) => s.selecionar);

  const disparar = async (cenario: string) => {
    setEnviando(true);
    const r = await fetch('/api/cenarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cenario }) }).catch(() => null);
    setEnviando(false);
    if (!r?.ok) {
      toast.error('Não foi possível disparar o cenário.');
      return;
    }
    const d: { titulo: string; equipamentoId?: number; ocorrenciaIds: number[] } = await r.json();
    toast.warning(`Cenário disparado: ${d.titulo}`, { description: 'Acompanhe os alertas e o mapa reagindo em tempo real.' });
    if (d.equipamentoId) selecionar({ tipo: 'equipamento', id: d.equipamentoId });
    else if (d.ocorrenciaIds[0]) selecionar({ tipo: 'ocorrencia', id: d.ocorrenciaIds[0] });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ size: 'sm', variant: 'secondary' })} disabled={enviando}>
        <FlaskConical /> Simular
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Cenários de demonstração</DropdownMenuLabel>
          {CENARIOS.map((c) => (
            <DropdownMenuItem key={c.codigo} onClick={() => disparar(c.codigo)}>
              {c.rotulo}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
