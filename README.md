# Ryoiki

Ryoiki is a separate tool of the Eien project that provides a 3D treemap visualization and code scanning pipeline for software repositories using tokei. It combines a Rust backend for scanning and metrics generation with a Svelte/Three.js web UI for interactive exploration.

![screenshot](.\screenshot.png)

## Project Overview

- Generates `ryoiki.cc.json` (structure tree) and `ryoiki.metrics.json` (summary metrics). This json file is compatbile with CodeCharta.
- Web UI renders buildings colored by language with height representing lines of code.

## Quick Start

- Prerequisites: `Node.js >= 18`, `Rust (stable)`, Windows PowerShell.
- Install and run in one step on Windows:

```powershell
cd c:\Users\danalec\Documents\src\eien\tools\ryoiki
powershell -ExecutionPolicy Bypass -File build-and-run.ps1
```

- Development mode (separate processes):

```powershell
# Backend (port 3030)
cargo run --release

# Web UI (port 3000, proxies /api to 3030)
cd apps/web
npm install
npm run dev
```

Open `http://localhost:3000` to use the web interface.

## Detailed Configuration

Configuration file: `.\tools.config.json`.

```json
{
  "paths": {
    "metrics_dir": "tools/metrics",
    "audit_dir": "../.." // modify this first
  }
}
```

- `paths.audit_dir`: Scan root. Relative to the Ryoiki directory or absolute. Default `"../.."` (Eien repo root).
- `paths.metrics_dir`: Output directory for metrics. Absolute or relative; resolved against scan root. Default `"tools/metrics"`.
- `audit_dir` (top-level alias): Optional alias for `paths.audit_dir`.
- Environment overrides:
  - `RYOIKI_AUDIT_DIR`: Overrides audit root.
  - `TOKADO_AUDIT_DIR`: Backward-compatible alias.

Exclusions (always ignored during scanning): `target`, `node_modules`, `dist`, `build`, `npm_modules`, `.git`, `ryoiki.cc.json`, `ryoiki.metrics.json`, `package-lock.json`.

## Examples

- Launch the Ryoiki tool:

```powershell
cd ryoiki
cargo run --release
```

- Configure audit settings in `tools.config.json`:

```json
{
  "paths": {
    "metrics_dir": "/tools/metrics",
    "audit_dir": "../src/my-monorepo"
  }
}
```

- Specify audit directory using `audit_dir` (top-level alias):

```json
{
  "audit_dir": "../code/workspace"
}
```

- Override via environment variable (PowerShell):

```powershell
$env:RYOIKI_AUDIT_DIR = "../code/workspace"
cargo run --release
```

- Trigger a rescan via API:

```powershell
Invoke-WebRequest -Method POST http://localhost:3030/api/refresh
```

Outputs are written to:
- `tools/ryoiki/apps/web/public/ryoiki.cc.json`
- `tools/ryoiki/apps/web/public/ryoiki.metrics.json`
- `<audit_dir>/tools/metrics/ryoiki.cc.json`
- `<audit_dir>/tools/metrics/ryoiki.metrics.json`

## Detailed Configuration Reference

- `paths.audit_dir`
  - Type: string (absolute or relative)
  - Default: `"../.."`
  - Purpose: Defines the repository root to scan.

- `paths.metrics_dir`
  - Type: string (absolute or relative)
  - Default: `"tools/metrics"`
  - Purpose: Directory where JSON outputs are written.

- `audit_dir`
  - Type: string
  - Default: unset
  - Purpose: Top-level alias for `paths.audit_dir`.

- `RYOIKI_AUDIT_DIR`, `TOKADO_AUDIT_DIR`
  - Type: environment variables
  - Purpose: Override the audit directory without editing configuration.

## Troubleshooting

- Refresh fails with `Internal Server Error`:
  - Ensure the backend is running on `http://localhost:3030`.
  - Verify `apps/web/vite.config.ts` proxies `/api` to port `3030`.
  - Check write permissions for the configured `metrics_dir`.

- Metrics files not found in the web UI:
  - Confirm `ryoiki.cc.json` and `ryoiki.metrics.json` exist in `apps/web/public`.
  - If missing, trigger a rescan using the API or restart the backend.

- Scan includes unwanted directories:
  - Add project-specific ignores to `.gitignore` at your repo root.
  - The built-in excludes list is applied automatically.

- Large repositories / performance:
  - Prefer release builds for scanning (`cargo run --release`).
  - Use the web UI filters to limit visible languages.

## Contribution Guidelines

- Fork and create a feature branch.
- Keep changes focused; follow the existing TypeScript/Rust code style.
- Run tests before submitting:

```powershell
cd tools/ryoiki
npm test
cargo test
```

- Ensure lint/type checks pass:

```powershell
cd tools/ryoiki/apps/web
npm run lint
npm run check
```

## License
- Ryoiki is dual-licensed under [MIT OR Apache-2.0](./LICENSE).
