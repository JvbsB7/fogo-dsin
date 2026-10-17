import { api } from '@/lib/server/api';
import { calcularResumo } from '@/lib/server/resumo';

export async function GET() {
  return api(() => calcularResumo());
}
