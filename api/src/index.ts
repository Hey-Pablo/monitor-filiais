import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { criarMonitor } from './monitor';
import { criarApp } from './app';

async function iniciar() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL é obrigatória');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  await pool.query(await readFile('api/schema.sql', 'utf8'));
  const monitor = criarMonitor(pool);
  const verificar = async () => { try { await monitor.verificar(); } catch { console.error('Falha ao verificar incidentes'); } };
  await verificar();
  setInterval(verificar, 15_000);
  criarApp(monitor).listen(Number(process.env.PORT ?? 3000));
}
iniciar().catch(() => { console.error('Falha ao iniciar API'); process.exitCode = 1; });
