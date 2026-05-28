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

### Versioning and changelog

Oxidock uses [Semantic Versioning](https://semver.org/). Until `1.0.0`, `0.1.x` indicates pre-release builds.

[Release Please](https://github.com/googleapis/release-please) opens a **Release PR** on `main` that:

- Updates [CHANGELOG.md](CHANGELOG.md) from merged [Conventional Commits](https://www.conventionalcommits.org/) (see [CONTRIBUTING.md](CONTRIBUTING.md))
- Bumps versions in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`

Contributors do not edit version files or `CHANGELOG.md` by hand.

When a maintainer merges the Release PR, Release Please creates the `v<version>` tag (for example `v0.1.1`). The [release workflow](.github/workflows/release.yml) triggers on tags matching `v*.*.*` and publishes signed macOS artifacts.

### Pre-release checklist

Run these locally before a maintainer cuts a signed release:

1. `pnpm check`
2. `cd src-tauri && cargo test && cargo clippy --all-targets -- -D warnings`
3. `pnpm tauri build` on target platforms (macOS, Linux, Windows as applicable)
4. `pnpm audit --prod` and optional `cargo audit`
5. Review [SECURITY.md](SECURITY.md) and the open Release PR changelog preview on GitHub
6. Verify CLI destructive-command confirmation still works end-to-end
7. Smoke-test engine switch, registry credentials, and containers dashboard

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

| Workflow                                               | Purpose                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| [CI](.github/workflows/ci.yml)                         | Lint, test, build — no signing                                      |
| [Release Please](.github/workflows/release-please.yml) | Release PR, changelog, version bumps, git tag (no GitHub Release)   |
| [Release](.github/workflows/release.yml)               | Validate, then build universal macOS, sign, notarize, upload assets |

Signed release jobs use secrets configured in **Settings → Secrets and variables → Actions**. Secret **names** are listed below; values are stored only in GitHub and must not appear in the repo, logs, or issues.

The app bundle identifier is public: `com.aiherrera.oxidock` (see [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json)).

### GitHub repository secrets

Configure these secrets for [`.github/workflows/release.yml`](.github/workflows/release.yml). Do not commit values or paste them into PRs.

| Secret                       | Purpose                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `APPLE_CERTIFICATE`          | Signing certificate material (stored as a GitHub secret, not in git)                    |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the certificate export                                                     |
| `APPLE_SIGNING_IDENTITY`     | (Optional) Developer ID Application identity when multiple exist in the runner keychain |
| `APPLE_ID`                   | Apple ID used for notarization                                                          |
| `APPLE_PASSWORD`             | App-specific password for notarization                                                  |
| `APPLE_TEAM_ID`              | Apple Developer Team ID                                                                 |

Maintain signing assets locally on a trusted machine. Store encoded certificate material only in GitHub Actions secrets—never in the repository. Rotate credentials if exposure is suspected.

### Cutting a signed release

1. Ensure merged PRs on `main` use Conventional Commit titles so the Release PR reflects the right changes.
2. Review the open **Release PR** created by [Release Please](.github/workflows/release-please.yml) (version bumps, [CHANGELOG.md](CHANGELOG.md), all three version files). Edit the Release PR if needed before merging.
3. **Merge the Release PR** on the default branch. Release Please creates the `v<version>` tag (`skip-github-release` is enabled so it does not create a duplicate GitHub Release).
4. Watch the **Release** workflow on the new tag. It validates, then builds a **universal** macOS binary (`universal-apple-darwin`), signs, notarizes, and uploads `.dmg` / `.app.tar.gz` assets to GitHub Releases.

**Manual Release workflow** (tag must already exist on the remote): Actions → **Release** → **Run workflow** → enter tag (e.g. `v0.1.1`).

**Manual Release Please** (refresh the Release PR): Actions → **Release Please** → **Run workflow**.

Only merge Release PRs and tags from trusted maintainers; signed builds use repository secrets available only on the upstream repo.

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
2. Fix the issue on `main`, merge the next Release PR (patch bump), and let the new tag run a signed release.
3. Update the landing page if it pointed at a specific broken asset URL.

### Other platforms

Windows codesign and Linux distribution are not automated yet. Add workflows and documentation when those targets are ready.
