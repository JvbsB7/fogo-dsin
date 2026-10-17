// Roda uma vez quando o servidor Next sobe: prepara o banco e liga o simulador IoT.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const { iniciar } = await import('./lib/server/boot');
  iniciar();
}
