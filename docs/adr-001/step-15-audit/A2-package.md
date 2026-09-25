# A2 — Published package & runtime environment: v2.56.0 (BASE) vs 2-dev `0855cd70f` (HEAD)

Scope: `npm pack` output, `package.json`, lockfile, runtime CommonJS shapes of the
entrypoint and of every shared `dist/` module, the shipped `bin`, Docker image,
CI / Node versions, tsconfig emit settings.

Method notes:
- Both tarballs made with `npm pack --ignore-scripts` (dist already built). Both
  are named `kuzzle-2.56.0.tgz` (the version was not bumped on HEAD); kept in
  `package-work/base/` and `package-work/head/`.
- Runtime shapes: every `.js` module present in both tarballs (238) was
  `require()`d on Node 24.11 with the four native addons that `--ignore-scripts`
  left unbuilt (`re2`, `kuzzle-espresso-logic-minimizer`, `boost-geospatial-index`,
  `dumpme`) stubbed (`package-work/stub.js`, `loadall.js`). All 238 loaded on both
  sides, with no load errors.
- Install behaviour: `npm install <tarball> --dry-run --ignore-scripts` into an
  empty project, on Node 20.18.0 and 22.13.0, with and without `--engine-strict`.
- Consumer type-check: a small consumer project (`package-work/x/c-{base,head}`)
  type-checked with `tsc` (HEAD's TypeScript) in several `esModuleInterop` /
  `skipLibCheck` combinations.

## Summary: top risks first

1. **P-01 — New runtime dependency `redlock-universal@0.8.5` declares `engines.node >=22.0.0`**,
   but Kuzzle still declares `>=20.0.0 <25.0.0`. With a default npm config this
   only prints an `EBADENGINE` warning. With `engine-strict=true` (in `.npmrc` or CI)
   the install **fails on every Node 20.x**. On BASE, 20.19+ installed cleanly under
   engine-strict (BASE's own blocker was `yargs@18`, which needs `^20.19.0`).
   So engine-strict users on Node 20.19–20.x can install BASE but not HEAD.
   The library does load under Node 20 (it ships a CJS build and CI still runs the
   unit tests on Node 20), so this is an install-time break, not a runtime one.
   Intended dependency (#2664, `cda3514b6`), but the engines conflict looks unintended.
2. **P-02 — The `dist/bin/start-kuzzle-server` CLI options now take effect.** This
   file is the Docker image's `CMD`. On BASE, `yargs()` parsed an empty argv, so
   `--mappings`, `--fixtures`, `--securities`, `--vault-key`, `--secrets-file` and
   `--enable-plugins` were silently ignored (checked: BASE's yargs returns `{_:[]}`
   whatever the arguments). On HEAD they are all applied (`700606662`, TD-84).
   Anyone whose container command or script passes these flags (for example left over
   from old docs) will see new behaviour at startup:
   - mappings, securities and fixtures now get imported;
   - `--enable-plugins X` now **crashes at boot** with `MODULE_NOT_FOUND`, because
     `bin/plugins/` is not in the package (the source says so and points to TD-84);
   - a flag given without a value (for example a bare `--vault-key`) now exits 1
     with `--vault-key expects a value`;
   - the "no administrator" warning now actually prints, through `app.log.warn`.

   Default `CMD` users, who pass no flags, are unaffected. Intended, but it is a
   behaviour change of a published entrypoint.
3. **P-03 — CommonJS shape changes of four deep modules.** A consumer that
   deep-requires any of these modules breaks:
   - `dist/lib/api/controllers/{admin,auth,security}Controller.js` went from
     `exports.default = Class` to `module.exports = Class` (`893210d84`). Code doing
     `require(".../adminController").default` now gets `undefined`.
   - `dist/lib/cluster/state.js` went the other way, from `module.exports = State`
     to `exports.default = State`.

   The barrel `dist/lib/api/controllers/index.js` changed too. On BASE it exposed
   `AdminController`, `AuthController` and `SecurityController` as module-namespace
   *objects*, so `new AdminController()` threw. On HEAD they are the classes.

   None of these modules is re-exported from `require("kuzzle")`, where
   `AuthController` is a function on both sides, and there are no `exports` in
   `package.json`, so these paths are reachable but undocumented.
4. **P-04 — Two files removed from the tarball.** Both were deep-importable, since
   there is no `exports` map:
   - `dist/lib/util/wildcard.{js,d.ts}`, deleted as dead code (`daa03a82b`);
   - `dist/lib/types/controllers/adminControlller.type.{js,d.ts}`, a typo fix renamed
     to `adminController.type` (`e73309478`), with no compatibility shim at the old
     path.

   Neither is referenced from `index` and neither appears in the docs. Low risk.
5. **The main entrypoint is additive only.** `require("kuzzle")` has 80 keys on BASE
   and 82 on HEAD. Nothing was removed or changed kind; the additions are
   `MutexLockLostError` (a class) and `withLock` (a function). Both sides are
   `__esModule: true` with no `default`. At the type level, the `kuzzle` module has
   258 exported names on BASE and 274 on HEAD, again with none removed or changed kind.

Everything else in `package.json` that matters to consumers is **unchanged**:
`main`, `types`, the `files` whitelist, `engines`, `engineStrict`, `packageManager`,
`directories`, and the absence of `bin`, `exports`, `os`/`cpu`, install-time scripts
and peer/optional dependencies. All other production lockfile entries resolve to
identical versions. The Docker directory and `docker-compose*.yml` are byte-identical.
tsconfig `target` is `es2020` on both sides, and no `tslib` is emitted.

## Differences

| id | what | BASE | HEAD | who is affected | breaking? | intended? | severity |
|---|---|---|---|---|---|---|---|
| P-01 | New prod dependency `redlock-universal` with `engines.node >=22.0.0`, conflicting with Kuzzle's `engines >=20.0.0 <25.0.0` | absent | `0.8.5` (ESM + CJS dual build; optional peers `ioredis`/`redis`/`@valkey/valkey-glide`) | Installers on Node 20.x with `engine-strict`: install fails (`EBADENGINE`, verified on 20.18 in a dry run). Everyone else on Node 20 gets a warning. | likely (engine-strict on Node 20.19+: BASE installs, HEAD does not) | dependency yes (#2664 `cda3514b6`); engines mismatch looks unintended | **High** |
| P-02 | `dist/bin/start-kuzzle-server` (Docker `CMD`): options actually parsed (`yargs(hideBin(argv))`); `--mappings` calls the method; `--securities` is split into roles/profiles/users; `--fixtures` is loaded through `admin:loadFixtures` after `start()`; a flag with no value throws; `--enable-plugins` now does a `require` that cannot resolve in dist; warning goes through `app.log.warn`; the file is now tsc output (not a raw copy) with a dangling `sourceMappingURL` | all six options silently ignored | all six options honoured | Users running the image or the file with any of those flags | likely (behaviour change; `--enable-plugins` now crashes at boot) | yes, `700606662` (TD-84) | **Medium** |
| P-03a | `dist/lib/api/controllers/{adminController,authController,securityController}.js` CommonJS shape | `exports.default = X` (+ `__esModule`) | `module.exports = X` | Deep `require(...).default` users; TS deep `import X from` users | yes (for deep-path users) | yes, `893210d84` | Low–Medium |
| P-03b | `dist/lib/cluster/state.js` CommonJS shape | `module.exports = State` | `exports.default = State` | Deep `require()` users | yes (for deep-path users) | incidental to the cluster conversion (step 8/12); no dedicated commit found | Low |
| P-03c | `dist/lib/api/controllers/index.js` barrel: `AdminController`, `AuthController`, `SecurityController` | module-namespace objects (BASE bug) | classes | Deep users of the barrel. The change fixes BASE, but `.default` access disappears | yes, narrowly | yes, `893210d84` | Low |
| P-04a | File removed: `dist/lib/util/wildcard.{js,d.ts}` | present (`match(pattern, list)`) | absent | Deep-path users only (not in `index`, not documented) | yes, narrowly | yes, `daa03a82b` | Low |
| P-04b | File renamed: `dist/lib/types/controllers/adminControlller.type.*` → `adminController.type.*` | triple-l name | double-l name (no shim) | Deep type imports of `ResetSecurityResult` by path | yes, narrowly (type-only) | yes, `e73309478` | Low |
| P-05 | Files added to the tarball (24): `cluster/protobuf/{command,sync}Messages`, `core/network/httpRouter/routeTypes`, `core/network/networkEntryPoint`, `core/validation/{specification,typeOptions,validationUtils,types/geoShapeUtils}`, `types/{ApiRoute,KuzzleWebSocket,PluginInstance}`, `types/config/cache/BaseCacheRedisConfiguration`, `util/distributedLock`, `types/controllers/adminController.type` (`.js` + `.d.ts` for each) | — | present | none | no | yes (migration) | Info |
| P-06 | Tarball size | 409,253 B packed / 2,143,800 B unpacked / 498 entries | 517,892 B / 2,514,200 B / 522 entries (+26.5% packed) | Download size only | no | yes (TS output and comments) | Info |
| P-07 | `kuzzle-sdk` range | `>=7.17.1` | `>=7.17.1 <8.0.0` (resolves to 7.17.1 on both sides; the latest on npm is 7.17.1) | Only a hypothetical future SDK 8 user, and `export * from "kuzzle-sdk"` makes the SDK part of the public API | no (narrowing; there is no 8.x) | yes, `44a83006d` (TD-01) | Info |
| P-08 | `kuzzle-vault` 2.1.0 → 2.2.0 | CBC only | adds `CryptonomiconCipher` / AES-256-GCM option; Kuzzle's `vault.load(..., useNewAlgorithm = false)` keeps CBC as the default | Users with `secrets.enc.json`: existing CBC files still decrypt by default. The error message changes to "…with the provided key or cipher". | no (default unchanged) | yes, `dcea521eb` / `449ebce0c` | Low |
| P-09 | `package.json` scripts (none run at install) | `build` runs `node ./bin/copy-binaries.js`; `prepublishOnly: npm run build` | `build` uses `ts-node/register/transpile-only ./bin/copy-binaries.ts`; `prepublishOnly` adds `./.ci/scripts/check-build-payload.sh`; mocha/c8 scripts removed; ratchet/typecheck scripts added | People building from source (Dockerfile builder stage installs devDeps, so fine) | no | yes (`0b145d581`, `389c2a07d`, `6fbb0ecd8`, step 13) | Info |
| P-10 | `dist/bin/copy-binaries.js` (shipped in `files`) | raw JS copied from `bin/`; copies `bin/start-kuzzle-server` | compiled from TS; copies `dist/bin/start-kuzzle-server.js` → `dist/bin/start-kuzzle-server` | Nobody at runtime (a build-time helper that happens to be packaged) | no | yes, `0b145d581` | Info |
| P-11 | devDependencies (not installed for consumers): removed mocha, sinon, should-sinon, rewire, mock-require, c8, @types/mocha; added eslint 10.10.0, prettier 3.9.7, ioredis-mock, ws, @types/{async,validator,yargs}; eslint-plugin-kuzzle 0.0.15 → 2.0.0 | — | — | Contributors only | no | yes (#2768, step 13) | Info |
| P-12 | tsconfig (build program) | `allowJs: true`; default lib for es2020; include covers tests/features/dev files; not `strict` | `strict: true`, `noUncheckedIndexedAccess: true`; `lib: ["es2022","dom","dom.iterable"]`; no `allowJs`; include is `lib/**/*.ts` + `index.ts` + 2 bin files. `target: es2020`, `module: commonjs`, `esModuleInterop: true` unchanged; no `importHelpers` on either side | Emitted JS now uses ES2022 **library** APIs: `.at(` ×7, `Object.hasOwn` ×2, `Error(msg, { cause })` ×1, and `structuredClone` ×7 (a Node global). BASE used none of these. All exist in Node ≥ 16.9/17, so they are safe for the declared `>=20`. No `tslib` require on either side. | no | yes (step 12 strict flip) | Info |
| P-13 | Emitted `.d.ts` references hand-written ambient declarations that are not shipped: `/// <reference types="lib/types/debug" />` in `dist/lib/util/debug.d.ts` and `dist/lib/core/network/context.d.ts`; `import("debug")` without types | none | 2 files | TS consumers with `skipLibCheck: false` that deep-import those files get TS2688 / TS7016. Through `import "kuzzle"` they are not reached. With `skipLibCheck: true` there are no errors. | no (only with `skipLibCheck: false` + deep import) | unknown (side effect of TD typings for `debug`) | Low |
| P-14 | Consumer type-check with `skipLibCheck: false`, `import "kuzzle"` | 42 errors in kuzzle's own d.ts (28× TS2304 "cannot find name", TS2451, TS2415, TS4113, 7× TS1259) | 0 errors in kuzzle's own d.ts when `esModuleInterop: true` (only upstream kuzzle-sdk/kuzzle-logger d.ts errors, identical on both sides); 27× TS1259 when `esModuleInterop: false` | TS consumers with strict lib checking | no (improvement; `esModuleInterop` was already required on BASE) | yes (migration) | Info |
| P-15 | CI Node matrix | lint + unit + functional + monkey on [20, 22, 24] | unit + functional + monkey on [20, 22, 24]; lint on the fixed `NODE_VERSION: "22"`; one job on Node 20; the undefined `NODE_LTS_ACTIVE_VERSION` was renamed to a defined `NODE_VERSION` | none (runtime coverage of Node 20 kept) | no | yes | Info |
| P-16 | `.ci/test-cluster-{7,8}.yml` | env as a list | env as a map (same values), plus the test-only `KUZZLE_TEST_CLUSTER_DROP_HEARTBEAT_EVERY` on one node, plus a 4th standalone node with `NODE_ENV=production` on port 17513 | none (test infra). Note: production code (`lib/cluster/publisher.ts`) now reads the new env var `KUZZLE_TEST_CLUSTER_DROP_HEARTBEAT_EVERY`; if a user set it, heartbeats would be dropped. | no | yes (`95def50b1`, #2785; TD-48) | Info |
| P-17 | Environment variables read by `lib/`, `bin/`, `index.ts` | — | adds `KUZZLE_TEST_CLUSTER_DROP_HEARTBEAT_EVERY` (lib) and `ATTEMPT_TIMEOUT` (`bin/wait-kuzzle.ts`, not shipped); none removed | none | no | yes | Info |

### Pre-existing issues found (same on both sides, not regressions)

- **Kuzzle cannot load on Node < 20.19 / < 22.12, although `engines` says `>=20.0.0`.**
  `uuid@13` is ESM-only and is `require()`d from `dist/lib/api/request/kuzzleRequest.js`.
  On Node 20.18.0 both BASE and HEAD fail with `ERR_REQUIRE_ESM`; Node 22.13 loads
  both. `yargs@18` / `yargs-parser@22` also declare `^20.19.0 || ^22.12.0 || >=23`.
  The effective floor is therefore 20.19 / 22.12 on both sides; HEAD adds P-01 on top
  (engines-only `>=22`).
- `lib/kuzzle/vault` computes the default secrets path from
  `__dirname.endsWith("/node_modules/kuzzle/lib/kuzzle")`, but the published layout is
  `.../kuzzle/dist/lib/kuzzle`, so the "KaaF" branch never matches on either side.
- `engineStrict: true` in `package.json` has been ignored since npm 3 on both sides.
  It gives no enforcement.
- The package version is still `2.56.0` on HEAD. A publish from HEAD without a bump
  would collide.

## Not checked / limits

- **Docker image build and run** were not executed (`docker build` of
  `docker/images/kuzzle/Dockerfile`). The Dockerfile and runner images are
  byte-identical on both sides, and HEAD's `npm run build` (the same command the
  builder stage runs) succeeds in the worktree, so the risk is low, but an actual
  container boot and `CMD` run was not verified.
- **Real install with native builds** (`npm install` without `--ignore-scripts`:
  `re2`, `zeromq`, `uWebSockets.js`, boost/espresso addons) was not done. Native deps
  and their versions are identical on both sides, so no delta is expected.
- **`redlock-universal` actually running on Node 20** (acquire/extend/release against
  a real Redis) was not exercised here. It loads on Node 20.18 (CJS build), and CI
  unit tests on Node 20 use `ioredis-mock`.
- Node 20.19.x was not available locally. The claim that engine-strict on 20.19+
  passes for BASE and fails for HEAD is inferred from the `engines` ranges (BASE's only
  blocker was `yargs` `^20.19.0`), not reproduced.
- Runtime shape comparison covers the top-level `module.exports` kind and own keys of
  each module. It does not cover the members or prototypes of exported classes, which
  belong to the API/types audits. `lib/api/httpRoutes.js` grew from 298 to 299 routes
  (one added, none removed by index count), and route content was left to the API
  audit.
- Config defaults / `.kuzzlerc` / `kuzzle_*` env-var mapping semantics: outside this
  surface. Only the set of `process.env.*` names was diffed (P-17).
- `.d.ts` API compatibility beyond export names and kinds (signatures, optionality
  under `strict` / `noUncheckedIndexedAccess`) is left to the types audit.
