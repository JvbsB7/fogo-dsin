import type { Metadata } from 'next';
import { FormAgente } from '@/components/fogo/form-agente';

export const metadata: Metadata = { title: 'Novo agente' };

export default function Page() {
  return <FormAgente />;
}
