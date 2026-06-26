$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies"
$gitCommand = Get-Command git -ErrorAction SilentlyContinue
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$git = if ($gitCommand) { $gitCommand.Source } else { Join-Path $runtime "native\git\cmd\git.exe" }
$node = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $runtime "node\bin\node.exe" }

Set-Location $root
& $node Deploy/build-pages.mjs

if (-not (Test-Path ".git\HEAD")) {
  & $git init -b main
}

& $git config user.name "BF_TRPG Deploy"
& $git config user.email "bf-trpg-deploy@example.com"

$remote = (& $git remote get-url origin 2>$null)
if (-not $remote) {
  & $git remote add origin "https://github.com/chikogadwaebeoryeo-rikolove/BF_TRPG.git"
}

& $git add .
& $git commit -m "Deploy BF_TRPG pages and cloud multiplayer" 2>$null
& $git push -u origin main

$branch = (& $git branch --list gh-pages)
if ($branch) {
  & $git branch -D gh-pages
}

& $git subtree split --prefix docs -b gh-pages
& $git push -f origin gh-pages
