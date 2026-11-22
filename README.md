# Monitor de Filiais

> **Demonstração:** em breve

> **Status: em desenvolvimento.** Prontos: agente PowerShell, simulador de 50 filiais e primeira etapa da API (ingestão e incidentes). Faltam: notificações no Telegram, disponibilidade mensal, retenção e painel em tempo real.

## API: primeira etapa

A API aceita batimentos autenticados, persiste os dados e abre ou fecha incidentes. A interface e a disponibilidade mensal ainda estão em desenvolvimento.

Requisitos: Node.js 24 e PostgreSQL. Copie `.env.example` para `.env` e configure `DATABASE_URL`. Exporte essas variáveis no ambiente antes de iniciar: `npm install`, seguido de `npm start`. A inicialização cria as tabelas. Esta versão suporta **uma instância da API**, não execute múltiplas réplicas.

Para cadastrar uma filial, defina `FILIAL_ID`, `FILIAL_NOME` e `FILIAL_TOKEN` no ambiente e execute `npm run cadastrar`. Gere um token aleatório com pelo menos 32 caracteres e mantenha-o fora do repositório. O banco guarda somente seu hash. A rota `POST /filiais/{id}/batimentos` recebe `Authorization: Bearer <token>` e JSON com `cpu`, `memoria`, `disco` (percentuais de 0 a 100), `latencia` (ms) e `servicos` (objeto de nomes para booleanos). Um batimento válido retorna 202; token inválido retorna 401 e é registrado sem o token. Campos inválidos retornam 422. O servidor usa o horário de recebimento e verifica filiais a cada 15 segundos.

A manutenção roda na inicialização e a cada hora: batimentos com mais de 30 dias são resumidos por hora UTC e removidos em uma transação, preservando o último batimento de cada filial. Registros de acesso inválido expiram após 30 dias; tentativas para filiais inexistentes compartilham no máximo um registro por hora.

Execute `npm test` para testes com banco PGlite e `npm run typecheck` para tipos. PostgreSQL real ainda precisa ser verificado localmente. Use HTTPS e restrinja acesso à API em uma implantação; esta etapa não implementa autenticação para consulta ou limitação distribuída de requisições.

## Configurar sua chave

O Telegram é opcional. Crie um bot com [BotFather](https://core.telegram.org/bots/features#botfather), obtenha seu token e o identificador do chat, e configure `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` no ambiente do servidor. Nunca inclua valores reais no repositório. Sem ambas as variáveis, os eventos ficam pendentes; fornecer apenas uma impede a inicialização.

Cada abertura e normalização cria um evento em `notificacoes` na mesma transação do incidente. O processador consulta a fila a cada 15 segundos; a mensagem de normalização inclui a duração. Para evitar duplicações em interrupções e timeouts ambíguos, registra a tentativa antes da chamada e não repete automaticamente. Portanto, uma falha ou queda depois da reserva pode deixar um alerta sem entrega. Consulte `tentada_em`, `enviada_em` e `falhou` na tabela e investigue esses casos antes de qualquer reenvio manual. A API permanece limitada a uma instância.

## O que é

Monitoramento de disponibilidade para uma rede de filiais. Um agente leve em cada máquina envia sinais de vida e métricas. A central detecta filial fora do ar, disco cheio ou serviço parado, abre incidente, alerta a equipe e mostra tudo em um painel em tempo real. Um simulador gera 50 filiais fictícias para a demonstração.

## O que prova

Visão de operação, coleta e ingestão de dados, regras de alerta sem ruído e painel em tempo real.

## Stack

Agente em PowerShell 5.1, reaproveitando o projeto 2. API em Node.js e TypeScript. PostgreSQL. Atualização em tempo real com Supabase Realtime ou Server-Sent Events. React. Telegram para alertas. Docker Compose.

## Estrutura

```
monitor-filiais/
├─ agente/
│  ├─ Enviar-Batimento.ps1      # coleta e envia a cada 60 s
│  ├─ Instalar-Tarefa.ps1       # cria a tarefa agendada
│  ├─ MonitorFilial.psm1        # módulo com funções puras
│  ├─ tests/
│  │  └─ MonitorFilial.Tests.ps1
│  ├─ PSScriptAnalyzerSettings.psd1
│  └─ config.exemplo.json
├─ docs/
│  ├─ contrato-batimento.md
│  └─ contrato-batimento.schema.json
├─ api/src/
│  ├─ ingestao/                 # recebe batimentos com token da filial
│  ├─ regras/                   # avalia e abre ou fecha incidentes
│  ├─ notificacoes/             # Telegram, sem repetição
│  └─ consultas/                # status atual, histórico, disponibilidade
├─ painel/                      # grade de filiais, detalhe, incidentes
├─ simulador/                   # 50 filiais com falhas programadas
├─ infra/docker-compose.yml
└─ README.md
```

## Plano

1. ✅ Contrato do batimento em JSON: filial, horário, CPU, memória, disco livre, serviços e latência.
2. Modelo: filiais, batimentos, incidentes e notificações.
3. Ingestão com token por filial e validação do corpo.
4. ✅ Agente PowerShell e instalação por tarefa agendada.
5. ✅ Simulador, para testar sem 50 máquinas.
6. Regras: sem batimento por 3 minutos (fora do ar), disco livre abaixo de 10% e serviço monitorado parado. Cada regra abre e fecha incidente.
7. Notificação única na abertura e outra na normalização.
8. Painel em tempo real: grade com cores, detalhe da filial e linha do tempo de incidentes.
9. Disponibilidade mensal por filial e retenção de dados: resumo por hora e limpeza dos batimentos antigos.
10. Testes das regras, Docker Compose e publicação com o simulador ligado.

## Como deve funcionar

- Parar um agente deixa a filial vermelha em até 3 minutos, abre incidente e envia um único alerta.
- Religar fecha o incidente e envia a mensagem de normalização com a duração.
- O painel atualiza sem recarregar e mostra a disponibilidade do mês.
- Token inválido é recusado e fica registrado.

## Prazo

4 a 5 semanas.

> **Demonstração:** em breve

## Autor

Pablo Dilio · [Portfólio](https://hey-pablo.github.io/pablo-dilio-portfolio/) · [LinkedIn](https://www.linkedin.com/in/pablo-dilio-4063991b2)
## O que o Pablo precisa testar no PC

- Agente no Windows 10/11 com PowerShell 5.1: `Enviar-Batimento.ps1` real e `Instalar-Tarefa.ps1` (`Register-ScheduledTask`), com serviços reais.
- API contra PostgreSQL real (os testes usam PGlite).
- Simulador apontando para a API em execução.
