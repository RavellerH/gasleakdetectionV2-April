param(
    [Parameter(Mandatory = $true)]
    [string]$RepoPath,

    [Parameter(Mandatory = $true)]
    [string]$ApiUrl
)

$resolvedRepo = (Resolve-Path -LiteralPath $RepoPath).Path
Set-Location -LiteralPath $resolvedRepo

$env:NEXT_PUBLIC_GRAPHQL_URL = $ApiUrl
$env:NEXT_PUBLIC_READ_ONLY = 'true'
$env:NODE_ENV = 'production'

if (-not (Test-Path -LiteralPath (Join-Path $resolvedRepo 'node_modules'))) {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$buildId = Join-Path $resolvedRepo 'apps\frontend\.next\BUILD_ID'
if (-not (Test-Path -LiteralPath $buildId)) {
    & npm.cmd run build --workspace @gas-leak/frontend
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

& npm.cmd run start --workspace @gas-leak/frontend -- -p 3000 -H 127.0.0.1
exit $LASTEXITCODE
