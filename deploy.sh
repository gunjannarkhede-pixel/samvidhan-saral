#!/usr/bin/env bash
#
# Deploy Samvidhan Saral to Netlify.
#
# Two things this script does not do for you, both of which Netlify needs:
#
#   * run on Linux or macOS (or WSL on Windows).  The database driver is a native
#     module; a build made on Windows produces a Windows binary that Netlify's
#     Linux functions cannot load.  On Windows, use the Git route in
#     DEPLOY-NETLIFY.md instead — then Netlify builds it on Linux for you.
#
#   * log in.  It will offer to, the first time.
#
# Usage:  bash deploy.sh
#
set -euo pipefail
cd "$(dirname "$0")"

case "$(uname -s)" in
  Linux|Darwin) ;;
  *) echo "This script builds the native database driver, so it must run on"
     echo "Linux, macOS or WSL.  On plain Windows, deploy through Git instead —"
     echo "see DEPLOY-NETLIFY.md, Option A: Netlify then builds it on Linux."; exit 1 ;;
esac

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required (version 20 or newer)."; exit 1
fi
node -e 'const major = Number(process.versions.node.split(".")[0]);
  if (major < 20) { console.error(`Node.js 20 or newer is required (found ${process.version}).`); process.exit(1); }'

echo "== 1/3  dependencies =="
if [ -d node_modules ] && [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

echo
echo "== 2/3  build and check =="
echo "   (builds the standalone bundle the Netlify runtime consumes, and checks"
echo "    the tracing root, the node_modules mapping, the database and every"
echo "    API route's traced files)"
npm run verify:netlify

echo
echo "== 3/3  deploy =="
if ! npx --yes netlify-cli@latest status >/dev/null 2>&1; then
  echo "   not linked to a Netlify site yet:"
  npx --yes netlify-cli@latest login
  npx --yes netlify-cli@latest init
fi
npx --yes netlify-cli@latest deploy --prod

echo
echo "Done.  Open the URL printed above, then check:"
echo "  /status      data version and row counts"
echo "  /ask         the assistant, in English, हिंदी and मराठी"
