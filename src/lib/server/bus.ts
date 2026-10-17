import { EventEmitter } from 'node:events';
import type { EventoTempoReal } from '@/lib/types';

// Barramento em memória que liga o simulador/API ao fluxo SSE das telas.
// Fica em globalThis porque instrumentation e route handlers são módulos distintos.
const g = globalThis as unknown as { __fogoBus?: EventEmitter };

function bus() {
  if (!g.__fogoBus) {
    g.__fogoBus = new EventEmitter();
    g.__fogoBus.setMaxListeners(200);
  }
  return g.__fogoBus;
}

export function publicar(evento: EventoTempoReal) {
  bus().emit('evento', evento);
}

export function assinar(fn: (evento: EventoTempoReal) => void) {
  bus().on('evento', fn);
  return () => {
    bus().off('evento', fn);
  };
}
