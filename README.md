# Monitor de Filiais

> **Demonstração:** em breve

> **Status: em desenvolvimento.** API e painel estão implementados. Agente e simulador precisam de adaptação ao contrato da API atual; Docker e PostgreSQL precisam de testes no PC.

## API: primeira etapa

A API aceita batimentos autenticados, persiste os dados e abre ou fecha incidentes. O painel React mostra filiais, métricas e incidentes em tempo real.

Requisitos: Node.js 24 e PostgreSQL. Copie `.env.example` para `.env` e configure `DATABASE_URL`. Exporte essas variáveis no ambiente antes de iniciar: `npm install`, seguido de `npm start`. A inicialização cria as tabelas. Esta versão suporta **uma instância da API**, não execute múltiplas réplicas.

Para cadastrar uma filial, defina `FILIAL_ID`, `FILIAL_NOME` e `FILIAL_TOKEN` no ambiente e execute `npm run cadastrar`. Gere um token aleatório com pelo menos 32 caracteres e mantenha-o fora do repositório. O banco guarda somente seu hash. A rota `POST /filiais/{id}/batimentos` recebe `Authorization: Bearer <token>` e JSON com `cpu`, `memoria`, `disco` (percentuais de 0 a 100), `latencia` (ms) e `servicos` (objeto de nomes para booleanos). Um batimento válido retorna 202; token inválido retorna 401 e é registrado sem o token. Campos inválidos retornam 422. O servidor usa o horário de recebimento e verifica filiais a cada 15 segundos.

A rota `GET /filiais` lista filiais, último batimento e incidentes ativos; `GET /filiais/{id}` inclui até 100 incidentes recentes. `GET /eventos` fornece Server-Sent Events: o evento `atualizacao` indica que o cliente deve buscar os dados novamente. A conexão envia um evento inicial e é atualizada após batimentos aceitos e verificações periódicas. O fluxo é limitado a 100 conexões e usa apenas uma instância da API.

A rota `GET /filiais/{id}/disponibilidade?mes=AAAA-MM` retorna tempo observado, tempo indisponível e percentual. O mês usa UTC; o intervalo observado começa no cadastro ou início do mês, o que ocorrer depois, e termina no horário atual ou fim do mês. Apenas incidentes `offline` reduzem a disponibilidade. Sem período observado, o percentual é `null`. Os incidentes refletem o momento de detecção pelo servidor, sujeito ao intervalo de verificação.

A manutenção roda na inicialização e a cada hora: batimentos com mais de 30 dias são resumidos por hora UTC e removidos em uma transação, preservando o último batimento de cada filial. Registros de acesso inválido expiram após 30 dias; tentativas para filiais inexistentes compartilham no máximo um registro por hora.

Execute `npm test` para testes com banco PGlite e `npm run typecheck` para tipos. PostgreSQL real ainda precisa ser verificado localmente. Use HTTPS e restrinja acesso à API em uma implantação; esta etapa não implementa autenticação para consulta ou limitação distribuída de requisições.

## Configurar sua chave

