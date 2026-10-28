# ADR-0004: Securing Redis access and keeping configuration secrets out of public outputs

**Status:** Accepted (2026-10-13)
**Date:** 2026-10-13
**Deciders:** Kuzzle core team (Ricky — nriquelmebareiro@kuzzle.io)
**Scope:** how Kuzzle connects to a protected Redis (`services.internalCache`, `services.memoryStorage`, the ID card worker), how configuration secrets are read from the environment (`lib/config/index.ts`), and every place the configuration leaves the process (`server:getConfig`, `admin:dump`)
**Related documents:** step files under [`steps/`](steps/) · [v3 breaking changes](../v3-breaking-changes.md) (no row: this is a security fix)

> Living hub (structure per the `kuzzle-adr` skill). To resume, read **Cold start**.

---

## Decision

### Context

Measured on `2-dev` (2026-10-13, commit `0517dc929`):

- **Redis authentication already works, undocumented.** The `options` block of `services.internalCache` / `services.memoryStorage` is handed to ioredis as-is: `new IORedis({ ...node, ...options })` for a single server (`lib/service/cache/redis.ts:332`), `redisOptions: config.options` for a cluster (`redis.ts:130`). `password`, `username` + `password` (Redis 6+ ACL), `tls` and `sentinelPassword` therefore work without code. The ID card worker receives `services.internalCache` (`lib/cluster/idCardHandler.ts:225-234`) and builds the same `Redis` class (`lib/cluster/workers/IDCardRenewer.ts:132`). No issue, PR or doc mentions it; dev and CI stacks run a password-less Redis.
- **`server:getConfig` leaks secrets.** `serverController.ts:129-144` strips `http.routes`, `security` and `VAULT_KEY` only. Redis passwords, TLS private keys and passphrases, Elasticsearch `client.auth` / `tls` / `ssl`, credentials embedded in a node URL (`https://user:pass@host`), plugin secrets (e.g. OAuth client secrets) and application config are returned in clear. Reachable by `admin` and by any custom role granting `server: { "*": true }`.
- **`admin:dump` leaks more than the config.** `lib/kuzzle/dumpGenerator.ts` writes `global.kuzzle.config` in clear **without** the `getConfig` removals (so `security.*` secrets and `VAULT_KEY` too), and writes `process.env` in clear in `nodejs.json` — where a password set through `kuzzle_…` environment variables lands. It also writes a core dump (`gcore`): the whole process memory, which no redaction can clean. Dumps routinely end up attached to support tickets.
- **An environment-variable secret can be altered.** `unstringify()` (`lib/config/index.ts:103-135`) turns `"0123"` into `123` (authentication fails), loses precision past 2^53, and turns `"true"` / `"false"` into booleans. The only workaround is `*json:"0123"`.
- **Worker limit.** `fork()` uses JSON serialization: a `Buffer` set from code reaches the worker as `{ type, data }`, and functions (e.g. an ioredis `retryStrategy`) are dropped. PEM text works.
- **Pitfalls found while reviewing the first plan** (applying a name-based rule to the default config): `plugins.kuzzle-plugin-auth-passport-local.requirePassword` ends with `password` but is a boolean switch; `internalIndex.collections.api-keys.mappings.properties.token` is a mapping, not a secret; `secretAccessKey`, `privateKey`, `signingKey`, `encryptionKey` and `VAULT_KEY` end with `key` and escape a suffix list built on `secret` / `password`; `getConfig` deep-clones through JSON first, so a `Buffer` key becomes `{ type, data: [...] }` and masking its leaves would leave `data` readable.

### Decision

**Kuzzle supports a protected Redis through the existing `options` pass-through, documented and tested; every configuration that leaves the process goes through one redaction function, driven by a generic key-name rule.**

1. **No new Redis feature.** Password, ACL user, TLS and Sentinel stay plain ioredis `options`. They are documented (`.kuzzlerc.sample.jsonc`, a "Securing Redis" section of the configuration guide) and proven by the functional cluster.
2. **One "public config" function** (`lib/util/redactSecrets.ts`): applies today's `getConfig` removals (`http.routes`, `security`, `VAULT_KEY`) then the redaction. `server:getConfig` and `admin:dump` both use it, so they can no longer drift apart.
3. **Generic key-name rule, not a list of paths** — a fixed list would always miss plugins and application config. `isSecretKey(name)`, case-insensitive: exact `key`, `pfx`, `auth`; or a name ending with `password`, `passphrase`, `secret`, `apikey`, `token`, `credentials`, `privatekey`, `secretkey`, `signingkey`, `encryptionkey`, `accesskey`, `access_key`, `vault_key`. `cookieAuthentication` does not match by construction.
4. **Redaction semantics.** A value under a secret key becomes `"***"`, the field is kept; `null`, `undefined` and booleans are left as-is, so one can still see whether a secret is set. A plain object under a secret key (`auth: { username, password }`) keeps its structure with its leaves masked; any other value — `Buffer`, array — is masked whole. Redaction runs **before** any JSON clone. In every string, URL credentials `user:pass@` become `user:***@`. `mappings` subtrees are never redacted. The input is never mutated.
5. **The dump redacts its environment too.** `nodejs.json` masks `process.env` entries with the same rule (`kuzzle_…__password` matches by name). The core dump cannot be redacted: the documentation says a full dump is never attached to a ticket as-is.
6. **Environment secrets keep their text form, numbers only.** For a secret key, `unstringify()` skips the number conversion and nothing else: `"0123"` stays `"0123"`, while `"true"` / `"false"` and `*json:` keep working — `requirePassword=false` stays a boolean. Not breaking: ioredis and the Elasticsearch client stringify passwords anyway.
7. **Security fix, not a breaking change.** No row in `docs/v3-breaking-changes.md`. A tool that read a secret back through `getConfig` stops working — that tool was the leak.
8. **Worker limit documented, not fixed:** prefer PEM text over `Buffer`, no functions in options the worker needs.

