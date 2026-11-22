import { Pool } from 'pg';
import { hashToken } from '../../api/src/monitor';
import { gerarConfigSimulador } from './gerador-filiais';

async function cadastrar() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL ausente');
  const filiais = gerarConfigSimulador().filiais;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await inserirFiliais(client, filiais);
    await client.query('COMMIT');
    console.log('50 filiais fictícias cadastradas ou já existentes.');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
if (require.main === module) cadastrar().catch(() => { console.error('Falha ao cadastrar filiais; confira banco, seed e conflitos.'); process.exitCode = 1; });

export async function inserirFiliais(client: { query: (sql: string, params?: any[]) => Promise<any> }, filiais: ReturnType<typeof gerarConfigSimulador>['filiais']) {
  for (const filial of filiais) {
    const hash = hashToken(filial.token);
    const existente = await client.query('SELECT token_hash FROM filiais WHERE id=$1', [filial.id]);
    if (existente.rows.length && existente.rows[0].token_hash !== hash) throw new Error('Filial existente possui outro token');
    if (!existente.rows.length) await client.query('INSERT INTO filiais (id,nome,token_hash) VALUES ($1,$2,$3)', [filial.id, filial.nome, hash]);
  }
}
