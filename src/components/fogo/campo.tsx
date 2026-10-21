import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Rótulo + controle + mensagem de erro, no padrão dos formulários do F.O.G.O. */
export function Campo({ rotulo, erro, dica, children, className, htmlFor, obrigatorio }: {
  rotulo: string; erro?: string; dica?: string; children: React.ReactNode; className?: string; htmlFor?: string; obrigatorio?: boolean;
}) {
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-xs">
        {rotulo}
        {obrigatorio && <span className="text-primary">*</span>}
      </Label>
      {children}
      {erro ? <p className="text-xs text-destructive">{erro}</p> : dica ? <p className="text-xs text-muted-foreground">{dica}</p> : null}
    </div>
  );
}
