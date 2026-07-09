# AGENTS.md

Guidance for AI coding agents working in this repository. Humans should read
[CONTRIBUTING.md](./CONTRIBUTING.md) instead.

## What this is

Kuzzle is a generic backend server (Node.js/TypeScript). Source lives in `lib/`
(`api`, `cluster`, `config`, `core`, `kerror`, `kuzzle`, `model`, `service`,
`types`, `util`), the public entrypoint is `index.ts`, and it compiles to
`dist/` via `tsc`.

## Build & run

```bash
npm run build      # tsc -> dist/
npm run dev        # tsx watch start-kuzzle-dev.ts (requires ES + Redis, see docker-compose.yml)
```

Local dev stack (Elasticsearch, Redis, Kuzzle with hot reload):
`docker compose up` (ES8) or `docker compose -f docker-compose.yml up` (ES7).

## Tests — always run these before considering a change done

```bash
npm run test:lint          # eslint ./lib ./test ./bin ./features
npm run test:unit:vitest   # unit tests under tests/
npm run test:unit:mocha    # unit tests under test/ (needs `npm run build` first)
```

Functional tests (Cucumber) need a running Kuzzle cluster:
```bash
ES_VERSION=8 KUZZLE_FUNCTIONAL_TESTS="test:functional:websocket" ./.ci/scripts/run-test-cluster.sh
```

**Prefer the Docker-only path** — no local Node/ES/Redis setup needed, see the
`docker-tests` skill or run directly:
```bash
.ci/scripts/docker-test.sh unit vitest
.ci/scripts/docker-test.sh unit mocha
.ci/scripts/docker-test.sh functional websocket   # or http, legacy:http, legacy:mqtt, legacy:websocket
```

A PR without corresponding unit/functional test coverage will not be accepted
(see CONTRIBUTING.md) — do not skip writing tests for behavior changes.

Before pushing, run the `pr-preflight` skill (`.ci/scripts/pr-preflight.sh`):
lint + error-codes doc sync + a test-coverage reminder, mirroring the CI checks
most likely to fail on a first push.

## Code style

- ESLint config: `.eslintrc.json` (`eslint-plugin-kuzzle`, stricter TS ruleset for `*.ts`).
- Prettier: `.prettierrc` (semicolons on).
- Async/await or promises over callbacks — **except** for code invoked before
  the funnel module (network connection handling), which must use callbacks
  to avoid event loop saturation.
- Follow KISS and the Boy Scout Rule; keep changes minimal and self-documented
  (see [CONTRIBUTING.md](./CONTRIBUTING.md) for the full rationale).

## Key config files

- `.kuzzlerc.sample.jsonc` — full annotated config reference.
- `docker-compose.yml` + `docker-compose.override.yml` — local dev stack (ES7 vs ES8).
- `.ci/test-cluster-7.yml` / `.ci/test-cluster-8.yml` — 3-node cluster used by functional tests.
- `cucumber.config.cjs` — functional test profiles (http/websocket/mqtt, legacy vs current).
- `vitest.config.ts` / `.mocharc.json` — unit test runners (two suites coexist during migration).

## Things to know before making changes

- Two unit test frameworks are active side by side (`test/` → mocha,
  `tests/` → vitest). Check which directory your change belongs to; don't move
  tests between them as part of an unrelated change.
- `test:unit:mocha` runs against **compiled** output (`dist/test/**/*.test.js`)
  — rebuild (`npm run build`) after editing source or tests before running it.
- Error codes are documented and checked: `npm run doc-error-codes` and
  `.ci/scripts/check-error-codes-documentation.sh`. New error codes need docs.
- Don't commit changes to `dist/`, `coverage/`, or `node_modules/`.
