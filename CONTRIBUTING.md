# Contributing to Oxidock

Thank you for your interest in contributing. Oxidock is a Tauri desktop app with a React frontend and a Rust backend that talks to Docker Engine.

## Development setup

1. Install [Node.js](https://nodejs.org/) 22+, [pnpm](https://pnpm.io/) 11+ (project pins pnpm 11.1.3), and [Rust](https://www.rust-lang.org/tools/install) stable.
2. Install and start Docker Engine (or a supported provider: Docker Desktop, Colima, OrbStack, etc.).
3. Clone the repository and run:

```bash
pnpm install
pnpm tauri dev
```

## Quality gates

Before opening a pull request, run:

```bash
pnpm check
cd src-tauri && cargo test
cd src-tauri && cargo fmt --all -- --check
cd src-tauri && cargo clippy --all-targets -- -D warnings
```

For React UI changes, also run:

```bash
pnpm run doctor -- --verbose --diff
```

## Project layout

| Path                    | Purpose                                             |
| ----------------------- | --------------------------------------------------- |
| `src/`                  | React UI (components, hooks, lib adapters, types)   |
| `src-tauri/src/`        | Rust backend (Docker, engine, registry, AI, safety) |
| `ARCHITECTURE_AUDIT.md` | Architecture and OSS readiness notes                |

## Conventions

### TypeScript / React

- Use functional components and hooks.
- Keep Tauri `invoke` calls in `src/lib/tauri-*.ts`, not in components.
- Prefer `@/` imports for new code under `src/`.
- Match existing `page-shell` patterns for resource pages.
- Clean up timers, listeners, and subscriptions in `useEffect` return functions.

### Rust

- Run `cargo fmt` before committing.
- Add unit tests for safety-critical logic (`command_safety`, registry URL validation, CLI policy).
- Keep Tauri command names stable in `src-tauri/src/lib.rs` unless documenting a breaking change.

### TypeScript ↔ Rust DTO sync

When changing shared shapes:

1. Update Rust serde structs in `src-tauri/src/`.
2. Update matching types in `src/types/`.
3. Update `src/lib/tauri-*.ts` invoke wrappers if command signatures change.
4. Note the change in the PR description.

## Pull requests

- Keep PRs focused; prefer several small PRs over one large cleanup.
- Describe user-visible behavior and security impact.
- Link related issues when applicable.
- Do not mix logic changes with large formatting-only diffs.

## Security

See [SECURITY.md](SECURITY.md) for the threat model and reporting process.
