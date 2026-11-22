import express from 'express';
import { z } from 'zod';
import type { Batimento } from './monitor';
import { disponibilidadeMensal, mesValido } from './disponibilidade';

const corpo = z.object({ cpu: z.number().min(0).max(100), memoria: z.number().min(0).max(100), disco: z.number().min(0).max(100), servicos: z.record(z.string().min(1).max(100), z.boolean()), latencia: z.number().min(0).max(600000) }).strict();
export function criarApp(monitor: { receber(id: string, token: string, dados: Batimento): Promise<boolean> }, consultas?: Parameters<typeof disponibilidadeMensal>[0]) {
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  app.get('/filiais/:id/disponibilidade', async (req, res) => {
    const mes = req.query.mes;
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(req.params.id) || typeof mes !== 'string' || !mesValido(mes)) return res.sendStatus(400);
    if (!consultas) return res.sendStatus(503);
    try {
      const resultado = await disponibilidadeMensal(consultas, req.params.id, mes);
      return resultado ? res.json(resultado) : res.sendStatus(404);
    } catch { return res.status(500).json({ erro: 'Erro interno' }); }
  });
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
