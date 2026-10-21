import type { Metadata } from 'next';
import { Inventario } from '@/components/fogo/inventario';

export const metadata: Metadata = { title: 'Equipamentos' };

export default function Page() {
  return <Inventario />;
}
