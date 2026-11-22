import express from 'express';
import { z } from 'zod';
import type { Batimento } from './monitor';

const corpo = z.object({ cpu: z.number().min(0).max(100), memoria: z.number().min(0).max(100), disco: z.number().min(0).max(100), servicos: z.record(z.string().min(1).max(100), z.boolean()), latencia: z.number().min(0).max(600000) }).strict();
export function criarApp(monitor: { receber(id: string, token: string, dados: Batimento): Promise<boolean> }) {
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  app.post('/filiais/:id/batimentos', async (req, res) => {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(req.params.id)) return res.sendStatus(400);
    const token = req.get('authorization')?.match(/^Bearer (\S{1,512})$/)?.[1] ?? '';
    const validado = corpo.safeParse(req.body);
    if (!validado.success) return res.status(422).json({ erro: 'Batimento inválido' });
    try {
      if (!await monitor.receber(req.params.id, token, validado.data)) return res.sendStatus(401);
      return res.sendStatus(202);
    } catch {
      return res.status(500).json({ erro: 'Erro interno' });
    }
  });
  return app;
}
