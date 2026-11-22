import { createHash, timingSafeEqual } from 'node:crypto';
import { avaliar } from './regras';

export type Batimento = { cpu: number; memoria: number; disco: number; servicos: Record<string, boolean>; latencia: number };
type Banco = { query(sql: string, params?: any[]): Promise<{ rows: any[] }> };
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function criarMonitor(db: Banco, relogio = () => new Date()) {
  async function reconciliar(id: string, ativos: string[], agora: Date) {
    const abertos = (await db.query('SELECT id, tipo FROM incidentes WHERE filial_id = $1 AND fechado_em IS NULL', [id])).rows;
    for (const tipo of ativos) {
      await db.query('INSERT INTO incidentes (filial_id,tipo,aberto_em) VALUES ($1,$2,$3) ON CONFLICT (filial_id,tipo) WHERE fechado_em IS NULL DO NOTHING', [id,tipo,agora]);
    }
    for (const incidente of abertos) {
      if (!ativos.includes(incidente.tipo)) await db.query('UPDATE incidentes SET fechado_em=$1 WHERE id=$2 AND fechado_em IS NULL', [agora, incidente.id]);
    }
  }
  let fila: Promise<unknown> = Promise.resolve();
  function transacao<T>(operacao: () => Promise<T>): Promise<T> {
    const trabalho = fila.then(async () => {
      await db.query('BEGIN');
      try {
        const resultado = await operacao();
        await db.query('COMMIT');
        return resultado;
      } catch (erro) {
        await db.query('ROLLBACK');
        throw erro;
      }
    });
    fila = trabalho.catch(() => undefined);
    return trabalho;
  }
  return {
    receber(id: string, token: string, dados: Batimento) {
      return transacao(async () => {
      const filial = (await db.query('SELECT token_hash FROM filiais WHERE id=$1', [id])).rows[0];
      const esperado = Buffer.from(filial?.token_hash ?? '0'.repeat(64), 'hex');
      const recebido = Buffer.from(hashToken(token), 'hex');
      if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido) || !filial) {
        await db.query("INSERT INTO acessos_invalidos (filial_id) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM acessos_invalidos WHERE filial_id IS NOT DISTINCT FROM $1 AND ocorrido_em >= now() - interval '1 hour')", [filial ? id : null]);
        return false;
      }
      const agora = relogio();
      await db.query('INSERT INTO batimentos (filial_id,recebido_em,dados) VALUES ($1,$2,$3)', [id,agora,JSON.stringify(dados)]);
      await reconciliar(id, avaliar({ ultimo: agora, disco: dados.disco, servicos: dados.servicos }, agora), agora);
      return true;
      });
    },
    verificar() {
      return transacao(async () => {
      const agora = relogio();
      const filiais = (await db.query('SELECT f.id, f.criada_em, b.recebido_em, b.dados FROM filiais f LEFT JOIN LATERAL (SELECT recebido_em,dados FROM batimentos WHERE filial_id=f.id ORDER BY recebido_em DESC,id DESC LIMIT 1) b ON true')).rows;
      for (const f of filiais) {
        const dados = f.dados ?? { disco: 100, servicos: {} };
        await reconciliar(f.id, avaliar({ ultimo: new Date(f.recebido_em ?? f.criada_em), disco: dados.disco, servicos: dados.servicos }, agora), agora);
      }
      });
    }
  };
}
