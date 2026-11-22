import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { criarMonitor } from './monitor';
import { criarApp } from './app';
import { reter } from './retencao';
import { enviarPendentes, telegram } from './notificacoes';

async function iniciar() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL é obrigatória');
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (Boolean(TELEGRAM_BOT_TOKEN) !== Boolean(TELEGRAM_CHAT_ID)) throw new Error('Configure ambas as variáveis do Telegram');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  await pool.query(await readFile('api/schema.sql', 'utf8'));
  const monitor = criarMonitor(pool);
  const verificar = async () => { try { await monitor.verificar(); } catch { console.error('Falha ao verificar incidentes'); } };
  await verificar();
  setInterval(verificar, 15_000);
  const manutencao = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  let executando = false;
  const executarRetencao = async () => {
    if (executando) return;
    executando = true;
    try {
      const cliente = await manutencao.connect();
      try { await reter(cliente, new Date(), 24 * 30); }
      finally { cliente.release(); }
    } catch { console.error('Falha na retenção'); }
    finally { executando = false; }
  };
  await executarRetencao();
  setInterval(executarRetencao, 60 * 60 * 1000);
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    const envio = telegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
    const notificacoes = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    let enviando = false;
    const despachar = async () => {
      if (enviando) return;
      enviando = true;
      try { await enviarPendentes(notificacoes, envio); }
      catch { console.error('Falha ao processar notificações'); }
      finally { enviando = false; }
    };
    await despachar();
    setInterval(despachar, 15_000);
  }
  criarApp(monitor).listen(Number(process.env.PORT ?? 3000));
}
iniciar().catch(() => { console.error('Falha ao iniciar API'); process.exitCode = 1; });
