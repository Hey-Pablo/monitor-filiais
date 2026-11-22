type Banco = { query(sql: string, params?: any[]): Promise<{ rows: any[] }> };
export function mesValido(mes: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) && Number(mes.slice(0,4)) >= 1000;
}

export async function disponibilidadeMensal(db: Banco, id: string, mes: string, agora = new Date()) {
  if (!mesValido(mes)) throw new Error('Mês inválido');
  const inicioMes = new Date(`${mes}-01T00:00:00.000Z`);
  const fimMes = new Date(Date.UTC(inicioMes.getUTCFullYear(), inicioMes.getUTCMonth() + 1, 1));
  const filial = (await db.query('SELECT criada_em FROM filiais WHERE id=$1', [id])).rows[0];
  if (!filial) return null;
  const inicio = Math.max(inicioMes.getTime(), new Date(filial.criada_em).getTime());
  const fim = Math.min(fimMes.getTime(), agora.getTime());
  const observadoMs = Math.max(0, fim - inicio);
  if (!observadoMs) return { mes, observadoMs: 0, indisponivelMs: 0, percentual: null };
  const incidentes = (await db.query("SELECT aberto_em,fechado_em FROM incidentes WHERE filial_id=$1 AND tipo='offline' AND aberto_em < $2 AND (fechado_em IS NULL OR fechado_em > $3) ORDER BY aberto_em", [id,new Date(fim),new Date(inicio)])).rows;
  let indisponivelMs = 0, ate = inicio;
  for (const i of incidentes) {
    const a = Math.max(inicio, new Date(i.aberto_em).getTime(), ate);
    const b = Math.min(fim, i.fechado_em ? new Date(i.fechado_em).getTime() : fim);
    if (b > a) { indisponivelMs += b - a; ate = b; }
  }
  return { mes, observadoMs, indisponivelMs, percentual: (observadoMs - indisponivelMs) * 100 / observadoMs };
}
