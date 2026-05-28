# Changelog

## [0.1.0](https://github.com/aiherrera/oxidock/releases/tag/v0.1.0) (2026-05-27)

### Features

- OSS governance: LICENSE, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, issue/PR templates, Dependabot config
- CI workflow for frontend and Rust quality gates
- macOS release workflow: Developer ID signing, Apple notarization, universal `.dmg` on GitHub Releases ([RELEASE.md](RELEASE.md))
- Vitest tests for core UI and search utilities
- Server-side enforcement for destructive Docker CLI commands
- Content Security Policy for the Tauri webview
- Registry URL validation (HTTPS only, blocks private/loopback hosts)

### Miscellaneous Chores

- README with development, security, and quality-check documentation
- Lazy-loaded secondary app pages to reduce initial bundle size
