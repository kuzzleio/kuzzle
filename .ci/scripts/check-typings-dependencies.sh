#!/usr/bin/env bash
#
# The published typings must resolve with Kuzzle's PRODUCTION dependencies only.
#
# A `.d.ts` under `dist/` that imports a package whose types Kuzzle keeps in
# `devDependencies` (`@types/bluebird`, `@types/passport` did) compiles here,
# where dev dependencies are installed, and in every consumer that sets
# `skipLibCheck` — but a consumer with `skipLibCheck: false` and `strict` (the
# TypeScript 6 default) gets `TS7016` inside Kuzzle's own declarations.
# `npm run typecheck:typings` cannot see it: it runs in this repository.
#
# So: pack the build, install the tarball in an empty project as a consumer
# would, compile against it without `skipLibCheck`, and fail on any error
# located in Kuzzle's own declarations. Errors in other packages' declarations
# (kuzzle-sdk, kuzzle-logger) are not Kuzzle's typings and are ignored here.
#
# Needs `npm run build` first, and network access to the npm registry.

set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

cd "$root"
npm pack --ignore-scripts --pack-destination "$work" >/dev/null

mkdir "$work/consumer"
cd "$work/consumer"
npm init -y >/dev/null
typescript_version="$(node -p "require('$root/node_modules/typescript/package.json').version")"
npm install --ignore-scripts --no-audit --no-fund \
  "$work"/kuzzle-*.tgz "typescript@$typescript_version" "@types/node@20" >/dev/null

cat > index.ts <<'TS'
import { Backend, KuzzleRequest } from "kuzzle";

const app = new Backend("consumer");

app.controller.register("greeting", {
  actions: {
    sayHello: {
      handler: async (request: KuzzleRequest) =>
        `Hello ${request.getString("name")}`,
    },
  },
});
TS

cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": false,
    "noEmit": true,
    "types": ["node"]
  },
  "files": ["index.ts"]
}
JSON

errors="$(npx tsc -p . | grep -E '^(index\.ts|node_modules/kuzzle/)' || true)"

if [ -n "$errors" ]; then
  echo "$errors"
  echo
  echo "❌ Kuzzle's published typings do not compile with its production"
  echo "   dependencies only: a type package a .d.ts needs is probably in"
  echo "   devDependencies instead of dependencies."
  exit 1
fi

echo "✅ published typings compile with production dependencies only."
