param(
    [string]$RepoPath = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,

    [Parameter(Mandatory = $true)]
    [string]$ApiUrl
)

$resolvedRepo = (Resolve-Path -LiteralPath $RepoPath).Path
$runner = Join-Path $resolvedRepo 'deploy\hq\run-hq-frontend.ps1'
if (-not (Test-Path -LiteralPath $runner)) { throw "Runner not found: $runner" }

$env:NEXT_PUBLIC_GRAPHQL_URL = $ApiUrl
$env:NEXT_PUBLIC_READ_ONLY = 'true'
Set-Location -LiteralPath $resolvedRepo

& npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE" }
& npm.cmd run build --workspace @gas-leak/frontend
if ($LASTEXITCODE -ne 0) { throw "HQ frontend build failed with exit code $LASTEXITCODE" }

$argument = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$runner`" -RepoPath `"$resolvedRepo`" -ApiUrl `"$ApiUrl`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argument
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 3650)
Register-ScheduledTask -TaskName 'GasGuard HQ Frontend' -Action $action -Trigger $trigger -Settings $settings -Description 'Runs the local read-only GasGuard HQ dashboard on port 3000.' -Force | Out-Null

$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'GasGuard HQ.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = 'http://localhost:3000'
$shortcut.Save()

Start-ScheduledTask -TaskName 'GasGuard HQ Frontend'
Write-Output "Installed scheduled task: GasGuard HQ Frontend"
Write-Output "Created desktop shortcut: $shortcutPath"
Write-Output "Dashboard URL: http://localhost:3000"
