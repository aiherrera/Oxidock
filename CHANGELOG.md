# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- OSS governance: LICENSE, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, issue/PR templates, Dependabot config.
- CI workflow for frontend and Rust quality gates.
- macOS release workflow: Developer ID signing, Apple notarization, universal `.dmg` on GitHub Releases ([RELEASE.md](RELEASE.md)).
- Vitest tests for core UI and search utilities.
- Server-side enforcement for destructive Docker CLI commands.
- Content Security Policy for the Tauri webview.
- Registry URL validation (HTTPS only, blocks private/loopback hosts).

### Changed

- README with development, security, and quality-check documentation.
- Lazy-loaded secondary app pages to reduce initial bundle size.
