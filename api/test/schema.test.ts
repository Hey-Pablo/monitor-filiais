import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

test('schema impede incidentes abertos duplicados e preserva histórico', async () => {
  const db = new PGlite();
  await db.exec(await readFile('api/schema.sql', 'utf8'));
  await db.query("INSERT INTO filiais (id, nome, token_hash) VALUES ($1, $2, $3)", ['f1', 'Filial fictícia', 'hash']);
  await db.query("INSERT INTO incidentes (filial_id, tipo, aberto_em) VALUES ($1, $2, $3)", ['f1', 'offline', new Date()]);
  await assert.rejects(db.query("INSERT INTO incidentes (filial_id, tipo, aberto_em) VALUES ($1, $2, $3)", ['f1', 'offline', new Date()]));
  await db.exec("UPDATE incidentes SET fechado_em = now()");
  await db.query("INSERT INTO incidentes (filial_id, tipo, aberto_em) VALUES ($1, $2, $3)", ['f1', 'offline', new Date()]);
  await db.close();
});
