'use client';

// Atalhos sobre o Select do shadcn (Base UI) para seleção simples e múltipla.
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface Opcao {
  valor: string;
  rotulo: React.ReactNode;
}

export function Escolha({
  valor, aoMudar, opcoes, placeholder = 'Selecione', className, id, invalido, desabilitado,
}: {
  valor: string | null;
  aoMudar: (v: string) => void;
  opcoes: Opcao[];
  placeholder?: string;
  className?: string;
  id?: string;
  invalido?: boolean;
  desabilitado?: boolean;
}) {
  const items = opcoes.map((o) => ({ value: o.valor, label: o.rotulo }));
  return (
    <Select items={items} value={valor ?? null} onValueChange={(v) => v !== null && aoMudar(String(v))} disabled={desabilitado}>
      <SelectTrigger id={id} className={cn('w-full', className)} aria-invalid={invalido || undefined}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((o) => (
          <SelectItem key={o.valor} value={o.valor}>
            {o.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function EscolhaMultipla({
  valores, aoMudar, opcoes, rotuloVazio, className,
}: {
  valores: string[];
  aoMudar: (v: string[]) => void;
  opcoes: Opcao[];
  rotuloVazio: string;
  className?: string;
}) {
  const items = opcoes.map((o) => ({ value: o.valor, label: o.rotulo }));
  return (
    <Select items={items} multiple value={valores} onValueChange={(v) => aoMudar((v as string[]) ?? [])}>
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue>
          {(v: string[]) =>
            !v?.length ? (
              <span className="text-muted-foreground">{rotuloVazio}</span>
            ) : v.length === 1 ? (
              opcoes.find((o) => o.valor === v[0])?.rotulo
            ) : (
              `${v.length} selecionados`
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {opcoes.map((o) => (
          <SelectItem key={o.valor} value={o.valor}>
            {o.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
