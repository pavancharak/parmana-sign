# Demo video

[`parmana-sign-demo.mp4`](./parmana-sign-demo.mp4): 50 seconds, 1280×720, no audio.

It verifies a hybrid-signed (Ed25519 + ML-DSA-65) Execution Trust Record
offline with `@parmana/sign`. Then it changes one field (the deal amount,
4200 → 42000) and verifies again: the hash and all three signature checks
fail.

- **Real:** every verification result shown is actual output of
  `verifyExecutionTrustRecordOffline` (v0.2.0). The record is
  `hybridRecord` from `tests/fixtures/parmana-artifacts.json`, which was
  signed by Parmana's own `@parmana/crypto` code.
- **Illustrative:** the terminal is animated. The `node verify.mjs` and
  `jq` commands stand for the steps rather than being a live screen
  recording. The record is a sample, not a live HubSpot action.
