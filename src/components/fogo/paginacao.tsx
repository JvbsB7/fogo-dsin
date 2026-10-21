'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Paginacao({ pagina, total, porPagina, aoMudar }: { pagina: number; total: number; porPagina: number; aoMudar: (p: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const ini = total ? (pagina - 1) * porPagina + 1 : 0;
  const fim = Math.min(total, pagina * porPagina);
  return (
    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        {ini}–{fim} de {total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)} aria-label="Página anterior">
          <ChevronLeft />
        </Button>
        <span className="px-2 tabular-nums">
          {pagina} / {paginas}
        </span>
        <Button variant="outline" size="icon-sm" disabled={pagina >= paginas} onClick={() => aoMudar(pagina + 1)} aria-label="Próxima página">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

/** Gera e baixa um CSV (separador ";" para abrir direto no Excel em pt-BR). */
export function baixarCsv(nome: string, cabecalho: string[], linhas: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const csv = '﻿' + [cabecalho, ...linhas].map((l) => l.map(esc).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
