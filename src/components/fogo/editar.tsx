'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Agente, Equipamento } from '@/lib/types';
import { FormAgente } from './form-agente';
import { FormEquipamento } from './form-equipamento';

function useRegistro<T>(url: string) {
  const [estado, setEstado] = useState<{ dado?: T; erro?: boolean }>({});
  useEffect(() => {
    let vivo = true;
    fetch(url)
      .then(async (r) => vivo && setEstado(r.ok ? { dado: await r.json() } : { erro: true }))
      .catch(() => vivo && setEstado({ erro: true }));
    return () => {
      vivo = false;
    };
  }, [url]);
  return estado;
}

function NaoEncontrado({ voltar, texto }: { voltar: string; texto: string }) {
  return (
    <div className="grid place-items-center gap-3 py-20 text-center">
      <p className="text-muted-foreground">{texto}</p>
      <Link href={voltar} className={buttonVariants({ variant: 'outline' })}>Voltar</Link>
    </div>
  );
}

export function EditarEquipamento({ id }: { id: number }) {
  const { dado, erro } = useRegistro<Equipamento>(`/api/equipamentos/${id}`);
  if (erro) return <NaoEncontrado voltar="/equipamentos" texto="Equipamento não encontrado." />;
  if (!dado) return <Skeleton className="mx-auto h-[70vh] max-w-5xl" />;
  return <FormEquipamento inicial={dado} />;
}

export function EditarAgente({ id }: { id: number }) {
  const { dado, erro } = useRegistro<Agente>(`/api/agentes/${id}`);
  if (erro) return <NaoEncontrado voltar="/agentes" texto="Agente não encontrado." />;
  if (!dado) return <Skeleton className="mx-auto h-[60vh] max-w-4xl" />;
  return <FormAgente inicial={dado} />;
}
