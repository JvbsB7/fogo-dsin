import { TURNOS, turnoDaHora, type Turno } from '@/lib/catalog';

export { TURNOS, type Turno };

const HORA = 3600000;
const OFFSET = -3 * HORA; // Marília: UTC-3

/** Turno que contém o instante, com início e fim (epoch ms). O turno da noite atravessa a meia-noite. */
export function partesDoTurno(instante: number) {
  const local = instante + OFFSET;
  const meiaNoiteLocal = Math.floor(local / (24 * HORA)) * 24 * HORA;
  const hora = new Date(local).getUTCHours();
  const turno = turnoDaHora(hora);
  let inicioLocal: number;
  let fimLocal: number;
  if (turno === 'manha') {
    inicioLocal = meiaNoiteLocal + 6 * HORA;
    fimLocal = meiaNoiteLocal + 14 * HORA;
  } else if (turno === 'tarde') {
    inicioLocal = meiaNoiteLocal + 14 * HORA;
    fimLocal = meiaNoiteLocal + 22 * HORA;
  } else if (hora >= 22) {
    inicioLocal = meiaNoiteLocal + 22 * HORA;
    fimLocal = meiaNoiteLocal + 30 * HORA;
  } else {
    inicioLocal = meiaNoiteLocal - 2 * HORA;
    fimLocal = meiaNoiteLocal + 6 * HORA;
  }
  return { turno, inicio: inicioLocal - OFFSET, fim: fimLocal - OFFSET };
}
