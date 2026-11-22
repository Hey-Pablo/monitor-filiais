type Banco = { query(sql: string, params?: any[]): Promise<{ rows: any[] }> };
const campos = `SELECT f.id,f.nome,f.criada_em,b.recebido_em,b.dados,
  COALESCE((SELECT json_agg(i.tipo ORDER BY i.tipo) FROM incidentes i WHERE i.filial_id=f.id AND i.fechado_em IS NULL),'[]'::json) AS ativos
  FROM filiais f LEFT JOIN LATERAL (SELECT recebido_em,dados FROM batimentos WHERE filial_id=f.id ORDER BY recebido_em DESC,id DESC LIMIT 1) b ON true`;
export async function listarFiliais(db: Banco) {
  return (await db.query(`${campos} ORDER BY f.nome,f.id`)).rows;
}
export async function detalheFilial(db: Banco, id: string) {
  const filial = (await db.query(`${campos} WHERE f.id=$1`,[id])).rows[0];
  if (!filial) return null;
  const incidentes = (await db.query('SELECT id,tipo,aberto_em,fechado_em FROM incidentes WHERE filial_id=$1 ORDER BY aberto_em DESC,id DESC LIMIT 100',[id])).rows;
  return { ...filial, incidentes };
}
