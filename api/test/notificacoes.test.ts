import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { criarMonitor, hashToken } from '../src/monitor';
import { enviarPendentes } from '../src/notificacoes';

test('eventos geram uma notificação por transição com duração', async () => {
  const db = new PGlite();
  await db.exec(await readFile('api/schema.sql', 'utf8'));
  await db.query('INSERT INTO filiais (id,nome,token_hash) VALUES ($1,$2,$3)', ['f1','Filial fictícia',hashToken('teste')]);
  let agora = new Date('2026-01-01T12:00:00Z');
  const monitor = criarMonitor(db, () => agora);
  const dados = {cpu: 5, memoria: 10, disco: 5, servicos: {}, latencia: 1};
  await monitor.receber('f1','teste',dados);
  await monitor.receber('f1','teste',dados);
  agora = new Date('2026-01-01T12:01:00Z');
  await monitor.receber('f1','teste',{...dados,disco: 20});
  const mensagens: string[] = [];
  await enviarPendentes(db, async texto => { mensagens.push(texto); });
  await enviarPendentes(db, async texto => { mensagens.push(texto); });
  assert.equal(mensagens.length,2);
  assert.match(mensagens[1], /60 segundos/);
  await db.close();
});

test('falha de envio não causa segunda tentativa automática', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile('api/schema.sql', 'utf8'));
    await db.query("INSERT INTO filiais (id,nome,token_hash) VALUES ('f','Fictícia','hash')");
    const incidente = await db.query<{id: number}>("INSERT INTO incidentes (filial_id,tipo,aberto_em) VALUES ('f','offline',now()) RETURNING id");
    await db.query("INSERT INTO notificacoes (incidente_id,evento) VALUES ($1,'abertura')", [incidente.rows[0].id]);
    let tentativas = 0;
    const falhar = async () => { tentativas++; throw new Error('indisponível'); };
    await enviarPendentes(db, falhar);
    await enviarPendentes(db, falhar);
    assert.equal(tentativas, 1);
    const registro = await db.query<{falhou: boolean}>('SELECT falhou FROM notificacoes');
    assert.equal(registro.rows[0].falhou, true);
  } finally { await db.close(); }
});

test('Telegram usa chat configurado e rejeita resposta de erro', async () => {
  const { telegram } = await import('../src/notificacoes');
  let corpo = '';
  const simulado = (async (_url: string | URL | Request, init?: RequestInit) => {
    corpo = String(init?.body);
    return new Response(JSON.stringify({ok: false}), {status: 200});
  }) as typeof fetch;
  await assert.rejects(telegram('token-ficticio', 'chat-ficticio', simulado)('aviso'));
  assert.deepEqual(JSON.parse(corpo), {chat_id: 'chat-ficticio', text: 'aviso'});
});
