#!/usr/bin/env bash
# Regenerates tests/fixtures/parmana-artifacts.json from a local checkout
# of the Parmana monorepo (github.com/pavancharak/AgentLabsBuildathon).
#
#   PARMANA_REPO=/path/to/AgentLabsBuildathon scripts/generate-parmana-fixtures.sh
set -euo pipefail

: "${PARMANA_REPO:?set PARMANA_REPO to a checkout of the Parmana monorepo}"

here="$(cd "$(dirname "$0")" && pwd)"
root="$(dirname "$here")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cat > "$tmp/tsconfig.json" <<JSON
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "baseUrl": "$here/fixtures",
    "paths": {
      "@parmana/shared": ["$PARMANA_REPO/packages/shared/src/index.ts"],
      "dotenv": ["./stub-dotenv.ts"]
    }
  }
}
JSON

PARMANA_REPO="$PARMANA_REPO" npx -y tsx --tsconfig "$tmp/tsconfig.json" \
  "$here/fixtures/generate-parmana-fixtures.mts" \
  "$root/tests/fixtures/parmana-artifacts.json"
