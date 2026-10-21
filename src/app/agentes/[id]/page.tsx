import type { Metadata } from 'next';
import { EditarAgente } from '@/components/fogo/editar';

export const metadata: Metadata = { title: 'Editar agente' };

export default async function Page({ params }: PageProps<'/agentes/[id]'>) {
  const { id } = await params;
  return <EditarAgente id={Number(id)} />;
}
