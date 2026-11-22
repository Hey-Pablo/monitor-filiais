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
