'use client';

import { useSyncExternalStore } from 'react';

const assinarNada = () => () => {};

/** true só depois da hidratação no navegador. */
export function useNoCliente() {
  return useSyncExternalStore(assinarNada, () => true, () => false);
}

/**
 * As telas do F.O.G.O. são painéis ao vivo (dados do SSE, relógio, "há 3 min"): não faz
 * sentido pré-renderizá-las no servidor. Renderizamos só no navegador, com um esqueleto antes.
 */
export function SoNoCliente({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return useNoCliente() ? children : fallback;
}
