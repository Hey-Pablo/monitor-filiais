import { Pool } from 'pg';
import { hashToken } from './monitor';

async function cadastrar() {
  const { DATABASE_URL, FILIAL_ID, FILIAL_NOME, FILIAL_TOKEN } = process.env;
  if (!DATABASE_URL || !FILIAL_ID || !FILIAL_NOME || !FILIAL_TOKEN || !/^[a-zA-Z0-9_-]{1,80}$/.test(FILIAL_ID) || FILIAL_TOKEN.length < 32) throw new Error('Configure DATABASE_URL, FILIAL_ID, FILIAL_NOME e FILIAL_TOKEN com pelo menos 32 caracteres');
  const pool = new Pool({ connectionString: DATABASE_URL });
  try { await pool.query('INSERT INTO filiais (id,nome,token_hash) VALUES ($1,$2,$3)', [FILIAL_ID, FILIAL_NOME, hashToken(FILIAL_TOKEN)]); }
  finally { await pool.end(); }
}
cadastrar().catch(() => { console.error('Falha ao cadastrar filial'); process.exitCode = 1; });
