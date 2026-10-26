#!/usr/bin/env bash
set -euo pipefail
# Isolate Deno's npm resolution from the React application's package.json.
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
cp "$root"/supabase/functions/pointage-enrollment-photo/{index.ts,handler.js,codec.ts,codec_test.ts} "$scratch/"
cd "$scratch"
npx --yes deno@2.9.6 check --node-modules-dir=auto --no-lock index.ts
npx --yes deno@2.9.6 test --node-modules-dir=auto --no-lock codec_test.ts
