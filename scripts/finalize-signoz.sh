#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required." >&2
  exit 1
fi

if ! command -v foundryctl >/dev/null 2>&1; then
  echo "foundryctl is required. Install it from the official SigNoz Foundry guide." >&2
  exit 1
fi

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( node_major < 20 )); then
  echo "Node.js 20+ is required; found $(node --version)." >&2
  exit 1
fi

echo "[1/4] Resolving dependencies and refreshing package-lock.json"
npm install

echo "[2/4] Building every workspace"
npm run build

echo "[3/4] Validating the SigNoz Foundry casting"
foundryctl gauge -f casting.yaml

echo "[4/4] Generating casting.yaml.lock and rendered output"
rm -rf pours
foundryctl forge -f casting.yaml

test -f package-lock.json
test -f casting.yaml.lock

echo
echo "SigNoz finalization passed. Review and commit:"
echo "  package-lock.json"
echo "  casting.yaml.lock"
echo
echo "Then start SigNoz with:"
echo "  foundryctl cast -f casting.yaml"
