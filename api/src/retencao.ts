type Banco = { query(sql: string, params?: any[]): Promise<{ rows: any[] }> };
export async function reter(db: Banco, agora: Date, horas: number) {
  if (!Number.isInteger(horas) || horas < 1) throw new Error('Retenção inválida');
  const limite = new Date(agora.getTime() - horas * 3600000);
  limite.setUTCMinutes(0,0,0);
  await db.query('BEGIN');
  try {
    await db.query(`INSERT INTO resumo_horario (filial_id,hora,quantidade,cpu_media,memoria_media,disco_minimo)
      SELECT filial_id,date_trunc('hour',recebido_em AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',count(*),avg((dados->>'cpu')::numeric),avg((dados->>'memoria')::numeric),min((dados->>'disco')::numeric)
      FROM batimentos WHERE recebido_em < $1 GROUP BY filial_id,date_trunc('hour',recebido_em AT TIME ZONE 'UTC')
      ON CONFLICT (filial_id,hora) DO UPDATE SET quantidade=resumo_horario.quantidade+excluded.quantidade,
      cpu_media=(resumo_horario.cpu_media*resumo_horario.quantidade+excluded.cpu_media*excluded.quantidade)/(resumo_horario.quantidade+excluded.quantidade),
      memoria_media=(resumo_horario.memoria_media*resumo_horario.quantidade+excluded.memoria_media*excluded.quantidade)/(resumo_horario.quantidade+excluded.quantidade),
      disco_minimo=least(resumo_horario.disco_minimo,excluded.disco_minimo)`, [limite]);
    await db.query('DELETE FROM batimentos WHERE recebido_em < $1',[limite]);
    await db.query("DELETE FROM acessos_invalidos WHERE ocorrido_em < $1::timestamptz - interval '30 days'",[agora]);
    await db.query('COMMIT');
  } catch (erro) { await db.query('ROLLBACK'); throw erro; }
}
