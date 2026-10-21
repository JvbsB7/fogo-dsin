import type { Metadata } from 'next';
import { Previsoes } from '@/components/fogo/previsoes';

export const metadata: Metadata = { title: 'Previsões' };

export default function Page() {
  return <Previsoes />;
}
