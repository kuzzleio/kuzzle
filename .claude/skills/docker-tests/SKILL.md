---
name: docker-tests
description: Run Kuzzle's unit (vitest/mocha) or functional (cucumber) test suites entirely inside Docker, with no local Node.js/npm install required, including targeting a single feature file or tag for fast iteration. Use when the user asks to run/launch tests, unit tests, functional tests, or "les tests" for this repo, especially when they want it done "via Docker" or without setting up a local toolchain.
---

# Docker Tests

Runs Kuzzle's test suites using only Docker, via `.ci/scripts/docker-test.sh`.
Dependencies install, TypeScript build, and test execution all happen inside
the project's `kuzzle-runner` container images — the host only needs Docker.

## Unit tests

```bash
.ci/scripts/docker-test.sh unit vitest
.ci/scripts/docker-test.sh unit mocha
```

Each command runs `npm ci && npm run build && npm run test:unit:<suite>` inside
a one-off container based on the `node` service from `docker-compose.yml`
(`--no-deps`, so Elasticsearch/Redis are not started — unit tests don't need them).

## Functional tests

```bash
.ci/scripts/docker-test.sh functional http
.ci/scripts/docker-test.sh functional websocket
.ci/scripts/docker-test.sh functional legacy:http
.ci/scripts/docker-test.sh functional legacy:mqtt
.ci/scripts/docker-test.sh functional legacy:websocket

# Against Elasticsearch 8 instead of the default 7:
ES_VERSION=8 .ci/scripts/docker-test.sh functional websocket
```

This spins up the 3-node Kuzzle cluster + nginx + Elasticsearch + Redis defined
in `.ci/test-cluster-7.yml` (or `-8.yml`), waits for every node to be reachable,
then runs the matching `test:functional:*` npm script (Cucumber) inside a
container attached to that same cluster network — nothing runs on the host.

First run pulls the Elasticsearch image and can take a few minutes; subsequent
runs are faster. On failure, the last 200 lines of every service's logs are
printed automatically.

### Targeting a single feature file or tag

Running the whole suite for a quick iteration is slow. Pass extra Cucumber
args after `--` to target just what you're working on — they're forwarded
straight to `cucumber-js`, overriding the profile's default `paths`/`tags`:

```bash
.ci/scripts/docker-test.sh functional websocket -- features/api/document.feature
.ci/scripts/docker-test.sh functional http -- --tags "@security"
```

The cluster is still brought up fully (Cucumber needs a real Kuzzle to run
against); only the test selection is narrowed.

## Notes

- These commands are for local development. CI (`.github/workflows/pull_request.workflow.yaml`)
  runs unit tests directly on the runner and functional tests via
  `.ci/scripts/run-test-cluster.sh` — `docker-test.sh` is a local-only convenience
  wrapper and intentionally does not replace either.
- If a dev stack is already running (`docker compose up`), unit test runs are
  unaffected (`--no-deps`, separate one-off container).
