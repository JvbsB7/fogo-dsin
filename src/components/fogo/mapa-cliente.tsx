'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// O Leaflet usa `window`, então o mapa só é carregado no navegador.
export const MapaCliente = dynamic(() => import('./mapa'), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

export const SeletorLocalCliente = dynamic(() => import('./seletor-local'), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});