**Out of scope:** a startup warning for a password-less Redis (a private network without one is a legitimate choice — deferred); ZeroMQ between cluster nodes, neither authenticated nor encrypted (separate issue, to be opened with step 01's PR).

### Rejected alternatives

- **A fixed list of secret paths** — precise for Kuzzle's own config, blind to plugins and application config.
- **Removing secret fields** instead of masking them — loses the "is it configured?" signal that support relies on.
- **Keeping every secret-key value as text in `unstringify()`** (first plan) — inverts `requirePassword=false`, a boolean whose name ends with `password`.
- **Masking only `kuzzle.json` in the dump** (first plan) — the environment-variable path the documentation recommends would still leak through `nodejs.json`, and `VAULT_KEY` / `security` through `kuzzle.json`.
- **Fixing `Buffer` / function transfer to the worker** (`serialization: "advanced"` or a hand-made codec) — real but rare need; documented for now.

### Consequences

- `getConfig` and the dump output change shape for secret fields (`"***"`); documented in the configuration guide.
- False positives are possible (a harmless key named `key`); accepted, and the rule is pinned by unit tests both ways.
- The functional cluster runs Redis with a password on the ES8 stack and without on the ES7 stack: both paths stay covered by the existing matrix.
- No new error code.

---

## Cold start

**Where we are (2026-10-28):** step 01 **in progress** — implemented on branch `feat/adr-0004-step-01-redact-secrets` (base `2-dev`), not pushed yet: redaction shared by `getConfig` and the dump, number-only `unstringify` exemption, password-protected Redis on the ES8 functional cluster, docs. Detail and gotchas in [step 01](steps/01-redact-secrets.md).

**Next action:** maintainer review of the step 01 branch, then push, open the PR and the ZeroMQ issue (both drafted in the step's hand-off).

**Conventions** (same as ADR-0001 / 0003): base branch `2-dev`; non-breaking only in v2; unit tests in Docker; Claude cannot merge — it hands the maintainer `!` commands.

---

## Step table

| # | Step | Status | PR(s) | Detail |
| --- | --- | --- | --- | --- |
| 01 | `redactSecrets` + public-config function; `getConfig` and dump (config + env) redacted; number-only `unstringify` exemption; unit tests; Redis `--requirepass` on the ES8 functional cluster; `.kuzzlerc.sample.jsonc` + "Securing Redis" guide | 🟦 In progress | — | [detail](steps/01-redact-secrets.md) |

---

## Decision register

- **2026-10-13** — **Redis auth = documented ioredis `options` pass-through**, no new feature.
- **2026-10-13** — **Generic key-name redaction rule**, not a list of paths; values become `"***"`, fields kept, `null` / booleans untouched.
- **2026-10-13** — **One public-config function shared by `getConfig` and the dump**; the dump also redacts `process.env`.
- **2026-10-13** — **`unstringify()` exemption for secret keys covers number conversion only.**
- **2026-10-13** — **`mappings` subtrees never redacted; `…privatekey`, `…secretkey`, `…signingkey`, `…encryptionkey`, `vault_key` added to the rule.**
- **2026-10-13** — **Redaction before any JSON clone; non-plain-object secret values masked whole.**
- **2026-10-13** — **Security fix, no v3 breaking-change row.**
- **2026-10-13** — **Worker `Buffer` / function limit documented, not fixed.**
- **2026-10-28** — **`…accesskey`, `…access_key` added to the rule** (step 01): `secretAccessKey` and `AWS_SECRET_ACCESS_KEY`, named in the Context, matched no suffix.
- **2026-10-13** — **Out of scope:** password-less startup warning (deferred); ZeroMQ inter-node security (separate issue).

---

## Open points

- Core dump: documented only. Whether `admin:dump` should offer a config-only mode without `gcore` for support tickets.
- Password-less Redis startup warning: deferred, revisit if support sees exposed instances.

---

## References

- `lib/service/cache/redis.ts` — ioredis client construction (l. 130, 332)
- `lib/cluster/idCardHandler.ts`, `lib/cluster/workers/IDCardRenewer.ts` — worker config transfer and Redis client
- `lib/api/controllers/serverController.ts` — `getConfig`
- `lib/kuzzle/dumpGenerator.ts` — `kuzzle.json`, `nodejs.json`, core dump
- `lib/config/index.ts` — `unstringify()`
- `.ci/test-cluster-7.yml`, `.ci/test-cluster-8.yml`, `features/ServerController.feature`
