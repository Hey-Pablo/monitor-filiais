@{
    Rules = @{
        AvoidUsingCmdletAliases           = @{ Enable = $true }
        AvoidUsingPositionalParameters    = @{ Enable = $false }
        UseConsistentWhitespace           = @{ Enable = $true }
        UseDeclaredVarsMoreThanAssignments = @{ Enable = $true }
        AvoidDefaultValueSwitchStatement  = @{ Enable = $true }
        UseShouldProcessForStateChangingFunctions = @{ Enable = $true }
        PSUseOutputTypeCorrectly          = @{ Enable = $false }
        PSUseApprovedVerbs                = @{ Enable = $false }
        PSUseBOMForUnicodeEncodedFile     = @{ Enable = $false }
        PSReviewUnusedParameter           = @{ Enable = $false }
    }
}