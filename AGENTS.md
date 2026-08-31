# Project: Google Antigravity Usage Extension

If you are using agent(s) or any AI to read this codebase and do something, welcome, haha. point that AI thingy to this md, hope this helps!

## Overview

Google Antigravity Usage (`antigravity-usage`) is an ultra-fast, lightweight, 100% local Visual Studio Code extension designed to monitor and display real-time quotas for Google Antigravity AI models directly in the status bar with interactive hover controls.

## Tech Stack

- **Framework**: VS Code Extension API (`^1.107.0`)
- **Language**: TypeScript (target ES2022, Node16 module resolution)
- **Build Tool**: esbuild (`^0.28.2`)
- **Linter**: ESLint v9+ flat config (`eslint.config.mjs`, `typescript-eslint`)
- **Runtime**: Node.js (VS Code Extension Host)

## Project Structure

- `src/extension.ts`: Extension entry point. Handles activation, deactivation, command registrations, configuration change events, status bar updates, and polling timers.
- `src/api.ts`: API interaction layer. Discovers running Antigravity processes/hubs, extracts CSRF tokens and ports, communicates with the internal `LanguageServerService` (`RetrieveUserQuotaSummary`), and aggregates 5h and weekly quota metrics.
- `src/formatter.ts`: Helper functions for building status bar text, 2-line hover tooltip blocks, native ASCII progress bars, single/double unit countdown timers, and interactive toggle links.
- `src/platform.ts`: Cross-platform process query strategies (`WindowsPlatform` and `UnixPlatform`) for querying OS processes and network listening ports.
- `src/types.ts`: TypeScript interfaces and type definitions for API responses, quota metrics, and platform discovery.
- `package.json`: Extension manifest defining activation events, commands, configuration properties, and build scripts.
- `tsconfig.json`: TypeScript compiler configuration.
- `eslint.config.mjs`: ESLint configuration.
- `assets/generate-icon.js`: Generates the primary extension icon (`assets/icon.png`) using the official Antigravity IDE logo.
- `build-local-vsix.ps1`: Automated packaging script outputting `.vsix` to `dev_vsix/`.

## Coding Guidelines

### General

- **Clarity**: Prioritize code readability, zero bloat, and clean separation of concerns.
- **Async/Await**: Use `async/await` for all asynchronous operations.
- **Error Handling**: Catch errors explicitly and present clean status bar / tooltip error states.

### Style & Conventions

- **Indentation**: Follow the existing indentation style (use tabs).
- **Naming**:
  - Variables/Functions: `camelCase`
  - Classes/Interfaces: `PascalCase` (no `I` prefix)
  - Configuration keys: `kebab-case` under `antigravity-usage.*`
- **Semicolons**: Always use semicolons at the end of statements.
- **Quotes**: Single quotes `'` for strings.

### Configuration

- All configuration properties live under the `antigravity-usage` namespace in `package.json`.
- Access configuration using `vscode.workspace.getConfiguration('antigravity-usage')`.
- Handle configuration updates dynamically in the `vscode.workspace.onDidChangeConfiguration` event listener.

## Development Workflow

- **Build**: `npm run compile` to bundle and minify into `out/extension.js` using esbuild.
- **Watch**: `npm run watch` to automatically rebuild on file changes.
- **Lint**: `npm run lint` or `npm run lint:fix` to run ESLint across source files.
- **Packaging**: `.\build-local-vsix.ps1` (or `npm run package`) to generate a `.vsix` in `dev_vsix/`.
