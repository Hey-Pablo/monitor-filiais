<#
.SYNOPSIS
Cria a tarefa agendada do Windows para executar o agente de batimento a cada 60 segundos.
Requer PowerShell como Administrador.

.DESCRIPTION
Registra uma tarefa agendada (Scheduled Task) que executa Enviar-Batimento.ps1
em loop a cada 60 segundos. A tarefa roda com a conta SYSTEM para persistir
mesmo sem usuário logado.

.PARAMETER ScriptPath
Caminho completo para o Enviar-Batimento.ps1. Padrão: mesmo diretório deste script.

.PARAMETER TaskName
Nome da tarefa agendada. Padrão: "MonitorFilial-Batimento".

.PARAMETER Descricao
Descrição da tarefa.

.PARAMETER Remover
Remove a tarefa agendada em vez de criar/atualizar.

.EXAMPLE
.\Instalar-Tarefa.ps1
# Cria/atualiza a tarefa com padrões

.EXAMPLE
.\Instalar-Tarefa.ps1 -ScriptPath "C:\MonitorFilial\Enviar-Batimento.ps1" -TaskName "MinhaTarefa"
# Caminho e nome personalizados

.EXAMPLE
.\Instalar-Tarefa.ps1 -Remover
# Remove a tarefa agendada
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
    [Parameter()]
    [string]$ScriptPath = (Join-Path $PSScriptRoot 'Enviar-Batimento.ps1'),

    [Parameter()]
    [string]$TaskName = 'MonitorFilial-Batimento',

    [Parameter()]
    [string]$Descricao = 'Agente de monitoramento de filial - envia batimento a cada 60s',

    [switch]$Remover
)

# Verifica se está rodando como administrador
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Este script precisa rodar como Administrador. Abra o PowerShell como Administrador e tente novamente."
    exit 1
}

# Valida se o script do agente existe
if (-not (Test-Path -Path $ScriptPath)) {
    Write-Error "Script do agente não encontrado: $ScriptPath"
    exit 1
}

$scriptDir = Split-Path -Parent $ScriptPath
$configPath = Join-Path $scriptDir 'config.json'
if (-not (Test-Path -Path $configPath)) {
    Write-Warning "Arquivo config.json não encontrado em $configPath. Copie config.exemplo.json para config.json e configure antes de iniciar a tarefa."
}

if ($Remover) {
    if ($PSCmdlet.ShouldProcess($TaskName, 'Remover tarefa agendada')) {
        try {
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
            Write-Output "Tarefa '$TaskName' removida com sucesso."
        } catch {
            Write-Error "Falha ao remover tarefa: $_"
            exit 1
        }
    }
    exit 0
}

# Define a ação da tarefa: PowerShell -NoProfile -ExecutionPolicy Bypass -File <script>
$action = New-ScheduledTaskAction -Execute 'PowerShell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""

# Trigger: ao iniciar o sistema, repetir a cada 60 segundos indefinidamente
$trigger = New-ScheduledTaskTrigger -AtStartup -RandomDelay 00:01:00
$trigger.RepetitionInterval = '00:01:00'  # 60 segundos
$trigger.RepetitionDuration = ([TimeSpan]::MaxValue)  # Indefinido

# Configurações da tarefa
$settings = New-ScheduledTaskSettingsSet -Compatibility Win8 -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -Hidden -RunOnlyIfNetworkAvailable

# Principal: SYSTEM (roda sem usuário logado)
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

# Registra/atualiza a tarefa
if ($PSCmdlet.ShouldProcess($TaskName, 'Registrar tarefa agendada')) {
    try {
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description $Descricao -Force -ErrorAction Stop
        Write-Output "Tarefa '$TaskName' registrada/atualizada com sucesso."
        Write-Output "A tarefa será executada a cada 60 segundos usando a conta SYSTEM."
        Write-Output ""
        Write-Output "Para verificar: Get-ScheduledTask -TaskName '$TaskName'"
        Write-Output "Para ver histórico: Get-ScheduledTaskInfo -TaskName '$TaskName'"
        Write-Output "Para remover: .\Instalar-Tarefa.ps1 -Remover"
    } catch {
        Write-Error "Falha ao registrar tarefa: $_"
        exit 1
    }
}