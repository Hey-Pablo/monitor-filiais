import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { avaliar } from '../src/regras';

test('regras distinguem limiares e serviço parado', () => {
  const agora = new Date('2026-01-01T12:03:00Z');
  assert.deepEqual(avaliar({ ultimo: new Date('2026-01-01T12:00:00Z'), disco: 9, servicos: { ERP: false } }, agora), ['offline', 'disco', 'servico:ERP']);
  assert.deepEqual(avaliar({ ultimo: new Date('2026-01-01T12:02:00Z'), disco: 10, servicos: { ERP: true } }, agora), []);
});
