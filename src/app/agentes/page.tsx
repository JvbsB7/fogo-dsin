import type { Metadata } from 'next';
import { ListaAgentes } from '@/components/fogo/lista-agentes';

export const metadata: Metadata = { title: 'Agentes' };

export default function Page() {
  return <ListaAgentes />;
}
