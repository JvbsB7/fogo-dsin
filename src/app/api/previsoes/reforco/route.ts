import { api } from '@/lib/server/api';
import { previsaoReforco } from '@/lib/server/previsoes';

export async function GET() {
  return api(() => previsaoReforco());
}
