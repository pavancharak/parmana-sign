# Releasing

## Cutting a release

1. Bump `version` in `package.json` and add an entry to `CHANGELOG.md`.
2. Commit, push to `main`.
3. Tag the release and push the tag:

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

Pushing a `v*.*.*` tag triggers `.github/workflows/release.yml`, which:

1. Builds and tests the package with a clean `npm ci`.
2. Packs it into the exact tarball `npm publish` would produce (`npm pack`).
3. Generates [SLSA](https://slsa.dev) Build Level 3 provenance for that tarball via the
   [SLSA GitHub generator](https://github.com/slsa-framework/slsa-github-generator).
4. Signs the tarball keylessly with [cosign](https://github.com/sigstore/cosign), using
   GitHub's own OIDC identity for the workflow run — no signing key to generate or store.
5. Attaches the tarball, its SLSA provenance (`*.intoto.jsonl`), its cosign signature
   (`*.sig`), and its cosign certificate (`*.pem`) to the GitHub release.

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

## Reproducibility

The build is deterministic in the parts that matter for provenance: `npm ci` installs exactly
what `package-lock.json` pins, and this package's build step (`tsc`) does not embed timestamps,
hostnames, or other environment-dependent values into its output — confirmed by inspecting
`src/` and `tsconfig.json`; nothing here calls `Date.now()`/similar at build time. Full
byte-for-byte reproducibility of the packed `.tgz` itself (normalizing tar entry
modification-times, etc.) is not implemented yet — a known, scoped-out gap, not a silent claim
of full reproducibility.
