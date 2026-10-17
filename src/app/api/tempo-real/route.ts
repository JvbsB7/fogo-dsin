import { connection, type NextRequest } from 'next/server';
import { assinar } from '@/lib/server/bus';
import { prepararBanco } from '@/lib/server/boot';

// Server-Sent Events: cada mudança (equipamento, agente, ocorrência, alerta, resumo) é
// empurrada para as telas abertas assim que acontece.
export async function GET(req: NextRequest) {
  await connection();
  prepararBanco();
  const encoder = new TextEncoder();
  let encerrar = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enviar = (texto: string) => {
        try {
          controller.enqueue(encoder.encode(texto));
        } catch {
          encerrar();
        }
      };
      enviar('retry: 3000\n\n');
      const cancelarAssinatura = assinar((evento) => enviar(`data: ${JSON.stringify(evento)}\n\n`));
      const batimento = setInterval(() => enviar(': ping\n\n'), 15000);
      encerrar = () => {
        clearInterval(batimento);
        cancelarAssinatura();
        try {
          controller.close();
        } catch {
          /* já fechado */
        }
      };
      req.signal.addEventListener('abort', () => encerrar());
    },
    cancel() {
      encerrar();
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
  });
}
