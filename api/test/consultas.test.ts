import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { listarFiliais, detalheFilial } from '../src/consultas';

test('consultas retornam métricas e histórico sem expor token', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile('api/schema.sql','utf8'));
    await db.query("INSERT INTO filiais(id,nome,token_hash) VALUES ('f','Fictícia','segredo')");
    await db.query("INSERT INTO batimentos(filial_id,recebido_em,dados) VALUES ('f',now(),$1)",[JSON.stringify({cpu:20})]);
    await db.query("INSERT INTO incidentes(filial_id,tipo,aberto_em) VALUES ('f','offline',now())");
    const lista = await listarFiliais(db);
    assert.equal(lista[0].nome,'Fictícia');
    assert.equal(lista[0].dados.cpu,20);
    assert.equal('token_hash' in lista[0],false);
    const detalhe = await detalheFilial(db,'f');
    assert.equal(detalhe?.incidentes.length,1);
    assert.equal(await detalheFilial(db,'ausente'),null);
  } finally { await db.close(); }
});
