<#
.SYNOPSIS
Testes Pester para o módulo MonitorFilial.psm1.
Testa as funções puras (sem dependência do Windows) e valida a lógica de coleta.
#>

Describe 'MonitorFilial - Funções puras' {
    BeforeAll {
        $scriptRoot = $PSScriptRoot
        $moduloPath = Join-Path $scriptRoot '..\MonitorFilial.psm1'
        Import-Module $moduloPath -Force -ErrorAction Stop
    }

    Context 'ConvertTo-TamanhoLegivel' {
        It 'Converte bytes para B' {
            ConvertTo-TamanhoLegivel -Bytes 500 | Should -Be '500 B'
        }
        It 'Converte bytes para KB' {
            ConvertTo-TamanhoLegivel -Bytes 1536 | Should -Be '1,5 KB'
        }
        It 'Converte bytes para MB' {
            ConvertTo-TamanhoLegivel -Bytes 1572864 | Should -Be '1,5 MB'
        }
        It 'Converte bytes para GB' {
            ConvertTo-TamanhoLegivel -Bytes 1610612736 | Should -Be '1,5 GB'
        }
        It 'Converte bytes para TB' {
            ConvertTo-TamanhoLegivel -Bytes 1649267441664 | Should -Be '1,5 TB'
        }
        It 'Lança erro para valor negativo' {
            { ConvertTo-TamanhoLegivel -Bytes -1 } | Should -Throw
        }
    }

    Context 'Get-PercentualLivre' {
        It 'Calcula 50% quando livre é metade do total' {
            Get-PercentualLivre -Livre 50GB -Total 100GB | Should -Be 50.0
        }
        It 'Calcula 100% quando livre igual ao total' {
            Get-PercentualLivre -Livre 100GB -Total 100GB | Should -Be 100.0
        }
        It 'Calcula 0% quando livre é zero' {
            Get-PercentualLivre -Livre 0 -Total 100GB | Should -Be 0.0
        }
        It 'Arredonda para 2 casas decimais' {
            Get-PercentualLivre -Livre 33GB -Total 100GB | Should -Be 33.0
            Get-PercentualLivre -Livre 33.333GB -Total 100GB | Should -Be 33.33
        }
        It 'Lança erro para total <= 0' {
            { Get-PercentualLivre -Livre 50 -Total 0 } | Should -Throw
            { Get-PercentualLivre -Livre 50 -Total -1 } | Should -Throw
        }
        It 'Lança erro para livre negativo' {
            { Get-PercentualLivre -Livre -1 -Total 100 } | Should -Throw
        }
        It 'Lança erro para livre > total' {
            { Get-PercentualLivre -Livre 150 -Total 100 } | Should -Throw
        }
    }

    Context 'Get-ClassificacaoDisco' {
        It 'Retorna CRITICO quando <= limite crítico (padrão 10)' {
            Get-ClassificacaoDisco -PercentualLivre 5 | Should -Be 'CRITICO'
            Get-ClassificacaoDisco -PercentualLivre 10 | Should -Be 'CRITICO'
        }
        It 'Retorna ALERTA quando entre crítico e alerta (padrão 10-20)' {
            Get-ClassificacaoDisco -PercentualLivre 15 | Should -Be 'ALERTA'
            Get-ClassificacaoDisco -PercentualLivre 20 | Should -Be 'ALERTA'
        }
        It 'Retorna OK quando > limite de alerta (padrão 20)' {
            Get-ClassificacaoDisco -PercentualLivre 25 | Should -Be 'OK'
            Get-ClassificacaoDisco -PercentualLivre 100 | Should -Be 'OK'
        }
        It 'Respeita limites personalizados' {
            Get-ClassificacaoDisco -PercentualLivre 8 -Critico 5 -Alerta 15 | Should -Be 'ALERTA'
            Get-ClassificacaoDisco -PercentualLivre 5 -Critico 5 -Alerta 15 | Should -Be 'CRITICO'
            Get-ClassificacaoDisco -PercentualLivre 12 -Critico 5 -Alerta 15 | Should -Be 'ALERTA'
            Get-ClassificacaoDisco -PercentualLivre 20 -Critico 5 -Alerta 15 | Should -Be 'OK'
        }
        It 'Lança erro quando crítico > alerta' {
            { Get-ClassificacaoDisco -PercentualLivre 10 -Critico 20 -Alerta 10 } | Should -Throw
        }
    }

    Context 'ConverterParaJsonContrato' {
        It 'gera o corpo aceito pela API e traduz estados dos serviços' {
            $servicos = @([pscustomobject]@{ nome = 'spooler'; status = 'running' }, [pscustomobject]@{ nome = 'wuauserv'; status = 'stopped' })
            $obj = ConverterParaJsonContrato -FilialId 'filial-01' -Cpu 12.5 -Memoria 45.2 -DiscoLivrePercentual 68.7 -Servicos $servicos | ConvertFrom-Json
            $obj.cpu | Should -Be 12.5
            $obj.memoria | Should -Be 45.2
            $obj.disco | Should -Be 68.7
            $obj.servicos.spooler | Should -Be $true
            $obj.servicos.wuauserv | Should -Be $false
            $obj.latencia | Should -Be 0
            @($obj.PSObject.Properties).Count | Should -Be 5
        }
    }
}
