# Release process

> **Notice:** This document describes the public release process. It does **not** contain signing certificates, passwords, private keys, or secret values. Signed releases are performed only by maintainers through GitHub Actions.

## Security boundaries

- **Never** commit certificates, `.p12` files, provisioning profiles, or private keys to the repository.
- **Never** share `.p12` files or export passwords in chat, issues, or PRs.
- **External contributors** cannot access repository secrets; fork PR workflows do not receive signing credentials.
- **Signed releases** run only from trusted version tags on the default branch (or maintainer-initiated workflow dispatch for an existing tag).
- **Regular CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) validates code only; it does not sign or notarize artifacts.

---

## For contributors

### Versioning

Oxidock uses [Semantic Versioning](https://semver.org/) once public releases begin. Until then, `0.1.x` indicates pre-release builds.

When preparing a release PR (maintainers merge and tag), versions should stay aligned in:

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

Releases are tagged as `v<version>` (for example `v0.1.1`). The [release workflow](.github/workflows/release.yml) triggers on tags matching `v*.*.*`.

### Pre-release checklist

Run these locally before a maintainer cuts a signed release:

1. `pnpm check`
2. `cd src-tauri && cargo test && cargo clippy --all-targets -- -D warnings`
3. `pnpm tauri build` on target platforms (macOS, Linux, Windows as applicable)
4. `pnpm audit --prod` and optional `cargo audit`
5. Review [SECURITY.md](SECURITY.md) and [CHANGELOG.md](CHANGELOG.md)
6. Verify CLI destructive-command confirmation still works end-to-end
7. Smoke-test engine switch, registry credentials, and containers dashboard

### Changelog

Record user-facing changes in [CHANGELOG.md](CHANGELOG.md) under `Unreleased` during development. On release, maintainers move entries into a versioned section.

### Verify a downloaded build (macOS)

Anyone can verify a published artifact from [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository):

1. Download the `.dmg` from the release page.
2. Run (adjust the path and filename to match the release):

   ```bash
   ./scripts/verify-macos-artifact.sh ~/Downloads/Oxidock_0.1.1_universal.dmg
   ```

3. Install from the DMG and confirm the app opens without “unidentified developer” warnings.

This checks a **published** build; contributors do not need signing credentials to run local validation or verify release assets.

---

## For maintainers

Only repository maintainers configure signing and publish signed macOS builds. Oxidock distributes **outside the Mac App Store** via Developer ID signing, Apple notarization, and artifacts on GitHub Releases.

### Overview

| Workflow | Purpose |
|----------|---------|
| [CI](.github/workflows/ci.yml) | Lint, test, build — no signing |
| [Release](.github/workflows/release.yml) | Validate, then build universal macOS, sign, notarize, upload assets |

Signed release jobs use secrets configured in **Settings → Secrets and variables → Actions**. Secret **names** are listed below; values are stored only in GitHub and must not appear in the repo, logs, or issues.

The app bundle identifier is public: `com.aiherrera.oxidock` (see [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json)).

### GitHub repository secrets

Configure these secrets for [`.github/workflows/release.yml`](.github/workflows/release.yml). Do not commit values or paste them into PRs.

| Secret | Purpose |
|--------|---------|
| `APPLE_CERTIFICATE` | Signing certificate material (stored as a GitHub secret, not in git) |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the certificate export |
| `APPLE_SIGNING_IDENTITY` | (Optional) Developer ID Application identity when multiple exist in the runner keychain |
| `APPLE_ID` | Apple ID used for notarization |
| `APPLE_PASSWORD` | App-specific password for notarization |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

Maintain signing assets locally on a trusted machine. Store encoded certificate material only in GitHub Actions secrets—never in the repository. Rotate credentials if exposure is suspected.

### Cutting a signed release

1. Bump versions in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
2. Update [CHANGELOG.md](CHANGELOG.md) for the version.
3. Merge to the default branch, then create and push the tag:

   ```bash
   git tag v0.1.1
   git push origin v0.1.1
   ```

4. Watch the **Release** workflow. It validates, then builds a **universal** macOS binary (`universal-apple-darwin`), signs, notarizes, and uploads `.dmg` / `.app.tar.gz` assets.

**Manual run** (tag must already exist on the remote): Actions → **Release** → **Run workflow** → enter tag (e.g. `v0.1.1`).

Only push tags from trusted maintainers; the workflow checks out the tagged commit and uses repository secrets available only on the upstream repo.

### Landing page download links

Prefer the stable latest-release page:

```text
https://github.com/<owner>/<repo>/releases/latest
```

For a direct “Download for macOS” button, either:

- Link to `/releases/latest` and let users pick the `.dmg`, or
- At build time, call the [GitHub Releases API](https://docs.github.com/en/rest/releases/releases) to resolve the newest `.dmg` asset URL (avoid hardcoding versioned filenames).

### Rollback

1. Mark the bad GitHub Release as pre-release or delete it (if no users depend on it).
2. Fix the issue on `main`, tag a patch version (`v0.1.2`), and push the tag to run a new signed release.
3. Update the landing page if it pointed at a specific broken asset URL.

### Other platforms

Windows codesign and Linux distribution are not automated yet. Add workflows and documentation when those targets are ready.
