export function estadoFilial(filial: { recebido_em: string | null; ativos: string[] }) {
  if (filial.ativos.includes('offline')) return 'offline';
  if (!filial.recebido_em) return 'aguardando';
  if (filial.ativos.length) return 'alerta';
  return 'normal';
}
