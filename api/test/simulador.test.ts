import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { gerarConfigSimulador } from '../../simulador/src/gerador-filiais';
import { enviarBatimento } from '../../simulador/src/index';

test('simulador usa 50 identidades estáveis e envia contrato autenticado', async t => {
  const seed = 'seed-ficticia-para-teste-1234567890';
  const filiais = gerarConfigSimulador(seed).filiais;
  assert.equal(new Set(filiais.map(f => f.id)).size, 50);
  assert.equal(filiais[0].token, gerarConfigSimulador(seed).filiais[0].token);
  let status = 202;
  const servidor = createServer((req, res) => {
    assert.equal(req.url, `/filiais/${filiais[0].id}/batimentos`);
    assert.equal(req.headers.authorization, `Bearer ${filiais[0].token}`);
    const partes: Buffer[] = [];
    req.on('data', parte => partes.push(parte));
    req.on('end', () => {
      assert.deepEqual(JSON.parse(Buffer.concat(partes).toString()), { cpu: 10, memoria: 20, disco: 30, servicos: { spooler: true }, latencia: 0 });
      res.writeHead(status).end();
    });
  });
  await new Promise<void>(resolve => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => servidor.close());
  const porta = (servidor.address() as any).port;
  const payload = { cpu: 10, memoria: 20, disco: 30, servicos: { spooler: true }, latencia: 0 };
  assert.equal(await enviarBatimento(`http://127.0.0.1:${porta}`, filiais[0].id, filiais[0].token, payload), true);
  status = 401;
  assert.equal(await enviarBatimento(`http://127.0.0.1:${porta}`, filiais[0].id, filiais[0].token, payload), false);
  assert.throws(() => gerarConfigSimulador('curta'));
});

import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { inserirFiliais } from '../../simulador/src/cadastrar';
test('cadastro insere 50 filiais, aceita repetição e rejeita outra seed', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(await readFile('api/schema.sql', 'utf8'));
  const filiais = gerarConfigSimulador('seed-ficticia-para-teste-1234567890').filiais;
  await inserirFiliais(db, filiais);
  await inserirFiliais(db, filiais);
  assert.equal((await db.query('SELECT id FROM filiais')).rows.length, 50);
  await assert.rejects(inserirFiliais(db, gerarConfigSimulador('outra-seed-ficticia-123456789012345').filiais));
});