O Telegram é opcional. Crie um bot com [BotFather](https://core.telegram.org/bots/features#botfather), obtenha seu token e o identificador do chat, e configure `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` no ambiente do servidor. Nunca inclua valores reais no repositório. Sem ambas as variáveis, os eventos ficam pendentes; fornecer apenas uma impede a inicialização.

Cada abertura e normalização cria um evento em `notificacoes` na mesma transação do incidente. O processador consulta a fila a cada 15 segundos; a mensagem de normalização inclui a duração. Para evitar duplicações em interrupções e timeouts ambíguos, registra a tentativa antes da chamada e não repete automaticamente. Portanto, uma falha ou queda depois da reserva pode deixar um alerta sem entrega. Consulte `tentada_em`, `enviada_em` e `falhou` na tabela e investigue esses casos antes de qualquer reenvio manual. A API permanece limitada a uma instância.

## Executar com Docker Compose

Instale Docker Engine e Compose. Copie `.env.example` para `.env` na raiz. Defina `POSTGRES_PASSWORD` como uma senha local forte composta por letras e números (a senha integra uma URL); mantenha `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` vazios para desativar o Telegram ou configure ambos. Não compartilhe `.env`. A senha só inicializa um volume novo; alterá-la depois exige atualizar o usuário do banco separadamente.

Na raiz, execute:

```sh
docker compose --env-file .env -f infra/docker-compose.yml up --build
```

Acesse `http://localhost:8080`. O painel e `/api` usam a mesma origem, com SSE sem buffering. O banco e a API ficam na rede interna; a porta do painel é vinculada a `127.0.0.1`. Para parar, use `docker compose --env-file .env -f infra/docker-compose.yml down`. O volume do PostgreSQL é preservado. A configuração é para uso local: não exponha a API sem autenticação e HTTPS. O Compose e o PostgreSQL real ainda precisam ser testados no PC.

## Painel

Com a API em execução na porta 3000, execute `npm run painel` e abra o endereço informado pelo Vite. O proxy de desenvolvimento encaminha `/api` à API sem CORS. A grade mostra estados por cor e texto; selecione uma filial para métricas, disponibilidade mensal e até 100 incidentes recentes. Se a conexão SSE cair, o navegador tenta reconectar e o painel informa o estado da conexão.

Para gerar arquivos estáticos, execute `npm run build:painel`. Em produção, publique `painel/dist` e encaminhe `/api` para a API na mesma origem, removendo o prefixo, com suporte a conexões SSE sem buffering. A API não autentica consultas: restrinja acesso à rede ou adicione uma camada de autenticação antes de expô-la. Execute `npm run typecheck:painel` para verificar tipos.

## O que é

Monitoramento de disponibilidade para uma rede de filiais. Um agente leve em cada máquina envia sinais de vida e métricas. A central detecta filial fora do ar, disco cheio ou serviço parado, abre incidente, alerta a equipe e mostra tudo em um painel em tempo real. Um simulador gera 50 filiais fictícias para a demonstração.

## O que prova

Visão de operação, coleta e ingestão de dados, regras de alerta sem ruído e painel em tempo real.

## Stack

Agente em PowerShell 5.1, reaproveitando o projeto 2. API em Node.js e TypeScript. PostgreSQL. Atualização em tempo real com Supabase Realtime ou Server-Sent Events. React. Telegram para alertas. Docker Compose.

## Estrutura

```
monitor-filiais/
├─ agente/             # coleta PowerShell e testes
├─ api/                # esquema, API e testes PGlite
├─ docs/               # contrato original do batimento
├─ infra/              # Compose, imagens e proxy
├─ painel/             # interface React
├─ simulador/          # gerador de filiais fictícias (adaptação pendente)
├─ .env.example
└─ README.md
```

## Plano

1. ✅ Contrato do batimento em JSON: filial, horário, CPU, memória, disco livre, serviços e latência.
2. ✅ Modelo: filiais, batimentos, incidentes e notificações.
3. Ingestão com token por filial e validação do corpo.
4. Agente PowerShell e instalação por tarefa agendada: integração com a API atual está pendente.
5. Simulador: gerador existe; integração com o contrato atual está pendente.
6. ✅ Regras: sem batimento por 3 minutos (fora do ar), disco livre abaixo de 10% e serviço monitorado parado. Cada regra abre e fecha incidente.
7. Notificação única na abertura e outra na normalização.
8. ✅ Painel em tempo real: grade com cores, detalhe da filial e linha do tempo de incidentes.
9. ✅ Disponibilidade mensal por filial e retenção de dados: resumo por hora e limpeza dos batimentos antigos.
10. Testes das regras, Docker Compose e publicação com o simulador ligado.

## Comportamento esperado

- Após três minutos sem batimento, a próxima verificação abre um incidente; a verificação ocorre a cada 15 segundos. O envio do alerta depende da configuração e disponibilidade do Telegram.
- Religar fecha o incidente e envia a mensagem de normalização com a duração.
- O painel atualiza sem recarregar e mostra a disponibilidade do mês.
- Token inválido é recusado e fica registrado.

## Autor

Pablo Dilio · [Portfólio](https://hey-pablo.github.io/pablo-dilio-portfolio/) · [LinkedIn](https://www.linkedin.com/in/pablo-dilio-4063991b2)
## O que o Pablo precisa testar no PC

- Após adaptação ao contrato atual, testar agente no Windows 10/11 com PowerShell 5.1: `Enviar-Batimento.ps1` real e `Instalar-Tarefa.ps1` (`Register-ScheduledTask`), com serviços reais.
- API contra PostgreSQL real (os testes usam PGlite).
- Simulador: a versão atual usa outro contrato e ainda precisa ser adaptada à API antes do teste integrado.
- Compose: build, inicialização, persistência após reinício, SSE, painel e integração com Telegram de teste.
