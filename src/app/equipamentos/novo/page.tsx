import type { Metadata } from 'next';
import { FormEquipamento } from '@/components/fogo/form-equipamento';

export const metadata: Metadata = { title: 'Novo equipamento' };

export default function Page() {
  return <FormEquipamento />;
}
