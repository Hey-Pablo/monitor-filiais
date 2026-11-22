import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { criarApp } from '../src/app';

test('HTTP valida corpo e recusa token inválido', async () => {
  let chamadas = 0;
  const app = criarApp({ async receber(_id, token) { chamadas++; return token === 'teste'; } });
  const servidor = app.listen(0);
  await new Promise<void>(resolve => servidor.once('listening', resolve));
  const endereco = servidor.address();
  if (!endereco || typeof endereco === 'string') throw new Error('endereço indisponível');
  const url = `http://127.0.0.1:${endereco.port}/filiais/f1/batimentos`;
  const enviar = (token: string, corpo: object) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(corpo) });
  try {
    const valido = { cpu: 10, memoria: 20, disco: 30, servicos: { ERP: true }, latencia: 5 };
    assert.equal((await enviar('errado', valido)).status, 401);
    assert.equal((await enviar('teste', { ...valido, disco: -1 })).status, 422);
    assert.equal((await enviar('teste', valido)).status, 202);
    assert.equal(chamadas, 2);
  } finally { servidor.close(); }
});
