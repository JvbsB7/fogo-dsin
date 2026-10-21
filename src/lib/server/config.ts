// Parâmetros do simulador, lidos do ambiente (ver README).
export const SIM_INTERVALO_MS = Number(process.env.FOGO_SIM_INTERVALO_MS ?? 4000);
/** Quantos segundos simulados passam a cada segundo real. */
export const SIM_ACELERACAO = Math.max(1, Number(process.env.FOGO_SIM_ACELERACAO ?? 30));
export const SIM_FATOR_FALHAS = Number(process.env.FOGO_SIM_FATOR_FALHAS ?? 20);

/**
 * Peso de uma ocorrência nas estatísticas. O simulador comprime o tempo: em 1 hora real ele
 * gera as ocorrências de SIM_ACELERACAO horas. Para não inflar a taxa da hora atual, cada
 * ocorrência simulada vale 1/SIM_ACELERACAO. Histórico e registros manuais valem 1.
 */
export const pesoOcorrencia = (origem: string) => (origem === 'simulador' ? 1 / SIM_ACELERACAO : 1);
