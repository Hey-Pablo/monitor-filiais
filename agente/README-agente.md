# Agente PowerShell - Monitor de Filiais

> **Status: implementado.** Agente para coleta de métricas e envio de batimentos.

## O que é

O agente coleta métricas do sistema (CPU, memória, disco, serviços) a cada 60 segundos e envia um batimento para a API central.

## Arquivos

```
agente/
├─ Enviar-Batimento.ps1   # Script principal - coleta e envia JSON a cada 60s
├─ Instalar-Tarefa.ps1    # Cria a tarefa agendada do Windows
├─ MonitorFilial.psm1     # Módulo com funções puras de coleta
├─ tests/
│  └─ MonitorFilial.Tests.ps1  # Testes Pester (22 testes)
├─ PSScriptAnalyzerSettings.psd1
└─ config.exemplo.json    # Modelo de configuração
```

## Uso

### 1. Configurar

```powershell
# Copiar e editar configuração
Copy-Item config.exemplo.json config.json
# Editar config.json com os valores da filial
```

### 2. Instalar a tarefa agendada (como Administrador)

```powershell
.\Instalar-Tarefa.ps1
```

Isso cria a tarefa "MonitorFilial-Batimento" que roda a cada 60 segundos.

### 3. Executar manualmente (para teste)

```powershell
.\Enviar-Batimento.ps1 -UmaVez
```

## Testes

```powershell
# Executar todos os testes
Invoke-Pester -Path ./tests/MonitorFilial.Tests.ps1 -Output Detailed

# Verificar qualidade do código
Invoke-ScriptAnalyzer -Path ./ -Recurse
```

## Funções do módulo

- `ConvertTo-TamanhoLegivel` - Converte bytes para KB/MB/GB/etc.
- `Get-PercentualLivre` - Calcula percentual de espaço livre
- `Get-ClassificacaoDisco` - Classifica disco (CRITICO/ALERTA/OK)
- `Get-UsoCpu` - Obtém uso de CPU (Win32_Processor)
- `Get-UsoMemoria` - Obtém uso de memória (Win32_OperatingSystem)
- `Get-DiscoSistema` - Informações do disco do sistema
- `Get-StatusServicos` - Status de serviços Windows
- `ColetarMetricas` - Coleta todas as métricas
- `ConverterParaJsonContrato` - Gera JSON no formato do contrato
- `Enviar-Batimento` - Envia para a API

## Dependências

- PowerShell 5.1+ (Windows 10/11)
- Módulo Pester 5+ para testes (instalado via PowerShellGet na VPS)

## Compatibilidade

- Compatível com PowerShell 5.1 (Windows nativo)
- Também funciona no PowerShell 7+ em Linux (para testes de unidade)
- Em Linux, as funções de coleta retornam 0/50.0/68.75 por mocks nos testes