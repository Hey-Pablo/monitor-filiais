import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { disponibilidadeMensal } from '../src/disponibilidade';

test('calcula tempo observado e recorta incidentes aos limites do mês', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile('api/schema.sql','utf8'));
    await db.query("INSERT INTO filiais (id,nome,token_hash,criada_em) VALUES ('f','Fictícia','x','2026-01-01T00:00:00Z')");
    await db.query("INSERT INTO incidentes (filial_id,tipo,aberto_em,fechado_em) VALUES ('f','offline','2026-01-31T23:00:00Z','2026-02-01T01:00:00Z'),('f','disco','2026-02-01T02:00:00Z',NULL)");
    const r = await disponibilidadeMensal(db,'f','2026-02',new Date('2026-02-01T04:00:00Z'));
    assert.equal(r?.observadoMs, 4 * 3600000);
    assert.equal(r?.indisponivelMs, 3600000);
    assert.equal(r?.percentual,75);
    assert.equal(await disponibilidadeMensal(db,'ausente','2026-02',new Date('2026-02-01T04:00:00Z')),null);
  } finally { await db.close(); }
});

test('incidente aberto conta até agora; mês sem período observado não inventa percentual', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile('api/schema.sql','utf8'));
    await db.query("INSERT INTO filiais (id,nome,token_hash,criada_em) VALUES ('f','Fictícia','x','2026-02-01T02:00:00Z')");
    await db.query("INSERT INTO incidentes (filial_id,tipo,aberto_em) VALUES ('f','offline','2026-02-01T03:00:00Z')");
    const r = await disponibilidadeMensal(db,'f','2026-02',new Date('2026-02-01T04:00:00Z'));
    assert.equal(r?.percentual,50);
    assert.equal((await disponibilidadeMensal(db,'f','2026-03',new Date('2026-02-01T04:00:00Z')))?.percentual,null);
    await assert.rejects(disponibilidadeMensal(db,'f','2026-13'));
  } finally { await db.close(); }
});
