#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
cp "$root"/supabase/functions/admin-mfa-recovery/{index.ts,handler.js} "$scratch/"
cd "$scratch"
npx --yes deno@2.9.6 check --node-modules-dir=auto --no-lock index.ts
