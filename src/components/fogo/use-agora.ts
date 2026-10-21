'use client';

import { useSyncExternalStore } from 'react';

// Relógio compartilhado (atualiza a cada 30 s). Lê o horário fora do render, mantendo os
// componentes puros, e todo mundo que mostra "agora" enxerga o mesmo instante.
let agora = Date.now();
const ouvintes = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function assinar(fn: () => void) {
  ouvintes.add(fn);
  if (!timer) {
    timer = setInterval(() => {
      agora = Date.now();
      ouvintes.forEach((o) => o());
    }, 30000);
  }
  return () => {
    ouvintes.delete(fn);
    if (!ouvintes.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useAgora() {
  return useSyncExternalStore(assinar, () => agora, () => agora);
}
