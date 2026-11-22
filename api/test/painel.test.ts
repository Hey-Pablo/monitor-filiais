import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { estadoFilial } from '../../painel/src/estado';

test('classifica filial sem dados, offline, alerta e normal', () => {
  assert.equal(estadoFilial({recebido_em:null,ativos:[]}), 'aguardando');
  assert.equal(estadoFilial({recebido_em:'2026-01-01',ativos:['offline','disco']}), 'offline');
  assert.equal(estadoFilial({recebido_em:'2026-01-01',ativos:['disco']}), 'alerta');
  assert.equal(estadoFilial({recebido_em:'2026-01-01',ativos:[]}), 'normal');
});
