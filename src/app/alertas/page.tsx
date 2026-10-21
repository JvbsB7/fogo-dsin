import type { Metadata } from 'next';
import { PaginaAlertas } from '@/components/fogo/pagina-alertas';

export const metadata: Metadata = { title: 'Alertas' };

export default function Page() {
  return <PaginaAlertas />;
}
