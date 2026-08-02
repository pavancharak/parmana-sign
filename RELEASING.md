# Releasing

## Cutting a release

1. Bump `version` in `package.json` and add an entry to `CHANGELOG.md`. **This must match the
   git tag exactly** — the workflow verifies this and refuses to build/publish if they disagree
   (added after `v0.1.0`/`v0.1.1` were both tagged while `package.json` still said `"0.1.0"`).
2. Commit, push to `main`.
3. Tag the release and push the tag:

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

Pushing a `v*.*.*` tag triggers `.github/workflows/release.yml`, which:

1. Verifies the tag matches `package.json`'s version, failing closed if not.
2. Builds and tests the package with a clean `npm ci`.
3. Packs it into the exact tarball `npm publish` would produce (`npm pack`).
4. Generates [SLSA](https://slsa.dev) Build Level 3 provenance for that tarball via the
   [SLSA GitHub generator](https://github.com/slsa-framework/slsa-github-generator).
5. Signs the tarball keylessly with [cosign](https://github.com/sigstore/cosign), using
   GitHub's own OIDC identity for the workflow run — no signing key to generate or store.
6. Attaches the tarball, its SLSA provenance (`*.intoto.jsonl`), its cosign signature
   (`*.sig`), and its cosign certificate (`*.pem`) to the GitHub release.
7. Publishes that same tarball to the public npm registry via
   [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC — no npm token stored
   as a secret anywhere in this repo) with npm's own provenance attestation
   (`npm publish --provenance`).

**Before step 7 can succeed for the first time**, a Trusted Publisher must be linked for
`@parmana/sign` on npmjs.com (repository `pavancharak/parmana-sign`, workflow file
`release.yml`) — see npm's [Trusted Publishing docs](https://docs.npmjs.com/trusted-publishers/)
for the current first-publish flow. Until that's linked, the publish step fails with an auth
error; everything else in the workflow (GitHub release, provenance, signature) still succeeds.

## Verifying a release

Every release asset can be independently verified without trusting this repository's own
infrastructure — only Sigstore's and GitHub's public transparency logs.

### Verify the SLSA provenance

```bash
# Install: https://github.com/slsa-framework/slsa-verifier#installation
slsa-verifier verify-artifact <tarball>.tgz \
  --provenance-path <the-.intoto.jsonl-file-from-the-release> \
  --source-uri github.com/pavancharak/parmana-sign \
  --source-tag v0.2.0
```

(The provenance file's exact name is generated per-release by the SLSA generator — check the
release's asset list for the `.intoto.jsonl` file.)

A successful verification proves the tarball was built by the workflow defined in this
repository, from the tagged source commit, on GitHub-hosted infrastructure — not built or
substituted by anyone with just push access to the repo.

### Verify the cosign signature

```bash
# Install: https://docs.sigstore.dev/system_config/installation/
cosign verify-blob <tarball>.tgz \
  --signature <tarball>.tgz.sig \
  --certificate <tarball>.tgz.pem \
  --certificate-identity-regexp "^https://github.com/pavancharak/parmana-sign/.github/workflows/release.yml@refs/tags/v.*$" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

A successful verification proves the exact bytes of the tarball were signed by that specific
GitHub Actions workflow run, and that the signature is recorded in the public Rekor
transparency log (queryable independently at https://rekor.sigstore.dev).

### Verify npm's own provenance

```bash
npm audit signatures
```

or check the "Provenance" panel on the package's npmjs.com page directly. This is separate
from (and in addition to) the SLSA provenance above — it's npm's own attestation, generated
because the publish ran via Trusted Publishing from this repository's `release.yml`.

## Reproducibility

The build is deterministic in the parts that matter for provenance: `npm ci` installs exactly
what `package-lock.json` pins, and this package's build step (`tsc`) does not embed timestamps,
hostnames, or other environment-dependent values into its output — confirmed by inspecting
`src/` and `tsconfig.json`; nothing here calls `Date.now()`/similar at build time. Full
byte-for-byte reproducibility of the packed `.tgz` itself (normalizing tar entry
modification-times, etc.) is not implemented yet — a known, scoped-out gap, not a silent claim
of full reproducibility.
