# MonitorFilial.psm1
# Módulo com funções puras para o agente de monitoramento de filiais.
# Reutiliza lógica do kit-suporte-powershell (Get-PercentualLivre, Get-ClassificacaoDisco, ConvertTo-TamanhoLegivel).
# Compatível com PowerShell 5.1 e 7+.

function ConvertTo-TamanhoLegivel {
    <#
    .SYNOPSIS
    Converte bytes em representação legível (KB, MB, GB, etc.).
    .PARAMETER Bytes
    Quantidade em bytes (>= 0).
    .EXAMPLE
    ConvertTo-TamanhoLegivel 1536000
    # Resultado: "1,5 MB"
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory, Position=0)]
        [ValidateRange(0, [double]::MaxValue)]
        [double]$Bytes
    )
    $unidades = @('B', 'KB', 'MB', 'GB', 'TB', 'PB')
    $indice = 0
    while ($Bytes -ge 1024 -and $indice -lt $unidades.Count - 1) {
        $Bytes /= 1024
        $indice++
    }
    '{0} {1}' -f $Bytes.ToString('0.##', [System.Globalization.CultureInfo]::InvariantCulture).Replace('.', ','), $unidades[$indice]
}

function Get-PercentualLivre {
    <#
    .SYNOPSIS
    Calcula o percentual de espaço livre.
    .PARAMETER Livre
    Espaço livre em bytes.
    .PARAMETER Total
    Capacidade total em bytes.
    .EXAMPLE
    Get-PercentualLivre -Livre 50GB -Total 100GB
    # Resultado: 50.0
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][double]$Livre,
        [Parameter(Mandatory)][double]$Total
    )
    if ($Total -le 0 -or $Livre -lt 0 -or $Livre -gt $Total) {
        throw 'Capacidade ou espaço livre inválido.'
    }
    [math]::Round(100 * $Livre / $Total, 2)
}

function Get-ClassificacaoDisco {
    <#
    .SYNOPSIS
    Classifica o status do disco baseado no percentual livre.
    .PARAMETER PercentualLivre
    Percentual de espaço livre (0-100).
    .PARAMETER Critico
    Limite para classificação CRÍTICO (padrão 10).
    .PARAMETER Alerta
    Limite para classificação ALERTA (padrão 20).
    .EXAMPLE
    Get-ClassificacaoDisco -PercentualLivre 5 -Critico 10 -Alerta 20
    # Resultado: CRITICO
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory, Position=0)]
        [ValidateRange(0,100)]
        [double]$PercentualLivre,
        [ValidateRange(0,100)][double]$Critico = 10,
        [ValidateRange(0,100)][double]$Alerta = 20
    )
    if ($Critico -gt $Alerta) {
        throw 'O limite crítico não pode superar o limite de alerta.'
    }
    if ($PercentualLivre -le $Critico) { 'CRITICO' }
    elseif ($PercentualLivre -le $Alerta) { 'ALERTA' }
    else { 'OK' }
}

function Get-UsoCpu {
    <#
    .SYNOPSIS
    Obtém o percentual de uso de CPU atual (amostra de 1 segundo).
    Compatível com PowerShell 5.1 (usa Get-CimInstance Win32_Processor).
    .EXAMPLE
    Get-UsoCpu
    # Resultado: 12.5
    #>
    [CmdletBinding()]
    param()
    try {
        $cpu = Get-CimInstance Win32_Processor -ErrorAction Stop | Measure-Object -Property LoadPercentage -Average
        if ($cpu.Count -gt 0 -and $null -ne $cpu.Average) {
            return [math]::Round($cpu.Average, 1)
        }
        return 0.0
    } catch {
        Write-Warning "Falha ao obter uso de CPU: $_"
        return 0.0
    }
}

function Get-UsoMemoria {
    <#
    .SYNOPSIS
    Obtém o percentual de uso de memória RAM.
    Compatível com PowerShell 5.1 (usa Get-CimInstance Win32_OperatingSystem).
    .EXAMPLE
    Get-UsoMemoria
    # Resultado: 45.2
    #>
    [CmdletBinding()]
    param()
    try {
        $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
        if ($null -ne $os -and $os.TotalVisibleMemorySize -gt 0) {
            $livre = $os.FreePhysicalMemory * 1024 # KB para bytes
            $total = $os.TotalVisibleMemorySize * 1024
            $usado = $total - $livre
            return [math]::Round(100 * $usado / $total, 1)
        }
        return 0.0
    } catch {
        Write-Warning "Falha ao obter uso de memória: $_"
        return 0.0
    }
}

