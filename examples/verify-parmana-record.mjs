// Verify a Parmana-signed Execution Trust Record offline, then show that
// changing one field breaks it. Run: npm run build && node examples/verify-parmana-record.mjs
import { readFileSync } from "node:fs";

import {
  isMlDsa65Supported,
  verifyExecutionTrustRecordOffline,
} from "@parmana/sign";

// Sample artifacts signed by Parmana's own signing code, with the public
// keys they reference (keyId -> PEM). In real use, the record comes from
// Parmana and the keys from its key-discovery endpoint.
const { publicKeys, legacyRecord, hybridRecord } = JSON.parse(
  readFileSync(
    new URL("../tests/fixtures/parmana-artifacts.json", import.meta.url),
    "utf8",
  ),
);

const record = isMlDsa65Supported() ? hybridRecord : legacyRecord;

const genuine = await verifyExecutionTrustRecordOffline(record, publicKeys);
console.log("genuine record:", {
  valid: genuine.valid,
  algorithmsChecked: genuine.algorithmsChecked,
});

const tampered = structuredClone(record);
tampered.transaction.payload.amount = 42000;

const result = await verifyExecutionTrustRecordOffline(tampered, publicKeys);
console.log("tampered record:", { valid: result.valid, errors: result.errors });

if (!genuine.valid || result.valid) {
  throw new Error("unexpected verification result");
}
