$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies"
$env:PATH = "$runtime\node\bin;$runtime\bin;$env:PATH"
$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
$pnpm = if ($pnpmCommand) { $pnpmCommand.Source } else { Join-Path $runtime "bin\pnpm.cmd" }

Set-Location (Join-Path $root "MultiMode")
& $pnpm install
& $pnpm run deploy
