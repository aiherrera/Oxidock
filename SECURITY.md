# Security Policy

## Supported versions

Security fixes are applied to the default branch. Pre-release `0.1.x` builds may receive fixes without a separate advisory channel until versioning stabilizes.

## Reporting a vulnerability

Please **do not** open public GitHub issues for exploitable security problems.

Email maintainers privately with:

- A description of the issue and impact
- Steps to reproduce
- Affected version or commit
- Suggested fix (if any)

We aim to acknowledge reports within a few business days.

## Threat model (summary)

Oxidock runs locally on the developer machine with access to Docker Engine and the OS keyring.

### Docker CLI playground

- Commands are normalized and classified in Rust (`command_safety`).
- **Destructive** commands require `confirmDestructive: true` from the UI after explicit user confirmation.
- Do not bypass this check in new features that invoke `run_docker_command`.

### Registry credentials

- Passwords are stored via the OS keyring (`KEYRING_SERVICE` in `registry.rs`), not in plain config files.
- OCI registry URLs must use **HTTPS** and cannot target private, loopback, or link-local hosts.

### Local AI assistant

- Optional GGUF model is downloaded from Hugging Face.
- Integrity is verified using `EXPECTED_MODEL_SHA256` in `ai.rs`.
- The `llama-cli` sidecar must be bundled for release builds.

### Webview

- Content Security Policy is defined in `src-tauri/tauri.conf.json`.
- `'unsafe-inline'` may be required for Vite/Tauri dev; production builds should minimize this where feasible.
- External links use the Tauri opener plugin; restrict new URL surfaces in code.

### Engine lifecycle

- Lifecycle actions spawn local programs (`docker`, `colima`, `orb`, etc.) with provider-specific commands.
- Contributors should not add arbitrary shell execution without review.

## Dependency audits

Maintainers may run:

```bash
pnpm audit --prod
cd src-tauri && cargo audit
```

These are not required for every PR but should run before releases.
