import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { criarApp } from '../src/app';
import { criarEventos } from '../src/eventos';

test('SSE envia atualização inicial e após batimento aceito', async () => {
  const eventos = criarEventos();
  const app = criarApp({ async receber() { return true; } }, undefined, eventos);
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const endereco = server.address();
  if (!endereco || typeof endereco === 'string') throw new Error('sem endereço');
  const base = `http://127.0.0.1:${endereco.port}`;
  const controlador = new AbortController();
  try {
    const fluxo = await fetch(`${base}/eventos`, { signal: controlador.signal });
    assert.match(fluxo.headers.get('content-type') ?? '', /text\/event-stream/);
    const leitor = fluxo.body!.getReader();
    assert.match(new TextDecoder().decode((await leitor.read()).value), /event: atualizacao/);
    const response = await fetch(`${base}/filiais/f/batimentos`, { method:'POST', headers: {'content-type':'application/json', authorization:'Bearer teste'}, body: JSON.stringify({cpu:1,memoria:2,disco:3,latencia:4,servicos:{}}) });
    assert.equal(response.status,202);
    assert.match(new TextDecoder().decode((await leitor.read()).value), /event: atualizacao/);
  } finally { controlador.abort(); server.closeAllConnections(); server.close(); }
});
