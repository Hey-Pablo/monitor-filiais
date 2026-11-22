Describe 'Envio do batimento' {
    BeforeAll {
        Import-Module (Join-Path $PSScriptRoot '../MonitorFilial.psm1') -Force
        $tokens = $null; $erros = $null
        $ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../Enviar-Batimento.ps1'), [ref]$tokens, [ref]$erros)
        $funcao = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Enviar-Batimento' }, $true)
        . ([scriptblock]::Create($funcao.Extent.Text))
    }
    It 'envia rota, Bearer e corpo corretos' {
        Mock Invoke-RestMethod { }
        $resultado = Enviar-Batimento -ApiBaseUrl 'http://localhost:3000/' -FilialId 'filial-01' -Token 'token-ficticio' -Cpu 10 -Memoria 20 -DiscoLivrePercentual 30 -Servicos @([pscustomobject]@{ nome='spooler'; status='running' })
        $resultado | Should -Be $true
        Should -Invoke Invoke-RestMethod -Times 1 -ParameterFilter {
            $Uri -eq 'http://localhost:3000/filiais/filial-01/batimentos' -and $Headers.Authorization -eq 'Bearer token-ficticio' -and ($Body | ConvertFrom-Json).servicos.spooler
        }
    }
    It 'reporta falha HTTP sem expor a mensagem da exceção' {
        Mock Invoke-RestMethod { throw 'token-ficticio' }
        $mensagens = Enviar-Batimento -ApiBaseUrl 'http://localhost:3000' -FilialId 'filial-01' -Token 'token-ficticio' -Cpu 10 -Memoria 20 -DiscoLivrePercentual 30 -Servicos @([pscustomobject]@{ nome='spooler'; status='running' }) 3>&1
        ($mensagens | Out-String) | Should -Not -Match 'token-ficticio'
        $mensagens[-1] | Should -Be $false
    }
}
