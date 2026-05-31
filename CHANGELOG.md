# Changelog

## [0.4.0](https://github.com/aiherrera/Oxidock/compare/v0.3.0...v0.4.0) (2026-05-31)


### Features

* **assistant:** Add intent classification and prompt parsing ([ae27f48](https://github.com/aiherrera/Oxidock/commit/ae27f486afe5e3ba23ca031d53e212e35449ec98))
* **assistant:** Enrich insights context and model prompts ([bd7e257](https://github.com/aiherrera/Oxidock/commit/bd7e2577a0ba86cfa79d7376a20f1b04edb068ac))
* **search:** Improve palette navigation and shortcut labels ([e80912d](https://github.com/aiherrera/Oxidock/commit/e80912d590a4ba9079e425ffa0d246750c8e5d50))
* **ui:** Add GitHub link to request registry commands ([741028e](https://github.com/aiherrera/Oxidock/commit/741028e3bbfe6764dc1d57c37b232912ed75c6db))
* **ui:** Expand assistant page with attachments and chat UX ([c8a3723](https://github.com/aiherrera/Oxidock/commit/c8a372316c4345522f384c21f9d9cd818ae9b0e9))
* **ui:** Show learn results in images unified search ([572c841](https://github.com/aiherrera/Oxidock/commit/572c8412fff58e58d5112d89597219560f232311))
* **ui:** Wire unified search through app shell ([389be4b](https://github.com/aiherrera/Oxidock/commit/389be4b0338ab165aa97e62bb10750002efaaa7f))

## [0.3.0](https://github.com/aiherrera/Oxidock/compare/v0.2.0...v0.3.0) (2026-05-30)


### Features

* **tauri:** Add resource deletes and app insights assistant ([bed6a55](https://github.com/aiherrera/Oxidock/commit/bed6a55afd9677afac49ff7b67b44e5ecdc3701c))
* **ui:** Add AI Elements chat components ([6679215](https://github.com/aiherrera/Oxidock/commit/6679215a3fbcb6d6449c01e40d8531fdfc7c3bca))
* **ui:** Add app insights assistant experience ([b714030](https://github.com/aiherrera/Oxidock/commit/b714030af2edc7e3620077d5656481315001db6a))
* **ui:** Add bulk resource selection and deletion ([eeb0c98](https://github.com/aiherrera/Oxidock/commit/eeb0c987be225d8bbc5f4fab61bd537090d8e636))
* **ui:** Add dashboard and assistant navigation ([a9f5ccd](https://github.com/aiherrera/Oxidock/commit/a9f5ccdeb799eee18f916b0578335f554b28f060))
* **ui:** Add Docker dashboard overview ([f3d3009](https://github.com/aiherrera/Oxidock/commit/f3d300997d1c725fe498eb665a84570c7c53475b))
* **ui:** Add sidebar resource panel and navigation icons ([89be516](https://github.com/aiherrera/Oxidock/commit/89be5167c76f4cdb7077fdbbd2a6ac3a61092e7d))
* **ui:** Wire bulk actions into Docker resource pages ([6652175](https://github.com/aiherrera/Oxidock/commit/66521756f9dac13e35df3ca44e720bca36aa3e5b))


### Bug Fixes

* **release:** allow Release Please to create version tags ([49617dd](https://github.com/aiherrera/Oxidock/commit/49617ddff8a0af0cb79f244dd77a229bc8b52b5f))
* **tauri:** Wrap app insights assistant invoke params ([ac2866b](https://github.com/aiherrera/Oxidock/commit/ac2866bc45a6df2f5402c04182ed547c03b3f69f))

## [0.2.0](https://github.com/aiherrera/Oxidock/compare/v0.1.0...v0.2.0) (2026-05-28)


### Features

* **menu:** Add standard Edit menu shortcuts ([a09800c](https://github.com/aiherrera/Oxidock/commit/a09800cf0cdf7a41ba3fa87ed0cd22ea2b62e7fd))
* **tauri:** Add Docker desktop backend ([0d10955](https://github.com/aiherrera/Oxidock/commit/0d10955d9b8c2516b1a06b90d3854f267aac911a))
* **tauri:** Stream AI model install progress events ([033d865](https://github.com/aiherrera/Oxidock/commit/033d865ac3c5339103d920c4ff819fc6aac97d42))
* **ui:** Add container row lifecycle actions ([e24a7db](https://github.com/aiherrera/Oxidock/commit/e24a7db8157d20f905d4e81c354bb2d3833d569d))
* **ui:** Add Oxidock desktop interface ([da7b77e](https://github.com/aiherrera/Oxidock/commit/da7b77eccf68579018e9a09997dd7c8461c38880))
* **ui:** Improve CLI playground confirmation and state ([23275ec](https://github.com/aiherrera/Oxidock/commit/23275ec00c718a8999bbb0184b0d6e7b5b3877e2))
* **ui:** Show AI assistant install progress ([157139d](https://github.com/aiherrera/Oxidock/commit/157139de3199325581cba944b1b23a3706d97f2d))


### Bug Fixes

* **release:** Normalize entitlements for macOS codesign ([6348487](https://github.com/aiherrera/Oxidock/commit/63484871614bb0928f70c2bd140c28c1a99293aa))
* **tauri:** Classify docker rm as destructive ([4e9a1a8](https://github.com/aiherrera/Oxidock/commit/4e9a1a81241c61162cc5e3f2148dfd512f466d23))

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
