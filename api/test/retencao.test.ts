import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { reter } from '../src/retencao';

test('resume horas antigas e só remove batimentos resumidos', async () => {
  const db = new PGlite();
  await db.exec(await readFile('api/schema.sql','utf8'));
  await db.query("INSERT INTO filiais (id,nome,token_hash) VALUES ('f','Fictícia','hash')");
  const dado = JSON.stringify({cpu: 20,memoria: 40,disco: 30});
  await db.query("INSERT INTO batimentos (filial_id,recebido_em,dados) VALUES ('f',$1,$2),('f',$3,$2)", ['2026-01-01T10:10:00Z',dado,'2026-01-03T10:10:00Z']);
  await reter(db,new Date('2026-01-03T12:00:00Z'),24);
  assert.equal((await db.query('SELECT * FROM resumo_horario')).rows.length,1);
  assert.equal((await db.query('SELECT * FROM batimentos')).rows.length,1);
  await db.close();
});
