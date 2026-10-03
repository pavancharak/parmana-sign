# Contributing

Thanks for your interest in contributing.

## Getting started

You need Node.js 24.6.0 or later (ML-DSA-65 support in `node:crypto`
starts at 24.6.0).

```bash
npm install
npm run build
npm run lint
npm run typecheck
npm test
npm run examples
npm run check:package
```

These are the same checks CI runs on every pull request.

## Project layout

| Path | What it contains |
| --- | --- |
| `src/` | The library. `src/index.ts` defines the public API. |
| `src/parmana/` | Offline verification of Parmana artifacts and the canonical field mappings Parmana signs. |
| `tests/` | Unit tests (vitest). |
| `tests/fixtures/parmana-artifacts.json` | Sample artifacts signed by Parmana's own code, used by the compatibility tests. |
| `examples/` | Runnable examples that import the package by name. |
| `scripts/` | Fixture generation and the packed-tarball check. |

## Making a change

1. Open an issue first for anything beyond a small fix, so we can
   agree on the approach before you invest time in it.
2. Keep pull requests focused: one logical change per PR.
3. Add or update tests for any behavior change.
4. Add an entry under a new "Unreleased" heading in
   [CHANGELOG.md](./CHANGELOG.md) for any user-visible change.
5. Make sure every command in "Getting started" passes before opening
   a PR.

## Changing what Parmana artifacts look like

`src/parmana/canonicalViews.ts` must match the field sets Parmana signs
exactly, or genuine records stop verifying. If Parmana's signing code
changes, regenerate the fixture from a checkout of the Parmana monorepo
and let the compatibility tests show what drifted:

```bash
PARMANA_REPO=/path/to/parmana scripts/generate-parmana-fixtures.sh
npm test
```

## Scope

This library is intentionally small: signing, verification, and
canonical hashing primitives. Proposals that add policy evaluation,
authorization logic, or key management/storage are out of scope; those
concerns belong in the application layer, not here.

## Code style

- TypeScript strict mode.
- No hidden side effects; prefer pure functions and immutable data.
- Public classes and interfaces should have doc comments explaining
  *what* they do and any non-obvious invariants.
- Follow the existing style in the file you are editing.
  `.editorconfig` sets indentation and line endings.

## Releases

Maintainers cut releases by tagging; see [RELEASING.md](./RELEASING.md).

## Reporting bugs

Open a GitHub issue with steps to reproduce. For security
vulnerabilities, see [SECURITY.md](./SECURITY.md) instead of a public
issue.
