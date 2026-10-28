# Step 01 — Redact configuration secrets, protected Redis in CI, docs

**Status:** 🟦 In progress — PR under review · **Opened:** 2026-10-28 · **PR:** [#3085](https://github.com/kuzzleio/kuzzle/pull/3085) (base `2-dev`) · Back to the [hub](../ADR-0004-secrets-in-config.md)

## Goal

Apply the hub's Decision §1–§8 in one PR: one redaction function shared by `server:getConfig` and `admin:dump` (configuration and environment), the number-only `unstringify()` exemption for secrets, a password-protected Redis on the ES8 functional cluster, and the documentation of the ioredis `options` pass-through.

## Checklist

- [x] Unit (vitest, `tests/`): every rule name, both ways (`cookieAuthentication`, booleans, `null`, `requirePassword=false` stays boolean); nested objects; URL credentials; `Buffer` / array masked whole; `mappings.properties.token` untouched; input not mutated; `getConfig` masks Redis password, `tls.key`, ES `client.auth`, a plugin secret; `unstringify` keeps `password: "0123"` and still turns a non-secret `"42"` into `42`; dump has no `security` / `VAULT_KEY`, masked config and masked `env`.
- [x] Functional: `.ci/test-cluster-8.yml` Redis with `--requirepass`, `kuzzle_services__internalCache__options__password` and `…__memoryStorage__…` on the 3 nodes (cluster start proves main process + ID card worker authenticate); `.ci/test-cluster-7.yml` stays password-less; the `getConfig` `"***"` scenario restricted to ES8; check `.ci/scripts/run-monkey-tests.sh` reuses the cluster file without talking to Redis directly.
- [x] Docs: sample config (password, ACL, TLS, Sentinel); guide section (env-var example, worker limit, `getConfig` / dump redaction, core dump warning).
- [x] `pr-preflight`; open the ZeroMQ issue ([#3084](https://github.com/kuzzleio/kuzzle/issues/3084)).

## What was done

- `lib/util/redactSecrets.ts`: `isSecretKey()` (Decision §3), `redactSecrets()` (§4), `redactUrlCredentials()`, and `toPublicConfig()` — the `getConfig` removals (`http.routes`, `security`, `VAULT_KEY`) on a shallow copy, then the redaction.
- `server:getConfig` = JSON clone of `toPublicConfig(config)` (redaction first, so a `Buffer` key is masked whole).
- `admin:dump`: `kuzzle.json` holds `toPublicConfig(config)`; the whole `nodejs.json` object (not only `env`) goes through `redactSecrets()`, so URL credentials in `argv` are masked too.
- `unstringify()`: a string under a secret key skips the number conversion only.
- `.ci/test-cluster-8.yml`: `redis-server --requirepass "0123456789"`, both `…__options__password` variables in the shared `kuzzle-env` anchor (nodes 1–3 and `kuzzle_node_prod`). The leading zero makes the cluster start also prove the `unstringify()` exemption.
- `features/ServerController.feature`: `security` absent from `getConfig`; a new `@es8` scenario (reusing the existing `@es8` `Before` hook, which skips on an ES7 stack) checks both Redis passwords are `"***"`.
- Docs: `.kuzzlerc.sample.jsonc`, "Securing Redis" in `doc/2/guides/advanced/configuration/`, `server:getConfig` and `admin:dump` API pages.

## Local decisions / gotchas

- **`secretAccessKey` gap closed:** the hub's Context named it, but no §3 suffix matched it (nor `AWS_SECRET_ACCESS_KEY`). Maintainer decision (2026-10-28): `accesskey` and `access_key` suffixes added (Decision §3 + register); `accessKeyId` / `AWS_ACCESS_KEY_ID` still not secret, pinned by tests.
- **URL rule** requires `//` before `user:pass@` (`mailto:a@b` and `foo:bar@baz` are left alone) and a non-empty password.
- **Packaged defaults canary:** a unit test asserts `toPublicConfig(defaultConfig)` masks nothing — no false positive in Kuzzle's own defaults.
- **Not covered by the rule:** a secret nested inside a `*json:` environment value whose own name is not secret (e.g. `kuzzle_services__internalCache__options='*json:{"password":"…"}'`) stays readable in `nodejs.json` (it is masked in `kuzzle.json`). `.ci/services-8.yml` (the "build and run" stack) keeps a password-less Redis: out of the checklist.
- **Monkey tests:** `run-monkey-tests.sh` only reuses the cluster file; `kuzzleio/kuzzle-monkey-tests` has no Redis client dependency.
- **No `<SinceBadge>`** in the new guide section: the release version (patch or minor) is not known yet.

## Validation

- Unit suite in Docker (`.ci/scripts/docker-test.sh unit`): 167 files, 4 455 passed, 2 skipped. `pr-preflight`: all checks OK (lint 0 errors, error codes, ADR state, ratchets & test type-check, doc budgets). `npm run build` OK.
- Functional, ES8 websocket (`ES_VERSION=8 .ci/scripts/docker-test.sh functional websocket`): the cluster starts on the password-protected Redis (`redis-cli ping` answers `NOAUTH` without it), both `@es8` scenarios pass. Two local-only workarounds, neither in the PR: the Docker VM disk was >95 % full, so ES8 refused to allocate shards until a local `my_elasticsearch.yml` disabled the disk threshold; and `@network` / `Websocket.feature` reach `localhost:17510` / `localhost:7512`, which does not resolve from inside `docker-test.sh`'s container (pre-existing, unrelated). With `--tags "not @network"`: 164 scenarios, 162 passed, 1 failed (`Websocket.feature:5`, `ECONNREFUSED 127.0.0.1:7512`, same cause), 1 skipped by fail-fast. CI runs the suite from the host, where both resolve.
- Re-run after freeing Docker disk space, no workaround (2026-10-28, with the `accesskey` fix): `ES_VERSION=8 .ci/scripts/docker-test.sh functional websocket -- --tags "not @network and not @websocket"` → 162 scenarios, 162 passed.
