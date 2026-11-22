import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { criarMonitor, hashToken } from '../src/monitor';

test('ingestão autentica, registra rejeição e abre e fecha incidentes sem duplicar', async () => {
  const db = new PGlite();
  await db.exec(await readFile('api/schema.sql', 'utf8'));
  await db.query('INSERT INTO filiais (id,nome,token_hash) VALUES ($1,$2,$3)', ['f1','Filial fictícia',hashToken('segredo-de-teste')]);
  let agora = new Date('2026-01-01T12:00:00Z');
  const monitor = criarMonitor(db, () => agora);
  const dados = { cpu: 20, memoria: 40, disco: 9, servicos: { ERP: false }, latencia: 5 };
  assert.equal(await monitor.receber('f1', 'invalido', dados), false);
  assert.equal((await db.query('SELECT * FROM acessos_invalidos')).rows.length, 1);
  assert.equal(await monitor.receber('f1', 'segredo-de-teste', dados), true);
  await monitor.receber('f1', 'segredo-de-teste', dados);
  assert.equal((await db.query('SELECT * FROM incidentes WHERE fechado_em IS NULL')).rows.length, 2);
  agora = new Date('2026-01-01T12:03:00Z');
  await monitor.verificar();
  assert.equal((await db.query('SELECT * FROM incidentes WHERE fechado_em IS NULL')).rows.length, 3);
  await monitor.receber('f1', 'segredo-de-teste', { ...dados, disco: 20, servicos: { ERP: true } });
  assert.equal((await db.query('SELECT * FROM incidentes WHERE fechado_em IS NULL')).rows.length, 0);
  await db.close();
});

test('filiais inexistentes compartilham um registro de rejeição por hora', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile('api/schema.sql', 'utf8'));
    const monitor = criarMonitor(db);
    const dados = { cpu: 20, memoria: 40, disco: 50, servicos: {}, latencia: 1 };
    for (let i = 0; i < 10; i++) assert.equal(await monitor.receber(`inexistente${i}`, 'x', dados), false);
    const registros = await db.query('SELECT filial_id FROM acessos_invalidos');
    assert.equal(registros.rows.length, 1);
    assert.equal(registros.rows[0].filial_id, null);
  } finally { await db.close(); }
});
