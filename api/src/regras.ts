export interface EstadoFilial {
  ultimo: Date;
  disco: number;
  servicos: Record<string, boolean>;
}

/** Retorna as condições ativas no instante informado pelo relógio da aplicação. */
export function avaliar(estado: EstadoFilial, agora: Date): string[] {
  const ativas: string[] = [];
  if (agora.getTime() - estado.ultimo.getTime() >= 180_000) ativas.push('offline');
  if (estado.disco < 10) ativas.push('disco');
  for (const [nome, ativo] of Object.entries(estado.servicos)) {
    if (!ativo) ativas.push(`servico:${nome}`);
  }
  return ativas;
}
