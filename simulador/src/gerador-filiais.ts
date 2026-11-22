import { createHmac } from 'node:crypto';
/**
 * Gera 50 filiais fictícias com configurações variadas e falhas programadas.
 */
import { FilialConfig, FalhaProgramada, SimuladorConfig } from './types';

const NOMES_CIDADES = [
  'sp', 'rj', 'bh', 'poa', 'cur', 'rec', 'for', 'sal', 'goi', 'bel',
  'man', 'fln', 'vix', 'cam', 'sao', 'gua', 'jpa', 'nat', 'the', 'slo',
  'cgr', 'cgb', 'mac', 'boa', 'rio', 'pal', 'ara', 'uba', 'lun', 'pet',
  'ang', 'vol', 'nit', 'bdu', 'mag', 'nov', 'cam', 'sjo', 'ita', 'sor',
  'rib', 'ind', 'jau', 'ara', 'pre', 'vot', 'cat', 'fra', 'bat', 'pia'
];

const SERVICOS_WINDOWS = [
  'spooler', 'wuauserv', 'w32time', 'eventlog', 'dhcp', 'dnscache',
  'wuauserv', 'bits', 'schedule', 'themes', 'audioendpointbuilder',
  'sysmain', 'wercplsupport', 'stisvc', 'wsearch', 'wuauserv'
];

function gerarIdFilial(indice: number): string {
  const cidade = NOMES_CIDADES[indice % NOMES_CIDADES.length];
  const num = String(indice + 1).padStart(2, '0');
  return `filial-${cidade}-${num}`;
}

export function gerarToken(filialId: string, seed: string): string {
  if (seed.length < 32) throw new Error('SIMULADOR_SEED deve ter pelo menos 32 caracteres');
  return createHmac('sha256', seed).update(filialId).digest('hex');
}

function gerarFalhasAleatorias(filialId: string): FalhaProgramada[] {
  const falhas: FalhaProgramada[] = [];
  const agora = new Date();
  const baseMinutos = Math.floor(Math.random() * 60); // primeira falha entre 0-60 min

  // Cada filial tem 1-3 falhas programadas
  const numFalhas = Math.floor(Math.random() * 3) + 1;

  for (let i = 0; i < numFalhas; i++) {
    const tipoFalha = ['cpu', 'memoria', 'disco', 'servico', 'offline'][Math.floor(Math.random() * 5)];
    const inicioMin = baseMinutos + i * 20 + Math.floor(Math.random() * 10); // espaçadas ~20 min
    const duracao = Math.floor(Math.random() * 15) + 5; // 5-20 min

    const inicio = new Date(agora.getTime() + inicioMin * 60000).toISOString();
    const fim = new Date(agora.getTime() + (inicioMin + duracao) * 60000).toISOString();

    const falha: FalhaProgramada = {
      tipo: tipoFalha as FalhaProgramada['tipo'],
      inicio,
      fim
    };

    switch (tipoFalha) {
      case 'cpu':
        falha.cpuValor = Math.floor(Math.random() * 16) + 85; // 85-100%
        break;
      case 'memoria':
        falha.memoriaValor = Math.floor(Math.random() * 16) + 85; // 85-100%
        break;
      case 'disco':
        falha.discoValor = Math.floor(Math.random() * 8) + 2; // 2-10% livre
        break;
      case 'servico':
        falha.servicoNome = SERVICOS_WINDOWS[Math.floor(Math.random() * SERVICOS_WINDOWS.length)];
        falha.servicoStatus = ['stopped', 'paused', 'unknown'][Math.floor(Math.random() * 3)] as 'stopped' | 'paused' | 'unknown';
        break;
      case 'offline':
        // offline não precisa de parâmetros extras - o simulador para de enviar
        break;
    }

    falhas.push(falha);
  }

  return falhas;
}

function gerarMetricasBase(): { cpu: number; memoria: number; discoLivre: number } {
  return {
    cpu: Math.round((Math.random() * 30 + 5) * 10) / 10, // 5-35%
    memoria: Math.round((Math.random() * 40 + 30) * 10) / 10, // 30-70%
    discoLivre: Math.round((Math.random() * 40 + 40) * 10) / 10 // 40-80%
  };
}

export function gerarConfigSimulador(seed = process.env.SIMULADOR_SEED || ''): SimuladorConfig {
  const filiais: FilialConfig[] = [];

  for (let i = 0; i < 50; i++) {
    const id = gerarIdFilial(i);
    const metricasBase = gerarMetricasBase();
    const numServicos = Math.floor(Math.random() * 4) + 4; // 4-7 serviços
    const servicos = SERVICOS_WINDOWS.slice(0, numServicos);

    filiais.push({
      id,
      token: gerarToken(id, seed),
      nome: `Filial ${id.split('-')[1].toUpperCase()} ${id.split('-')[2]}`,
      falhas: gerarFalhasAleatorias(id)
    });
  }

  return {
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    intervaloSegundos: parseInt(process.env.INTERVALO_SEGUNDOS || '60', 10),
    filiais,
    servicosPadrao: SERVICOS_WINDOWS.slice(0, 6),
    duracaoMinutos: process.env.DURACAO_MINUTOS ? parseInt(process.env.DURACAO_MINUTOS, 10) : undefined,
    logLevel: (process.env.LOG_LEVEL as any) || 'info'
  };
}

export function obterMetricasFilial(
  filial: FilialConfig,
  servicosPadrao: string[],
  tempoDecorridoMs: number
): { cpu: number; memoria: number; discoLivre: number; servicos: Array<{nome: string; status: string}>; offline: boolean } {
  const metricasBase = gerarMetricasBase();
  let cpu = metricasBase.cpu;
  let memoria = metricasBase.memoria;
  let discoLivre = metricasBase.discoLivre;
  let offline = false;

  const servicos = servicosPadrao.map(nome => ({ nome, status: 'running' as 'running' | 'stopped' | 'paused' | 'unknown' }));

  // Verifica falhas programadas ativas
  if (filial.falhas) {
    const agora = Date.now();
    for (const falha of filial.falhas) {
      const inicio = new Date(falha.inicio).getTime();
      const fim = falha.fim ? new Date(falha.fim).getTime() : Infinity;

      if (agora >= inicio && agora <= fim) {
        switch (falha.tipo) {
          case 'cpu':
            cpu = falha.cpuValor ?? 95;
            break;
          case 'memoria':
            memoria = falha.memoriaValor ?? 95;
            break;
          case 'disco':
            discoLivre = falha.discoValor ?? 5;
            break;
          case 'servico':
            if (falha.servicoNome) {
              const svc = servicos.find(s => s.nome === falha.servicoNome);
              if (svc) svc.status = falha.servicoStatus ?? 'stopped';
            }
            break;
          case 'offline':
            offline = true;
            break;
        }
      }
    }
  }

  return { cpu, memoria, discoLivre, servicos: servicos as Array<{nome: string; status: 'running' | 'stopped' | 'paused' | 'unknown'}>, offline };
}