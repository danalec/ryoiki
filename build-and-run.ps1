$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Push-Location $root

Write-Host "Installing dependencies..."
npm install

Write-Host "Building Web App and WASM..."
npm run build

Write-Host "Building Rust Backend..."
cargo build --release

$exe = Join-Path $root "target\release\ryoiki.exe"
if (!(Test-Path $exe)) { throw "Binary not found: $exe" }

Write-Host "Starting Ryoiki..."
Write-Host "Server running at http://localhost:3030"
& $exe

Pop-Location
