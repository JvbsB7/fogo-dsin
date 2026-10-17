import { api } from '@/lib/server/api';
import { previsaoManutencao } from '@/lib/server/previsoes';

export async function GET() {
  return api(() => previsaoManutencao());
}
