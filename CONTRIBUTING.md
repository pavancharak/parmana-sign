# Contributing

Thanks for your interest in contributing.

## Getting started

```bash
npm install
npm run build
npm run typecheck
npm test
```

## Making a change

1. Open an issue first for anything beyond a small fix, so we can
   agree on the approach before you invest time in it.
2. Keep pull requests focused — one logical change per PR.
3. Add or update tests for any behavior change.
4. Make sure `npm run build`, `npm run typecheck`, and `npm test` all
   pass before opening a PR.

## Scope

This library is intentionally small: signing, verification, and
canonical hashing primitives. Proposals that add policy evaluation,
authorization logic, or key management/storage are out of scope — those
concerns belong in the application layer, not here.

## Code style

- TypeScript strict mode.
- No hidden side effects; prefer pure functions and immutable data.
- Public classes and interfaces should have doc comments explaining
  *what* they do and any non-obvious invariants.

## Reporting bugs

Open a GitHub issue with steps to reproduce. For security
vulnerabilities, see [SECURITY.md](./SECURITY.md) instead of a public
issue.
