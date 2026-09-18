# Lessons — ADR-0001

> Index of the *generalisable parts* recorded across [ADR-0001](ADR-0001-migration-typescript.md), the
> [type-debt register](type-debt-register.md) and the [steps](steps/). The register holds the evidence for each one; this
> file exists so that a lesson can be **found** — 1 100 lines of register is where a lesson goes to be forgotten, which is
> [TD-46](type-debt-register.md#td-46)'s finding applied to the document that recorded it.
>
> **The column that matters is the last one.** A lesson with a mechanism cannot be broken again without CI saying so. A
> lesson that is prose will be broken again — [TD-40](type-debt-register.md#td-40) → [TD-56](type-debt-register.md#td-56)
> took two sprints, and [TD-46](type-debt-register.md#td-46) was broken twenty lines from where it had just been written
> down. So the prose rows are not an archive: they are **the backlog of what to gate next**.
>
> Maintained with the register — a review that files a finding with a *generalisable part* adds its row here.

**Legend:** 🔒 enforced (a gate fails) · 📄 written where it is read (ADR standards / CONTRIBUTING / a lint rule set to
warn) · 📝 prose only — recorded, not enforced.

## Enforcement & tooling

| Lesson | From | Enforced by |
|---|---|---|
| *An exclusion list is a ratchet or it is debt.* | [TD-23](type-debt-register.md#td-23) | 🔒 `cpd-exclusions` ratchet — the only one comparing a **set**, so an entry cannot be swapped for another |
| *A ratchet measures its predicate, not its label.* | [TD-45](type-debt-register.md#td-45) | 🔒 `js` predicate rewritten (floor 5, not 3); `casts` parses the AST instead of grepping |
| *A ratchet that greps counts English.* | [ADR log, 2026-09-15](ADR-0001-migration-typescript.md#decision-register) | 🔒 `scripts/count-casts.ts` — `ts.createSourceFile`, counts nodes not lines |
| *A finding that counts its own instances has already chosen a predicate, and the predicate is the finding.* | [ADR log, 2026-09-14](ADR-0001-migration-typescript.md#decision-register) | 📝 — re-derive the count before trusting a filed one ([TD-43](type-debt-register.md#td-43): filed 16, actual 87) |
| *A check that reads its verdict out of another process's stdout has to prove that process ran.* | [TD-44](type-debt-register.md#td-44) | 🔒 `strict-check.sh` fails closed; `--count` inherits the same guards and refuses to print `0` for a path tsc never saw |
| *An aggregate threshold prices the block and says nothing about its worst member.* | [TD-42](type-debt-register.md#td-42) | 🔒 per-file coverage gate + `.migration/coverage-exempt.txt` |
| *A block that lands under the threshold is telling you which file is not really tested.* | [step 09](steps/09-sprint-6-core-ii.md) | 🔒 same gate — read the exemption list as a to-do, not a waiver |
| *A coverage number is the output of a merge, and a merge is a claim about what two measurements have in common.* | [TD-50](type-debt-register.md#td-50) | 🔒 `merge-coverage.ts` re-derives c8's lcov before `prepare-coverage.ts` |
| *A risk you name in a decision record is a risk you should gate in CI.* | [TD-35](type-debt-register.md#td-35) | 🔒 `check-build-payload.sh` |
| *Gate the artifact, not a rehearsal of it.* | [TD-36](type-debt-register.md#td-36) | 🔒 the payload gate reads the **published** tarball, not the `dist/` a prior step built |
| *A check that repeats a promise by hand is a second thing to maintain, and it drifts silently — in the direction of passing.* | [TD-37](type-debt-register.md#td-37) | 🔒 the gate derives its path list from `package.json`'s `files` |
| *A job's `if:` is inherited by everything downstream of it.* | [TD-38](type-debt-register.md#td-38) | 📄 workflow restructured — nothing prevents the next conditional mid-chain job |
| *A tool's scope is a glob written once and never revisited, while the tree it was written for is the one the migration is moving away from.* | [TD-39](type-debt-register.md#td-39) | 🔒 lint + prettier now cover `tests/` |
| *A diff-based check names a base branch, and a base branch is a fact about the project, not about git.* | [TD-60](type-debt-register.md#td-60) | 🔒 `pr-preflight.sh` bases on `2-dev`, `PREFLIGHT_BASE` to override |
| *A check that answers "is this ready?" must read the state it is asked about, not the state it was easiest to diff.* | [TD-66](type-debt-register.md#td-66) | 📝 open ([#2774](https://github.com/kuzzleio/kuzzle/issues/2774)) — same script as [TD-60](type-debt-register.md#td-60), wrong **range** rather than wrong base |
| *A decision recorded only in a decision log is a decision the next author will not read.* | [TD-61](type-debt-register.md#td-61) | 📄 this file, plus the rule itself in ADR § Conversion standards and CONTRIBUTING |
| *A review finding is a rule, not an anecdote.* | [TD-46](type-debt-register.md#td-46) | 📄 this file is the mechanism such as it is; the failure mode is a rule written in a PR body and broken in the same PR |

## Typing

| Lesson | From | Enforced by |
|---|---|---|
| *A conversion that compiles is not a conversion that checks.* | [TD-54](type-debt-register.md#td-54) | 📄 the strict-count DoD — ADR § Conversion standards, CONTRIBUTING, and a `pr-preflight` reminder ([TD-61](type-debt-register.md#td-61)) |
| *A ratchet measures the file it names, but a type can make a file unmeasurable from the outside* — true, and over-applied. | [TD-53](type-debt-register.md#td-53) / corrected by [TD-54](type-debt-register.md#td-54) | 📝 open ([#2756](https://github.com/kuzzleio/kuzzle/issues/2756)) — 14 of 246 errors were the config shape, not all of them |
| *A ratchet a file is exempt from cannot catch the defect it exists for.* | [TD-56](type-debt-register.md#td-56) | 🔒 `strict-check.sh` fails on `TS2366` / `TS2322: Type 'undefined'` over the **whole** program, adopted or not |
| *The narrow version of a gate is the one that ships.* | [TD-62](type-debt-register.md#td-62) | 📄 the same gate — filed as "no `undefined` assigned to a non-nullable" it cost 3 fixes; as "no lying declarations" it would have stalled on 59 |
| *"No cast" is a proxy for "no unchecked claim", and a wrong return type is the same claim made more quietly.* | [TD-40](type-debt-register.md#td-40) | 🔒 via [TD-56](type-debt-register.md#td-56)'s gate for the `undefined` spelling; the `null` spelling is [TD-62](type-debt-register.md#td-62), 56 sites open |
| *A declaration is only load-bearing once every caller is typed against it.* | [TD-34](type-debt-register.md#td-34) | 📄 `any` + `casts` ratchets charge for the call-site hatch, but not for the specific pattern |
| *Widening a parameter to make a call site compile is not the same as supporting that call.* | [TD-41](type-debt-register.md#td-41) | 📝 |
| *A boolean-returning validator that every caller follows with a property read is a type guard that has not been declared yet.* | [step 09](steps/09-sprint-6-core-ii.md) | 📝 — free to fix at conversion time |
| *A JSDoc type in an unconverted file is not a type, it is a name lookup in that file's scope.* | [step 09](steps/09-sprint-6-core-ii.md), again in [step 11](steps/11-sprint-8-cluster.md) | 📝 — check what the name resolves to before inferring from it; J1 found `@param {Buffer}` over a `Uint8Array`, uncontradicted for as long as the file was JS |
| *Optional chaining is a null guard, not a correctness guard.* | [TD-51](type-debt-register.md#td-51) | 📝 the site is fixed ([#2769](https://github.com/kuzzleio/kuzzle/pull/2769)) and `PluginInstance.log` is now typed, so *that* path is checked; nothing gates the next `?.` over a property that never exists |
| *A comparison against `undefined` is not a check, and JavaScript cannot tell you which of your reads is one.* | [TD-52](type-debt-register.md#td-52) | 📝 the three sites are fixed ([#2769](https://github.com/kuzzleio/kuzzle/pull/2769)); strict says `TS2564` but `httpwsProtocol.ts` is still unadopted, so a new one would not be caught — [TD-54](type-debt-register.md#td-54) is what closes that |
| *A spec that assigns a property before calling the code is either describing production or replacing it.* | [TD-63](type-debt-register.md#td-63) | 📝 open ([#2770](https://github.com/kuzzleio/kuzzle/issues/2770)) — the same tell as [TD-52](type-debt-register.md#td-52)'s `httpWs.maxFormFileSize = 2`, found the same way and just as late |
| *A serialization schema and a domain type that describe the same field are two claims, and only one of them is enforced.* | [TD-68](type-debt-register.md#td-68) | 🔒 `subscriber.ts` guards both unions at the wire, and a spec pins the rejection — the proto could not express the union, so the union stopped being true at the process boundary |
| *A convention that maps names to files encodes an assumption about which files exist yet.* | [TD-64](type-debt-register.md#td-64) | 🔒 `prepare-coverage.ts` resolves `.js` targets too, so a spec written ahead of a rename counts from the day it lands |
| *The strict list reads like a quality score per file; partly it scores what a file happens to touch.* | [step 10](steps/10-sprint-7-kuzzle.md) | 📝 — narrowed by [TD-54](type-debt-register.md#td-54) |

## Tests

| Lesson | From | Enforced by |
|---|---|---|
| *The frozen suite and the new one do not resolve modules the same way — "the Mocha spec passes" says nothing about whether the vitest tree can load the subject at all.* | [TD-49](type-debt-register.md#td-49) | 📝 — the tree loads today; nothing checks that it still will |
| *"This is a style rule" and "this is what makes the program loadable" can be the same rule.* | [TD-49](type-debt-register.md#td-49) | 🔒 `@typescript-eslint/consistent-type-imports` as an **error**, repo-wide |
| *`lib/` does not import the package's own `index.ts` barrel* — a leaf takes on the whole public surface to name one type. | [ADR log, 2026-09-14](ADR-0001-migration-typescript.md#decision-register) | 📝 — **candidate for `no-restricted-imports`** |
| *`should(fn).throw()` with no matcher is not a test of why.* | [TD-57](type-debt-register.md#td-57) | 🔒 `no-restricted-syntax` over the test trees, for `should().throw()` and `expect().toThrow()` alike; `.not.throw()` excluded |
| *An assertion stricter than the contract fails on the implementation's freedom, not on a defect.* | [TD-70](type-debt-register.md#td-70) | 🔒 `array of objects matching` is order-insensitive by default and `in order` is explicit ([#2787](https://github.com/kuzzleio/kuzzle/pull/2787)); the 33 assertions that pin an order were then matched to something in the code that produces one ([#2789](https://github.com/kuzzleio/kuzzle/pull/2789)) |
| *A spec that stubs its subject's base class is not testing anything.* | [TD-46](type-debt-register.md#td-46) | 📝 |
| *When a review concludes "this call was always dead, the real work happens elsewhere", it has just established where the invariant lives — and that nothing tests it there.* | [TD-48](type-debt-register.md#td-48) | 📄 covered for the stack-trace invariant; the reading generalises |

## Runtime & diagnostics

| Lesson | From | Enforced by |
|---|---|---|
| *A diagnostic that under-reports by one is worse than no diagnostic: it reads as a contradiction and gets dismissed.* | [TD-58](type-debt-register.md#td-58) | 🔒 spec pins both gap counts — five reviews had dismissed `0 messages lost` |
| *A success line printed unconditionally is not a diagnostic, it is decoration — and it will eventually contradict the line above it.* | [TD-67](type-debt-register.md#td-67) | 🔒 `handshake()` awaits `sync()` and logs success only on success; it used to print *Successfully completed the handshake* 2 ms after the eviction denying it |
| *Two ids from the same generator with the same prefix are one id as far as a reader is concerned.* | [TD-59](type-debt-register.md#td-59) | 🔒 `createIdCard()` adopts `global.nodeId`; `handshake()` prints both when they differ |
| *A readiness probe must exercise the thing the caller depends on.* | [TD-33](type-debt-register.md#td-33) | 🔒 `bin/wait-kuzzle` accepts a node only once `funnel.throttle()` stops rejecting it, i.e. once it is in quorum — closed 2026-09-17 |
| *A lock whose TTL is a guess about how long its body takes is not a lock, and a decision read before acquiring it is not protected by it.* | [TD-69](type-debt-register.md#td-69) | 🔒 the import lock reads under the lock and writes idempotently, with 4 specs — but `Mutex` still defaults to `ttl: 5000` with no renewal, and **7 of its 14 call sites take that default**, so the lesson is gated at one site and prose everywhere else |
| *A resume point is only valid if the transport it resumes was already listening when the point was taken.* | [TD-65](type-debt-register.md#td-65) | 🔒 `handshake()` awaits `waitForSubscription()` before `getFullState`, and a spec pins the ordering; a residual race via a third party's lag is named in the entry |
| *The same ordering defect usually exists once per code path, and a fix verified against the path you found it on says nothing about the others.* | [TD-65](type-debt-register.md#td-65) | 🔒 both `handshake()` and `addNode()` await the subscription, each with a spec — the first fix did one of the two and CI found the other |
| *A broadcast is not a way to tell yourself something.* | [TD-67](type-debt-register.md#td-67) | 🔒 `evictSelf` calls `shutdown()` itself, and a spec pins it; the four callers all meant the node must stop |
| *A defect that survives five investigations is usually not hidden — it is illegible, and the cheapest fix is to the instruments.* | [TD-33](type-debt-register.md#td-33) | 📄 [TD-58](type-debt-register.md#td-58) + [TD-59](type-debt-register.md#td-59) + the armed dump made it readable; the mechanism then came from a conversion, not an investigation |
| *Two questions merged into one lookup are only equivalent when the value can answer both.* | [TD-55](type-debt-register.md#td-55) | 📝 — safe over a container that owns its elements, unsafe over third-party callables |
| *A predicate about one caller cannot be expressed where several callers converge.* | [step 08](steps/08-type-debt-backlog.md) | 📝 |
| *A `@deprecated` tag that names a replacement should be checked against the replacement.* | [TD-20](type-debt-register.md#td-20) | 📝 open ([#2688](https://github.com/kuzzleio/kuzzle/issues/2688), [#2721](https://github.com/kuzzleio/kuzzle/issues/2721)) — both replacements named here cannot do the job |

## What to gate next

The 📝 rows ranked by the odds of recurrence, highest first:

1. **[TD-62](type-debt-register.md#td-62)** — the `null` spelling of a lying declaration, 56 sites, 32 of them in the two `elasticsearch.ts`. Fixing them widens [TD-56](type-debt-register.md#td-56)'s live gate by one regex.
2. **`Mutex`'s 5 s default TTL** — [TD-69](type-debt-register.md#td-69)'s residue. **7 of its 14 call sites take it**, none renews it, and every site that set one explicitly chose 30 s or 60 s: the default is understood to be wrong by everyone who stopped to think about it, and silently held by everyone who did not. A lock that expires under its own holder fails as a corruption, not as a timeout. Cheapest form is probably a lint rule requiring an explicit `ttl`, not a new default.
3. **`no-restricted-imports` on the root barrel** — [TD-49](type-debt-register.md#td-49) showed the cost is not style, it is loadability.
4. **[TD-52](type-debt-register.md#td-52)** — blocked on [TD-54](type-debt-register.md#td-54): the compiler already has the answer in files nothing reads it for.

Gated on 2026-09-16, and both were worth the hour:

- ~~[TD-57](type-debt-register.md#td-57) — matcher-less throw assertions.~~ 15 sites, and pinning them exposed two tests passing on an error other than the one their name claims.
- ~~[TD-56](type-debt-register.md#td-56) — a non-nullable declaration assigned `undefined`.~~ 3 sites, checked everywhere rather than only in adopted files, which is the whole point of the finding.
