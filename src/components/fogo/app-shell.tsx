'use client';

import { Bell, BrainCircuit, Cctv, Flame, LayoutDashboard, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useOperacao } from '@/stores/operacao';
import { SoNoCliente } from './so-no-cliente';

const NAV = [
  { href: '/', rotulo: 'Central', icone: LayoutDashboard, desc: 'Central de Operações' },
  { href: '/equipamentos', rotulo: 'Equipamentos', icone: Cctv, desc: 'Inventário inteligente' },
  { href: '/agentes', rotulo: 'Agentes', icone: Users, desc: 'Equipes em campo' },
  { href: '/previsoes', rotulo: 'Previsões', icone: BrainCircuit, desc: 'Cidade preditiva' },
  { href: '/alertas', rotulo: 'Alertas', icone: Bell, desc: 'Fila de alertas' },
];

function CarregandoPagina() {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-[60vh]" />
    </div>
  );
}

function Relogio() {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setAgora(new Date());
    const t = setInterval(tick, 1000);
    tick();
    return () => clearInterval(t);
  }, []);
  if (!agora) return <span className="w-16" />;
  return (
    <span className="hidden font-mono text-sm tabular-nums text-muted-foreground sm:inline">
      {agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
    </span>
  );
}

function IndicadorAoVivo() {
  const conectado = useOperacao((s) => s.conectado);
  const simulador = useOperacao((s) => s.simulador);
  return (
    <div className="flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs" title={simulador ? 'Recebendo telemetria do simulador IoT' : undefined}>
      <span className={cn('relative flex size-2', conectado ? 'text-emerald-400' : 'text-red-400')}>
        {conectado && <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />}
        <span className="relative inline-flex size-2 rounded-full bg-current" />
      </span>
      {conectado ? 'Ao vivo' : 'Reconectando…'}
    </div>
  );
}

/** Mostra como notificação cada alerta crítico novo que chega pelo SSE. */
function NotificadorCriticos() {
  const pendentes = useOperacao((s) => s.novosCriticos.length);
  const consumir = useOperacao((s) => s.consumirCriticos);
  useEffect(() => {
    if (!pendentes) return;
    for (const a of consumir().slice(-3)) toast.error(a.titulo, { description: a.descricao, duration: 8000 });
  }, [pendentes, consumir]);
  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const iniciar = useOperacao((s) => s.iniciar);
  const criticos = useOperacao((s) => s.resumo?.alertasCriticos ?? 0);
  useEffect(() => iniciar(), [iniciar]);
  const atual = NAV.find((n) => (n.href === '/' ? pathname === '/' : pathname.startsWith(n.href))) ?? NAV[0];

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r bg-card/40 md:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary">
            <Flame className="size-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold tracking-wider">F.O.G.O.</span>
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Gestão e Operações</span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((n) => {
            const ativo = n === atual;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  ativo ? 'bg-primary/15 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <n.icone className="size-4" />
                <span className="flex-1">{n.rotulo}</span>
                {n.href === '/alertas' && criticos > 0 && (
                  <span className="rounded-full bg-red-500/20 px-1.5 text-[11px] font-semibold text-red-400">{criticos}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <p className="px-5 py-4 text-[11px] leading-relaxed text-muted-foreground">
          Marília/SP · dados de demonstração gerados pelo simulador IoT
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur md:px-6">
          <Flame className="size-5 text-primary md:hidden" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold md:text-lg">{atual.desc}</h1>
          </div>
          <IndicadorAoVivo />
          <Relogio />
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b px-3 py-2 md:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn('flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs', n === atual ? 'bg-primary/15 text-primary' : 'text-muted-foreground')}
            >
              <n.icone className="size-3.5" />
              {n.rotulo}
            </Link>
          ))}
        </nav>
        <main className="flex-1 p-4 md:p-6">
          <SoNoCliente fallback={<CarregandoPagina />}>{children}</SoNoCliente>
        </main>
      </div>
      <NotificadorCriticos />
    </div>
  );
}
