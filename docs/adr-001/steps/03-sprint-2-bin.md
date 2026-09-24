# Step 03 — Sprint 2: `bin/`

**Status:** ✅ Done — `js` 5 → 3, the last Definition-of-Done box of [ADR-0001](../ADR-0001-migration-typescript.md)
**Date:** 2026-07-12 → deprioritized 2026-07-15 → closed 2026-09-24
**PR(s):** #2671 (dead-code removal) · #2872 (the two entrypoints)
**Hub:** [ADR-0001](../ADR-0001-migration-typescript.md)

## Goal

Clear the dead weight out of `bin/` and convert the real entrypoints, so the JS
ratchet tracks only production code.

## What was done

- **#2671 — dead code.** Removed `bin/.upgrades/**` + `bin/.lib/colorOutput.js`
  (~12 files), unreferenced since 2023, with no npm `bin` field. Deleted, not
  migrated.
- **#2872 — the two entrypoints**, `bin/start-kuzzle-server` and
  `bin/wait-kuzzle`. See _[What the conversion found](#what-the-conversion-found)_:
  the second of the two was a faithful port, the first was not, and could not be.

## Deprioritized (2026-07-15), resumed (2026-09-24)

Converting the real entrypoints was deprioritized while the effort focused on
`lib/`, which carried the real typing risk. It was resumed once `lib/` was done
([step 11](11-sprint-8-cluster.md)) and `strict` was on in the build
([step 12](12-sprint-9-strict-flip.md)) — at which point these two files were
the only thing between ADR-0001 and its Definition of Done.

- `bin/plugins/available/*` are **test fixtures** loaded as JS at runtime by the
  functional tests → excluded from the DoD, and the `js` ratchet's floor.

## Scope decision — the fixtures are out of the DoD (2026-09-09)

The mid-course review ([step 06](06-hardening-mid-course.md)) checked what the
`js` counter still held under `bin/`. The files under `bin/plugins/available/**`
(`functional-test-plugin`, `kuzzle-plugin-cluster/lib`) are **plugin fixtures
used by the functional suites**, not product code, and converting them would
exercise the plugin-authoring surface rather than the server.

**Decision:** the ADR's "0 `.js` in `bin/`" targets `bin/` proper. The fixtures
are excluded from the Definition of Done; the `js` ratchet keeps counting them,
so the floor is **3**, which is where this step leaves it.

⚠️ **The count was wrong for two months, and [TD-45](../type-debt-register.md#td-45)
is why.** This file said "the final target is `js = 4`" — read off a ratchet whose
predicate was `-name '*.js'`, which cannot see an extensionless executable.
`start-kuzzle-server` and `wait-kuzzle` were never in the number. Once the
predicate learned to read shebangs the floor became 5, and this step is what takes
it to 3.

## Where each file went

| File | Now | Program | Why |
| --- | --- | --- | --- |
| `bin/start-kuzzle-server` | `bin/start-kuzzle-server.ts` | **production** (`tsconfig.json`) | It is the published entrypoint: `dist/bin/start-kuzzle-server` is in `package.json`'s `files` and is the Docker image's `CMD`. |
| `bin/wait-kuzzle` | `bin/wait-kuzzle.ts` | **tests, strict** (`tsconfig.tests.json`) | CI tooling, run by `.ci/scripts/**`, shipped nowhere — the same family as `.ci/scripts/**` and `scripts/**`, which [step 14](14-test-program-strict.md)'s M0 put there. |

**The published path does not change.** `tsc` now emits
`dist/bin/start-kuzzle-server.js`, and `bin/copy-binaries.ts` — which already
existed to copy in what the compiler does not — gives it the extensionless,
executable name the container and the package promise. Renaming the artifact was
the alternative, and it would have changed a path that is in `files`, in the
`Dockerfile` and in the documentation, for no gain.

`wait-kuzzle` is run through `ts-node/register/transpile-only`, the idiom
`.ci/test-cluster-*.yml` already uses for `start-kuzzle-test.ts`, from a
`WAIT_KUZZLE` / `wait_kuzzle` array defined once per script.

⚠️ **Its fourteenth call site is in `.github/actions/build-and-run-kuzzle`, and
it ran after `npm prune --omit=dev`** — which removes `ts-node`. The first push
went red there, on a step no local check reaches. The prune now runs *after* the
readiness check: it was never a prerequisite of it, because the image under test
is built from source by `.ci/services-*.yml` and does not read this tree's
`node_modules` at all. _A grep for call sites has to include the workflow files,
and a call site's environment is part of the call site._

## What the conversion found

**`bin/wait-kuzzle` was a faithful port** — an `unknown` catch variable, two
`Number.parseInt`s and a `NodeJS.Timeout`. It had been rewritten recently, with
types in its JSDoc, and it held.

**`bin/start-kuzzle-server` produced nine errors on its first compile, and four
of them were behaviours.** They are [TD-84](../type-debt-register.md#td-84),
🔴, in full. The summary:

1. **Nothing parsed the command line.** `yargs()` with no argument parses an
   *empty* argument list, so **all six options** — `--fixtures`, `--mappings`,
   `--securities`, `--vault-key`, `--secrets-file`, `--enable-plugins` — were
   declared, documented in `--help`, and read off an object that never carried
   them. The compiler did not find this one; it is what the *runtime* said once
   the other four were fixed and the options still did nothing.
2. **`app.import.mappings = json` replaced the method with a plain object.**
   `BackendImport` exposes methods; the assignment silently disabled the one it
   was meant to call.
3. **`app.import.fixtures` and `app.import.securities` do not exist.** The
   assignments created properties nothing reads.
4. **The "no administrator user" warning could never print**, and would have
   thrown if it had: `searchUsers` answers a count in `total`, so
   `admins.length === 0` was `undefined === 0`; and `app.log` is a `Logger`,
   not a function.

⚠️ **The generalisable part, and it is the step's whole point:** _a file outside
every program is not "still JavaScript", it is unchecked._ `tsconfig.json`'s
`include` named `bin/start-kuzzle-server` — it had said so since sprint 0 — and
`tsc` skipped it in silence, because it only picks up the extensions it knows and
that file had none. The strict flip of [step 12](12-sprint-9-strict-flip.md) went
over it too. Four defects in ninety lines, in the entrypoint of the published
image, survived every check this ADR built.

## Validation

- `npm run build` + `.ci/scripts/check-build-payload.sh` green;
  `dist/bin/start-kuzzle-server` present, executable, shebang intact.
- **The image, not just the compiler.** `docker build -f
  docker/images/kuzzle/Dockerfile` then a boot against Elasticsearch 7 + Redis:
  the node reaches `Kuzzle 2.56.0 is ready`, and `--mappings`, `--securities`
  and `--fixtures` land in storage.

  ⚠️ **CI builds that image and boots it** — `Build and Run (kuzzle, 7|8)`,
  through `.ci/services-*.yml` — so the startup path was always gated, which is
  why TD-84 was silent rather than red. What no job exercises is the entrypoint
  **with an option**: that job passes none. _A job that proves a binary starts
  proves nothing about the arguments it accepts._
- `npm run typecheck:tests`, `npm run ratchet` (`js` 3 = new baseline),
  `npm run test:lint`, `npx prettier --check` green.
- The functional suites exercise `bin/wait-kuzzle.ts` on every run: it is what
  `.ci/scripts/run-test-cluster.sh` waits on before cucumber starts.
