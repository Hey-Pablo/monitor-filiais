import type { Response } from 'express';

export function criarEventos() {
  const clientes = new Set<Response>();
  const enviar = (res: Response) => {
    if (!res.write('event: atualizacao\ndata: {}\n\n')) { clientes.delete(res); res.end(); }
  };
  return {
    conectar(res: Response) {
      if (clientes.size >= 100) { res.sendStatus(503); return; }
      res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.flushHeaders();
      clientes.add(res);
      enviar(res);
      const pulso = setInterval(() => { if (!res.write(': pulso\n\n')) { clientes.delete(res); res.end(); } }, 25000);
      res.on('close', () => { clearInterval(pulso); clientes.delete(res); });
    },
    publicar() { for (const cliente of clientes) enviar(cliente); }
  };
}
