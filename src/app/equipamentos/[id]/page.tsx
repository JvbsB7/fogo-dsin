import type { Metadata } from 'next';
import { EditarEquipamento } from '@/components/fogo/editar';

export const metadata: Metadata = { title: 'Editar equipamento' };

export default async function Page({ params }: PageProps<'/equipamentos/[id]'>) {
  const { id } = await params;
  return <EditarEquipamento id={Number(id)} />;
}
