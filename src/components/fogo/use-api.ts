'use client';

import { useCallback, useEffect, useState } from 'react';

/** Busca um endpoint da API e atualiza a cada `intervaloMs` (as previsões mudam com a operação). */
export function useApi<T>(url: string, intervaloMs = 60000) {
  const [dado, setDado] = useState<T | null>(null);
  const [erro, setErro] = useState(false);
  const carregar = useCallback(async () => {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error();
      setDado(await r.json());
      setErro(false);
    } catch {
      setErro(true);
    }
  }, [url]);
  useEffect(() => {
    let ativo = true;
    const executar = () => ativo && carregar();
    executar();
    const t = setInterval(executar, intervaloMs);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [carregar, intervaloMs]);
  return { dado, erro, recarregar: carregar };
}
