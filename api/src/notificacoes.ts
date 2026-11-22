type Banco = { query(sql: string, params?: any[]): Promise<{ rows: any[] }> };

// Marca antes do envio para evitar duplicações após interrupção ou timeout ambíguo.
export async function enviarPendentes(db: Banco, enviar: (texto: string) => Promise<void>) {
  const pendentes = await db.query(`SELECT n.id,n.evento,i.tipo,i.aberto_em,i.fechado_em,f.nome
    FROM notificacoes n JOIN incidentes i ON i.id=n.incidente_id JOIN filiais f ON f.id=i.filial_id
    WHERE n.tentada_em IS NULL AND n.enviada_em IS NULL ORDER BY n.id`);
  for (const n of pendentes.rows) {
    const reserva = await db.query('UPDATE notificacoes SET tentada_em=now() WHERE id=$1 AND tentada_em IS NULL RETURNING id', [n.id]);
    if (!reserva.rows.length) continue;
    const duracao = n.fechado_em ? Math.max(0, Math.floor((new Date(n.fechado_em).getTime() - new Date(n.aberto_em).getTime()) / 1000)) : 0;
    const texto = n.evento === 'abertura' ? `Incidente ${n.tipo} aberto em ${n.nome}.` : `Incidente ${n.tipo} normalizado em ${n.nome}. Duração: ${duracao} segundos.`;
    try {
      await enviar(texto);
      await db.query('UPDATE notificacoes SET enviada_em=now() WHERE id=$1', [n.id]);
    } catch {
      await db.query('UPDATE notificacoes SET falhou=true WHERE id=$1', [n.id]);
    }
  }
}

export function telegram(token: string, chat: string, requisicao: typeof fetch = fetch) {
  return async (texto: string) => {
    const resposta = await requisicao(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text: texto }), signal: AbortSignal.timeout(10000) });
    if (!resposta.ok) throw new Error('Falha no envio ao Telegram');
    const resultado: unknown = await resposta.json();
    if (!resultado || typeof resultado !== 'object' || !('ok' in resultado) || resultado.ok !== true) throw new Error('Falha no envio ao Telegram');
  };
}