function Get-DiscoSistema {
    <#
    .SYNOPSIS
    Obtém informações do disco do sistema (onde está o Windows).
    Retorna objeto com Total, Livre e PercentualLivre em bytes.
    .EXAMPLE
    Get-DiscoSistema
    # Resultado: @{ Total = 256000000000; Livre = 176000000000; PercentualLivre = 68.75 }
    #>
    [CmdletBinding()]
    param()
    try {
        $systemDrive = $env:SystemDrive + '\'
        $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID = '$($env:SystemDrive)'" -ErrorAction Stop
        if ($null -ne $disk -and $disk.Size -gt 0 -and $null -ne $disk.FreeSpace) {
            $percentual = Get-PercentualLivre -Livre $disk.FreeSpace -Total $disk.Size
            return [pscustomobject]@{
                Total           = $disk.Size
                Livre           = $disk.FreeSpace
                PercentualLivre = $percentual
            }
        }
        return [pscustomobject]@{ Total = 0; Livre = 0; PercentualLivre = 0 }
    } catch {
        Write-Warning "Falha ao obter disco do sistema: $_"
        return [pscustomobject]@{ Total = 0; Livre = 0; PercentualLivre = 0 }
    }
}

function Get-StatusServicos {
    <#
    .SYNOPSIS
    Obtém o status de uma lista de serviços.
    Compatível com PowerShell 5.1 (usa Get-Service).
    .PARAMETER Nomes
    Array com os nomes dos serviços a verificar.
    .EXAMPLE
    Get-StatusServicos -Nomes @('spooler', 'wuauserv')
    # Resultado: @(@{ nome='spooler'; status='running' }, @{ nome='wuauserv'; status='stopped' })
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string[]]$Nomes
    )
    $resultado = @()
    foreach ($nome in $Nomes) {
        try {
            $svc = Get-Service -Name $nome -ErrorAction Stop
            $status = switch ($svc.Status) {
                'Running'   { 'running' }
                'Stopped'   { 'stopped' }
                'Paused'    { 'paused' }
                default     { 'unknown' }
            }
            $resultado += [pscustomobject]@{ nome = $nome; status = $status }
        } catch {
            $resultado += [pscustomobject]@{ nome = $nome; status = 'unknown' }
        }
    }
    return $resultado
}

function ConverterParaJsonContrato {
    <#
    .SYNOPSIS
    Converte os dados coletados para o JSON do contrato de batimento.
    .PARAMETER FilialId
    Identificador da filial.
    .PARAMETER Cpu
    Percentual de CPU.
    .PARAMETER Memoria
    Percentual de memória.
    .PARAMETER DiscoLivrePercentual
    Percentual de disco livre.
    .PARAMETER Servicos
    Array de objetos com nome e status dos serviços.
    .PARAMETER LatenciaMs
    Latência opcional em ms.
    .EXAMPLE
    ConverterParaJsonContrato -FilialId 'filial-01' -Cpu 12.5 -Memoria 45.2 -DiscoLivrePercentual 68.7 -Servicos @(@{nome='spooler';status='running'})
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$FilialId,
        [Parameter(Mandatory)][double]$Cpu,
        [Parameter(Mandatory)][double]$Memoria,
        [Parameter(Mandatory)][double]$DiscoLivrePercentual,
        [Parameter(Mandatory)][object[]]$Servicos,
        [double]$LatenciaMs = 0
    )
    $payload = [ordered]@{
        filialId             = $FilialId
        timestamp            = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
        cpu                  = [math]::Round($Cpu, 1)
        memoria              = [math]::Round($Memoria, 1)
        discoLivrePercentual = [math]::Round($DiscoLivrePercentual, 1)
        servicos             = $Servicos
    }
    if ($LatenciaMs -gt 0) {
        $payload.latenciaMs = [math]::Round($LatenciaMs)
    }
    return $payload | ConvertTo-Json -Depth 5 -Compress
}

Export-ModuleMember -Function `
    ConvertTo-TamanhoLegivel, `
    Get-PercentualLivre, `
    Get-ClassificacaoDisco, `
    Get-UsoCpu, `
    Get-UsoMemoria, `
    Get-DiscoSistema, `
    Get-StatusServicos, `
    ConverterParaJsonContrato