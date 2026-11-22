<#
.SYNOPSIS
Coleta métricas do sistema e envia batimento para a API central.
Compatível com PowerShell 5.1 (Windows 10/11) e PowerShell 7+.

.DESCRIPTION
Este script é executado periodicamente (a cada 60 segundos por padrão) pela tarefa agendada.
Lê a configuração de config.json, coleta CPU, memória, disco e status de serviços,
e envia o payload JSON para o endpoint de ingestão da API.

.PARAMETER ConfigPath
Caminho para o arquivo de configuração JSON. Padrão: config.json na mesma pasta do script.

.PARAMETER UmaVez
Executa uma única coleta e envio, sem loop. Útil para testes manuais.

.EXAMPLE
.\Enviar-Batimento.ps1
# Inicia o loop de batimento a cada 60s (usado pela tarefa agendada)

.EXAMPLE
.\Enviar-Batimento.ps1 -UmaVez
# Executa uma vez e sai (para teste)

.EXAMPLE
.\Enviar-Batimento.ps1 -ConfigPath "C:\MonitorFilial\config.json"
# Usa arquivo de configuração personalizado
#>
[CmdletBinding()]
param(
    [Parameter()]
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'config.json'),

    [switch]$UmaVez
)

# Carrega o módulo de funções puras
Import-Module (Join-Path $PSScriptRoot 'MonitorFilial.psm1') -Force -ErrorAction Stop

function Ler-Configuracao {
    [CmdletBinding()]
    param([string]$Path)
    if (-not (Test-Path -Path $Path)) {
        throw "Arquivo de configuração não encontrado: $Path. Copie config.exemplo.json para config.json e preencha."
    }
    $json = Get-Content -Path $Path -Raw -Encoding UTF8
    return $json | ConvertFrom-Json
}

function Enviar-Batimento {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$ApiBaseUrl,
        [Parameter(Mandatory)][string]$FilialId,
        [Parameter(Mandatory)][string]$Token,
        [Parameter(Mandatory)][double]$Cpu,
        [Parameter(Mandatory)][double]$Memoria,
        [Parameter(Mandatory)][double]$DiscoLivrePercentual,
        [Parameter(Mandatory)][object[]]$Servicos,
        [double]$LatenciaMs = 0,
        [int]$TimeoutSegundos = 10
    )

    $url = "$ApiBaseUrl/api/ingestao/batimento"
    $payload = ConverterParaJsonContrato -FilialId $FilialId -Cpu $Cpu -Memoria $Memoria -DiscoLivrePercentual $DiscoLivrePercentual -Servicos $Servicos -LatenciaMs $LatenciaMs

    $headers = @{
        'Content-Type'  = 'application/json'
        'Authorization' = "Bearer $Token"
    }

    try {
        $inicio = Get-Date
        Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $payload -TimeoutSec $TimeoutSegundos -ErrorAction Stop | Out-Null
        $fim = Get-Date
        $latencia = [math]::Round(($fim - $inicio).TotalMilliseconds)
        Write-Output "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Batimento enviado - Status: OK - Latência: ${latencia}ms"
        return $true
    } catch {
        $fim = Get-Date
        $latencia = [math]::Round(($fim - $inicio).TotalMilliseconds)
        $statusCode = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { 'SEM_RESPOSTA' }
        Write-Warning "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Falha ao enviar batimento - Status: $statusCode - Latência: ${latencia}ms - Erro: $($_.Exception.Message)"
        return $false
    }
}

function ColetarMetricas {
    [CmdletBinding()]
    param([string[]]$ServicosMonitorados)

    $cpu = Get-UsoCpu
    $memoria = Get-UsoMemoria
    $disco = Get-DiscoSistema
    $servicos = Get-StatusServico -Nomes $ServicosMonitorados

    return [pscustomobject]@{
        Cpu                  = $cpu
        Memoria              = $memoria
        DiscoLivrePercentual = $disco.PercentualLivre
        Servicos             = $servicos
    }
}

# --- Execução principal ---

try {
    $config = Ler-Configuracao -Path $ConfigPath
} catch {
    Write-Error $_
    exit 1
}

$apiBaseUrl            = $config.apiBaseUrl
$filialId              = $config.filialId
$token                 = $config.token
$intervaloSegundos     = if ($config.intervaloSegundos) { $config.intervaloSegundos } else { 60 }
$servicosMonitorados   = if ($config.servicosMonitorados) { $config.servicosMonitorados } else { @() }
$timeoutRequisicao     = if ($config.timeoutRequisicaoSegundos) { $config.timeoutRequisicaoSegundos } else { 10 }

if (-not $apiBaseUrl -or -not $filialId -or -not $token) {
    Write-Error "Configuração incompleta: apiBaseUrl, filialId e token são obrigatórios."
    exit 1
}

Write-Output "=== Agente Monitor Filial ==="
Write-Output "Filial: $filialId"
Write-Output "API: $apiBaseUrl"
Write-Output "Intervalo: ${intervaloSegundos}s"
Write-Output "Serviços monitorados: $($servicosMonitorados -join ', ')"
Write-Output ""

if ($UmaVez) {
    $metricas = ColetarMetricas -ServicosMonitorados $servicosMonitorados
    Enviar-Batimento -ApiBaseUrl $apiBaseUrl -FilialId $filialId -Token $token -Cpu $metricas.Cpu -Memoria $metricas.Memoria -DiscoLivrePercentual $metricas.DiscoLivrePercentual -Servicos $metricas.Servicos -TimeoutSegundos $timeoutRequisicao
    exit 0
}

# Loop principal
while ($true) {
    $inicioCiclo = Get-Date

    $metricas = ColetarMetricas -ServicosMonitorados $servicosMonitorados
    Enviar-Batimento -ApiBaseUrl $apiBaseUrl -FilialId $filialId -Token $token -Cpu $metricas.Cpu -Memoria $metricas.Memoria -DiscoLivrePercentual $metricas.DiscoLivrePercentual -Servicos $metricas.Servicos -TimeoutSegundos $timeoutRequisicao

    $fimCiclo = Get-Date
    $duracao = ($fimCiclo - $inicioCiclo).TotalSeconds
    $esperar = $intervaloSegundos - $duracao
    if ($esperar -gt 0) {
        Start-Sleep -Seconds [math]::Max(1, [math]::Floor($esperar))
    }
}