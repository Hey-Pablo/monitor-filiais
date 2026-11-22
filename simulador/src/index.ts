/**
 * Simulador de 50 filiais para o Monitor de Filiais.
 * Gera batimentos fictícios com falhas programadas e envia para a API.
 */
import { SimuladorConfig, BatimentoPayload } from './types';
import { gerarConfigSimulador, obterMetricasFilial } from './gerador-filiais';

class Logger {
  private level: 'debug' | 'info' | 'warn' | 'error' = 'info';
  private levels = { debug: 0, info: 1, warn: 2, error: 3 };

  setLevel(level: 'debug' | 'info' | 'warn' | 'error') {
    this.level = level;
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]) {
    if (this.levels[level] >= this.levels[this.level]) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
      console.log(prefix, message, ...args);
    }
  }

  debug(message: string, ...args: any[]) { this.log('debug', message, ...args); }
  info(message: string, ...args: any[]) { this.log('info', message, ...args); }
  warn(message: string, ...args: any[]) { this.log('warn', message, ...args); }
  error(message: string, ...args: any[]) { this.log('error', message, ...args); }
}

const logger = new Logger();

export async function enviarBatimento(apiBaseUrl: string, filialId: string, token: string, payload: BatimentoPayload): Promise<boolean> {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(filialId)) throw new Error('Identificador inválido');
  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/filiais/${filialId}/batimentos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) logger.warn(`[${filialId}] Falha ao enviar batimento - Status: ${response.status}`);
    return response.ok;
  } catch {
    logger.warn(`[${filialId}] Falha ao enviar batimento - sem resposta`);
    return false;
  }
}

async function executarCiclo(config: SimuladorConfig, tempoDecorridoMs: number): Promise<void> {
  const promessas = config.filiais.map(async (filial) => {
    const { cpu, memoria, discoLivre, servicos, offline } = obterMetricasFilial(
      filial,
      config.servicosPadrao,
      tempoDecorridoMs
    );

    if (offline) {
      logger.info(`[${filial.id}] FILIAL OFFLINE (falha programada) - pulando envio`);
      return;
    }

    const payload: BatimentoPayload = {
      cpu, memoria, disco: discoLivre,
      servicos: Object.fromEntries(servicos.map(s => [s.nome, s.status === 'running'])),
      latencia: 0
    };

    await enviarBatimento(config.apiBaseUrl, filial.id, filial.token, payload);
  });

  await Promise.all(promessas);
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           SIMULADOR MONITOR DE FILIAIS - 50 FILIAIS          ║
╚══════════════════════════════════════════════════════════════╝
  `);

  const config = gerarConfigSimulador();
  logger.setLevel(config.logLevel);

  logger.info(`API Base URL: ${config.apiBaseUrl}`);
  logger.info(`Intervalo: ${config.intervaloSegundos}s`);
  logger.info(`Filiais: ${config.filiais.length}`);
  logger.info(`Serviços padrão: ${config.servicosPadrao.join(', ')}`);
  if (config.duracaoMinutos) {
    logger.info(`Duração: ${config.duracaoMinutos} minutos`);
  } else {
    logger.info(`Duração: indefinida (Ctrl+C para parar)`);
  }
  logger.info('');

  // Contagem de falhas programadas
  let totalFalhas = 0;
  for (const filial of config.filiais) {
    if (filial.falhas) totalFalhas += filial.falhas.length;
  }
  logger.info(`Falhas programadas no total: ${totalFalhas}`);

  const inicioSimulacao = Date.now();
  let ciclo = 0;

  const executarLoop = async () => {
    while (true) {
      // Verifica duração máxima
      if (config.duracaoMinutos) {
        const decorridoMin = (Date.now() - inicioSimulacao) / 60000;
        if (decorridoMin >= config.duracaoMinutos) {
          logger.info(`Duração de ${config.duracaoMinutos} minutos atingida. Encerrando.`);
          break;
        }
      }

      ciclo++;
      const tempoDecorridoMs = Date.now() - inicioSimulacao;
      logger.info(`--- Ciclo ${ciclo} (${Math.round(tempoDecorridoMs / 1000)}s decorridos) ---`);

      await executarCiclo(config, tempoDecorridoMs);

      // Aguarda próximo ciclo
      await new Promise(resolve => setTimeout(resolve, config.intervaloSegundos * 1000));
    }
  };

  // Trata sinais de encerramento
  process.on('SIGINT', () => {
    logger.info('\nRecebido SIGINT. Encerrando simulador...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('\nRecebido SIGTERM. Encerrando simulador...');
    process.exit(0);
  });

  try {
    await executarLoop();
  } catch (error) {
    logger.error('Erro fatal no simulador:', error);
    process.exit(1);
  }

  logger.info('Simulador finalizado.');
}

if (require.main === module) main().catch(() => { console.error('Falha ao iniciar simulador'); process.exitCode = 1; });