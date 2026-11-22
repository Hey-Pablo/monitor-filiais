/**
 * Tipos do contrato de batimento (espelha docs/contrato-batimento.schema.json)
 */
export interface ServicoStatus {
  nome: string;
  status: 'running' | 'stopped' | 'paused' | 'unknown';
}

export interface BatimentoPayload {
  filialId: string;
  timestamp: string; // ISO 8601 UTC
  cpu: number; // 0-100
  memoria: number; // 0-100
  discoLivrePercentual: number; // 0-100
  servicos: ServicoStatus[];
  latenciaMs?: number;
}

export interface FilialConfig {
  id: string;
  token: string;
  nome: string;
  // Configuração de falhas programadas
  falhas?: FalhaProgramada[];
}

export interface FalhaProgramada {
  tipo: 'cpu' | 'memoria' | 'disco' | 'servico' | 'offline';
  inicio: string; // ISO 8601 ou cron-like "HH:mm"
  fim?: string; // se não informado, persiste até o fim da simulação
  // Parâmetros específicos por tipo
  cpuValor?: number; // 0-100
  memoriaValor?: number; // 0-100
  discoValor?: number; // 0-100
  servicoNome?: string;
  servicoStatus?: 'stopped' | 'paused' | 'unknown';
}

export interface SimuladorConfig {
  apiBaseUrl: string;
  intervaloSegundos: number;
  filiais: FilialConfig[];
  servicosPadrao: string[];
  // Modo de execução
  duracaoMinutos?: number; // se não informado, roda indefinidamente
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}