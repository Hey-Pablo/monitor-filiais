# Monitor de Filiais

> **Status: em desenvolvimento.** O código entra aos poucos; abaixo está o planejamento do projeto.

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
│  └─ config.exemplo.json
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

1. Contrato do batimento em JSON: filial, horário, CPU, memória, disco livre, serviços e latência.
2. Modelo: filiais, batimentos, incidentes e notificações.
3. Ingestão com token por filial e validação do corpo.
4. Agente PowerShell e instalação por tarefa agendada.
5. Simulador, para testar sem 50 máquinas.
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

## Autor

Pablo Dilio · [Portfólio](https://hey-pablo.github.io/pablo-dilio-portfolio/) · [LinkedIn](https://www.linkedin.com/in/pablo-dilio-4063991b2)
