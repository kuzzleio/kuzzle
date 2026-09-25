# A1 — Public typings: `v2.56.0` vs `2-dev` @ `0855cd70f`

Scope: everything reachable from `dist/index.d.ts` (the package `types`). "Breaking" = a TS app/plugin that compiled against `v2.56.0` no longer compiles against HEAD.

Method:

- `typings-work/dump.js` uses the TS 5.4.5 compiler API on each side's `dist/index.d.ts`. It resolves every export (following `export *`), then walks every named type reachable from those exports that is declared in `dist/` (classes, interfaces, aliases, enums, functions). For each one it prints a normalized signature: constructors, public/protected members with type, optionality, readonly and getter-only, method overloads, index signatures, type-parameter constraints and enum values.
- Outputs are `typings-work/{base,head}.exports.txt` (258 vs 274 names) and `typings-work/{base,head}.api.txt` (143 vs 168 declarations), diffed with `git diff --word-diff`. Pure formatting, comment and order changes are excluded below.
- `kuzzle-sdk` is 7.17.1 on both sides, so its re-exported declarations were not diffed. The export-source column shows that no name changed which module it resolves from.
- The consumer compile test (see "Consumer fixture results") uses TS 5.4.5, `skipLibCheck: true`, `strict: false` and `strict: true`. It was also run under `module/moduleResolution: node16` (same results) and under `skipLibCheck: false`.

## Summary

- **Exports:** 0 removed, 0 renamed, 16 added. All additions are types or new utilities, and none collides with a `kuzzle-sdk` name.
- **Declaration differences:** 34 items (T-01…T-34).
  - **Break with `strict: true`:** 12
  - **Also break with `strict: false`:** 7. These are T-03, T-05, T-06, T-07, T-09, T-11 and T-12.
  - **Looser or fixes:** 10 (no consumer impact)
  - **Internal-only surface:** 5
- **Consumer fixture:** these are the errors that appear on HEAD but not on BASE.
  - `strict: false`: **11** (7 in `app.ts`, 4 in `extra2.ts`).
  - `strict: true`: **35** (27 + 4 + 4).
  - The other direction, errors on BASE that are fixed on HEAD: 10 with `strict: false` and 20 with `strict: true`. The main ones are `new context.constructors.Request/RequestInput/RequestContext/Koncorde`, which were not constructable, the 4-argument `PartialError`, `app.config.merge` requiring full sections, and nested `app.config.content.*` reads being "possibly undefined".
- **No change was accidental.** Every tightening traces to step 12 (strict flip, PRs #2799–#2803) or to TD fixes. Each commit says "the type now tells the truth", but none of them assessed the effect on external `strict` consumers.
- Under the maintainer's rule (a TS consumer that compiled and no longer compiles = breaking), **HEAD is a breaking release for the typings** unless the high/medium items are softened.

**Top risks:**

1. **T-01 `Plugin.context` / `Plugin.config` became optional.** Every plugin method that uses `this.context.*` or `this.config.*` outside `init` fails under `strict`. This is the documented plugin pattern. High.
2. **T-04 `context.accessors.execute()` returns `Promise<KuzzleRequest> | null`.** Every `await execute(req)` followed by a property read, and every `.then`, fails under `strict`. This is a documented accessor. High.
3. **T-02 and T-27, nullable request and model reads.**
   - `getController()`, `getAction()` and `getUser()` return `… | null`.
   - `User._id`, `Token._id`, `Token.userId` and `Token.jwt` are `| null`.
   - So `request.context.user._id` read as a `string` fails under `strict`. This pattern is ubiquitous. High / medium.
4. **T-03 new `getIndex`/`getCollection`/`getId` overloads.** A dynamic argument, such as `{ required: someBoolean }` or `{ ifMissing: modeVar }`, matches **no overload**, even with `strict: false`. `{ required: false }` or `{ ifMissing: "ignore" }` now returns `string | null`. Medium.
5. **T-07 `EventGenericDocument*<T>` now constrains `T extends KDocumentContent`.** `KDocumentContent` is a weak type, so any user content type (interface or alias) fails with TS2559 **in both modes**. Medium.
6. **T-05 and T-06, error classes.**
   - `KuzzleError.code` and `.id` are now `| undefined`.
   - `.props` went from `string[]` to `unknown[] | undefined`, which breaks both modes when assigned to `string[]`.
   - Constructors went from `any` to `string | Error` / `string` / `number`.
   - The `PartialError` body is now `KuzzleError[]`.
   - Medium.
7. **T-10 plugin config reads.** `PluginsConfiguration[name]` is now `JSONObject | undefined`, so `app.config.content.plugins["x"].y` fails under `strict`. Medium.

## Differences

Effect key:

- **E-lax:** compile error with `strict: false` and also with `strict: true`.
- **E-strict:** compile error with `strict: true` only.
- **looser:** accepts more than before, with no new error.
- **internal:** reachable only through protected members or `accessors.kuzzle`.

| id | symbol | BASE (`v2.56.0`) | HEAD (`0855cd70f`) | effect on a consumer | breaking? | intended? | sev. |
|---|---|---|---|---|---|---|---|
| T-01 | `Plugin.context`, `Plugin.config` | `context: PluginContext; config: JSONObject` | `context?: PluginContext; config?: JSONObject` | E-strict: `this.context.log…`, `this.context.accessors.sdk`, `this.config.x` in any method other than right after assignment (TS2532). Workaround: `declare context: PluginContext` in the subclass (verified to compile). | **yes** | yes, 1b9eea5a0 (#2800, step 12 K1): "storing them is a convention … not a contract" | **high** |
| T-02 | `KuzzleRequest.getController()`, `getAction()`, `getUser()`, `pojo()` | `string`, `string`, `User`; pojo fields non-null | `string \| null`, `string \| null`, `User \| null`; pojo `token/user/error/input.*` are `\| null` | E-strict: `const c: string = request.getController()` and similar (TS2322) | **yes** | yes, a1eaab01a (#2801, step 12 K2) | high |
| T-03 | `KuzzleRequest.getIndex`, `getCollection`, `getId` | `getIndex({required}?: {required?: boolean}): string`, same for `getCollection`; `getId(o?: {ifMissing?: "error"\|"generate"\|"ignore"}): string` | 2 overloads each: `({required?: true}) => string` and `({required: false}) => string \| null`; `getId({ifMissing?: "error"\|"generate"}) => string` and `({ifMissing: "ignore"}) => string \| null` | E-lax: a non-literal argument (`{required: bool}`, `{ifMissing: union}`) matches no overload (TS2769). E-strict: the literal `false` / `"ignore"` forms now return `string \| null`. | **yes** | yes, a1eaab01a (#2801). Step 12 notes "Stating a public return type beats widening it" but does not cover the non-literal case. A third catch-all overload would restore compatibility. | med |
| T-04 | `PluginContext.accessors.execute` | `(request, callback?: any) => Promise<KuzzleRequest>` | `(request, callback?: unknown) => Promise<KuzzleRequest> \| null` | E-strict: `(await execute(r)).status` (TS18047); `execute(r).then(...)` (TS2531). The runtime returned `null` in callback mode on both sides, so this is a truthful type, but overloads (with/without callback) would avoid the break. | **yes** | yes, f7788423a (#2803, step 12 K5) | **high** |
| T-05 | `KuzzleError` (and all 14 subclasses): `code`, `id`, `props` | `code: number; id: string; props: string[]` | `code: number \| undefined; id: string \| undefined; props: unknown[] \| undefined` | E-lax: `const p: string[] = err.props` (unknown[] is not assignable to string[]). E-strict: `const c: number = err.code`, `err.props.join()`. Runtime unchanged (`props = undefined` in both). | **yes** | yes, 7ebad7d5f (#2800) and 1ee1d0af2 (#2803, K5) | med |
| T-06 | Error constructors (`BadRequestError`, `NotFoundError`, `InternalError`, … 12 subclasses), `PartialError`, `KuzzleError`, `MultipleErrorsError` | `new(message: any, id?: any, code?: any)`; `PartialError(message: any, body: any, id: any, code: any)` (all 4 required); `KuzzleError(message: string, …)` | `new(message?: string \| Error, id?: string, code?: number)`; `PartialError` has 2 overloads `(msg?, id?, code?)` and `(msg?, body?: KuzzleError[], id?, code?)`; `KuzzleError(message: string \| Error \| undefined, …)` | E-lax: passing a number, an object or a non-string id/code (e.g. `new InternalError(n)`) fails (TS2345). A `PartialError` body that is not `KuzzleError[]` (e.g. `[{_id, reason}]` or `Error[]`) fails (TS2353/TS2769). Looser: optional arguments, and `PartialError` with 2 arguments now compiles. | **yes** | yes, 7ebad7d5f (#2800, K1) | med |
| T-07 | `EventGenericDocument{Before,After}{Write,Update}`, `…AfterGet` type param | `<KDocumentContent = JSONObject>` (unconstrained, shadowed the SDK name) | `<TContent extends KDocumentContent = JSONObject>` | E-lax: `EventGenericDocumentAfterGet<Car>` where `Car` is any user interface or alias fails (TS2559 "no properties in common" — `KDocumentContent` is a weak type with only `_kuzzle_info?`). The user must write `Car extends KDocumentContent`. The docs only use the default form. | **yes** | yes, 1b9eea5a0 (#2800): fixed the shadowing. Using `KDocumentContentGeneric` or `JSONObject`, or dropping the constraint, would be non-breaking. | med |
| T-08 | `Controller.name`, `Controller.definition` | `name: string; definition: ControllerDefinition` | `name?: string; definition?: ControllerDefinition` | E-strict: `const n: string = this.name`, `this.definition.actions` (TS2322/TS2532/TS18048). Assigning in the constructor is unaffected. | **yes** | yes, 1b9eea5a0 (#2800) | low-med |
| T-09 | `BackendConfig.content`, `BackendConfig.merge` | `content: Partial<IKuzzleConfiguration>`; `merge(config: Partial<IKuzzleConfiguration>)` | `content: IKuzzleConfiguration`; `merge(config: DeepPartial<IKuzzleConfiguration>)` | Mostly looser: reads such as `content.limits.x` no longer need `?.`/`!`, and `merge({server:{port}})` now compiles. E-lax: assigning a `Partial<IKuzzleConfiguration>` to `app.config.content` fails (TS2322). | yes (narrow) | yes, 8b51997ee (#2799, TD-53) | low |
| T-10 | `PluginsConfiguration` index signature | `[pluginName: string]: JSONObject` | `[pluginName: string]: JSONObject \| undefined` | E-strict: `app.config.content.plugins["my-plugin"].opt` (TS2532); `const c: JSONObject = plugins["x"]` (TS2322) | **yes** | yes, 1b9eea5a0 (#2800) | med |
| T-11 | `HttpConfiguration.accessControlAllowOrigin` | `string` | `string \| string[] \| RegExp[]` | E-lax: `const o: string = content.http.accessControlAllowOrigin` (TS2322). Looser for writers. This is a type fix: the runtime already accepted arrays. | yes (narrow) | yes, 2159a09a7 (#2686) | low |
| T-12 | `IKuzzleConfiguration` | no `version`, no `cluster.retransmitBuffer`, no `internal.allowAllOrigins`, no `vault`; `validation: Record<string, unknown>` | new required `version: string`, `cluster.retransmitBuffer: {messages, bytes}`, `internal.allowAllOrigins: boolean`, `vault: {newAlgorithm: boolean}`; `validation: RawSpecification` | E-lax: building or assigning a full `IKuzzleConfiguration` (or a `Partial` of it) fails; a `Record<string, unknown>` assigned to `validation` fails (TS2322). Reads are unaffected. | yes (narrow) | yes: 4645a7265 (#2682, TD-18), 2159a09a7 (#2686), 0807880a8 (#2785/#2896), 7eeec6298 (vault), 664d3e0d0 (#2803, RawSpecification) | low |
| T-13 | `KuzzleConfiguration` | `Partial<IKuzzleConfiguration>` (only top level optional) | `DeepPartial<IKuzzleConfiguration>` (+ `version?`) | Looser for writers: a config literal no longer needs every sub-key. E-strict for readers: nested reads are now optional (`cfg.limits!.documentsFetchCount` becomes `number \| undefined`). | minor | yes, 8b51997ee (#2799, TD-53) | low |
| T-14 | `SecurityConfiguration.jwt` | `jwt?: JSONObject` | `jwt: JSONObject` | E-lax: building a `SecurityConfiguration` literal without `jwt` fails. Reads are looser. | yes (narrow) | yes, 8b51997ee (#2799) | low |
| T-15 | `InternalCacheConfiguration`, `PublicCacheRedisConfiguration`, new `BaseCacheRedisConfiguration` | two flat duplicated shapes | `BaseCacheRedisConfiguration & { database: number }` for both. The base adds optional `nodes`, `initTimeout`, `pingKeepAlive`, `clusterOptions.dnsLookup`. | looser (same required keys) | no | yes, cda3514b6 (#2685) | — |
| T-16 | `RequestResponse` | `new(request: any)`; `getHeader(): string \| null`; `removeHeader(): any`; `setHeader(): any`; `configure({headers,status,format})` | `new(request: KuzzleRequest)`; `getHeader(): string \| undefined`; `removeHeader(): boolean`; `setHeader(): boolean`; `configure` gains `result?: unknown` | E-strict: `const h: string \| null = res.getHeader()` (TS2322); `if (h === null) return; h.x` (TS18048). **BASE lied**: the runtime always returned `undefined` (`Headers.getHeader` returns `string \| void`), so code checking `=== null` was already buggy. | yes (strict) | yes, a1eaab01a (#2801); `configure.result` 5824f88ef (TD-20) | low |
| T-17 | `RequestInput` constructor | `new(data: any)` | `new(data: JSONObject)` | E-lax only for non-object arguments. None found in practice. | unlikely | yes (#2801) | low |
| T-18 | `KuzzleRequest` / `Request` additions | — | new `assignResult(result: unknown)`, `getArrayOrCsv(name, def?)`; `deprecations` gains a setter; `deprecations` getter type unchanged | additive | no | yes: 5824f88ef, 6e17100bc (TD-20, stack #2893/#2896); a1eaab01a | — |
| T-19 | Hidden members on `KuzzleRequest`, `RequestInput`, `RequestContext`, `Connection`, `RequestResponse` | runtime `"internalId​"`-style keys, undeclared | declared public members keyed by a zero-width-space string (`"internalId​"`, `"status​"`, `"input​"`, `"response​"`, …) | additive. They show in IntelliSense as duplicate-looking `internalId`, `status` and similar entries, and they change `keyof KuzzleRequest`. Hygiene: they could be `@internal` with `stripInternal`, or private. | no | yes, a1eaab01a (#2801) | low |
| T-20 | `PluginContext.constructors` | `Request: KuzzleRequest; RequestContext: RequestContext; RequestInput: RequestInput; Koncorde: Koncorde` (instance types, not newable) | `Request: PluginRequestConstructor` (2 construct signatures); `RequestContext: typeof RequestContext`; `RequestInput: typeof RequestInput`; `Koncorde: typeof Koncorde` | **fix**: `new context.constructors.X(...)` now compiles; it failed with TS2351 on BASE | no | yes, 6d3795952 (#2887, TD-76) | — |
| T-21 | `PluginContext` constructor, `accessors.kuzzle` | `new(pluginName: any)`; no `kuzzle` | `new(pluginName: string)`; new `accessors.kuzzle?: Kuzzle` (privileged plugins) | additive. It exposes the internal `Kuzzle` class (and, through it, `Statistics`, `TokenManager`, …) to the public typings. | no | yes, 8f90312a4 (#2724) | low |
| T-22 | `BackendErrors.get/getFrom/wrap` | placeholders `any[]`; `wrap().get/getFrom/reject(error: any, …)` | placeholders `unknown[]`; `wrap()` error parameter `string` | E-lax only if a non-string error name is passed to `wrap(...).get` | unlikely | yes, cb1db7ed4 (#2800) | low |
| T-23 | `Backend._pipes` (protected) | `{}` | `Record<string, (() => Promise<void>)[]>` | Only matters for `Backend` subclasses that touch `_pipes` | unlikely | yes (step 12 K5, #2803) | low |
| T-24 | `PluginHookDefinition`, `PluginPipeDefinition` (+ new `PluginMethodName`, `CallbackPipeHandler`, `RegisteredPipeHandler`) | values `Handler \| Handler[]` | values also accept a method-name `string` and a callback-style pipe | Looser for writers. E-strict/E-lax for code that *reads* `plugin.hooks[e]` and calls it (the value may now be a string). | unlikely | yes, 41c519ecf (#2891, TD-78) | low |
| T-25 | `StartOptions.secretsFile`, `vaultKey` | `JSONObject` | `string` | fix (the runtime always used strings). `StartOptions` was not exported by name in BASE; now it is. | no | yes, 1990a22b1 (#2752) | — |
| T-26 | `ObjectRepository<T>` | `T extends {_id: string}`; `ctor({cache, store?: any})`; `load/loadFromCache/loadOneFromDatabase: Promise<T>`; `search/scroll: Promise<{aggregations:any; hits:any[]; …}>`; `serializeToDatabase: Omit<T,"_id">`; `truncate(any): Promise<any>` | `T extends {_id: string \| null}`; `ctor(ObjectRepositoryOptions)` with `store?: {index: string} \| null`; loads return `Promise<T \| null>`; `Promise<RepositorySearchResult<T>>`; `JSONObject`; `truncate(JSONObject): Promise<number>`; new `protected idOf()` | E-strict: `(await repo.load(id)).x` (TS18047). E-lax: `store: "name"` (a non-object) fails; subclasses overriding `search`/`serializeToDatabase` with incompatible return types fail. | yes (strict) | yes: e08e9fdeb (#2737, TD-40), 664d3e0d0 / c07ad0f95 (#2803) | low-med |
| T-27 | Model classes reachable via `request.context` / `getUser()`: `User._id`, `Token._id/expiresAt/ttl/userId/jwt`, `TokenContent.*`, `Profile._id/optimizedPolicies`, `Role.checkRestrictions`, `InternalProfilePolicy.restrictedTo` | non-null / required | `\| null` (Token, User, Profile ids), `optimizedPolicies \| undefined`, `restrictedTo?` | E-strict: `const id: string = request.context.user._id` (TS2322). Very common in controllers. | **yes** | yes, c07ad0f95 (#2803, TD-62) | med-high |
| T-28 | `Kuzzle` class (internal, reachable via T-21 and protected `_kuzzle`) | `rootPath`, `statistics` private; `shutdown()`; `install(i: InstallationConfig[])`; `dump(any): Promise<any>`; `new(Partial<IKuzzleConfiguration>)` | public `rootPath: string`, `statistics: Statistics`; `shutdown(exitCode?)`; `install(i?)`; `dump(string): Promise<string>`; `new(IKuzzleConfiguration)`; `Logger` ctor takes `IKuzzleConfiguration` | internal | no | yes, various (0807880a8, step 12) | — |
| T-29 | `KuzzleEventEmitter.registerPluginHook/Pipe`, `TokenManager.unlink/getConnectedUserToken` (internal) | narrower parameters | wider parameters (`\| ((...args) => unknown)`, `RegisteredPipeHandler`, `\| null`) | internal, looser | no | yes (#2748, #2803) | — |
| T-30 | `Store` (exported class) | 23 methods typed `(...args: any[]) => Promise<any>`; `logger` private | same signature via alias `StoreAskMethod`; `logger` protected (`Logger`) | none | no | yes (step 12) | — |
| T-31 | `QueryTranslator.translate/_translateOperator/_translateClause` | `any` in/out | `JSONObject`/`string`/`unknown` in, `JSONObject` out | E-lax only with non-object arguments. Rarely used directly. | unlikely | yes (step 12) | low |
| T-32 | `Inflector.camelCase` | `(string: any)` | `(string: string)` | E-lax with non-string arguments | unlikely | yes | low |
| T-33 | New exports (16) | — | `ApiRoute`, `BaseCacheRedisConfiguration`, `CallbackPipeHandler`, `ClientConnection`, `HttpMessage`, `MutexConfig`, `MutexLockLostError`, `PackagedKuzzleConfiguration`, `PluginManifest`, `PluginMethodName`, `PluginRequestConstructor`, `RegisteredPipeHandler`, `RepositorySearchResult`, `StrategyDefinition`, `ValidatedTarget`, `withLock` (+ `StartOptions`-style types now importable) | additive. There is no `export *` collision with `kuzzle-sdk`: no name disappeared or changed source. | no | yes (#2685 distributedLock, step 12) | — |
| T-34 | `.d.ts` self-consistency (`skipLibCheck: false`) | 40 (lax) / 44 (strict) errors inside `kuzzle`'s own and its deps' `.d.ts` | 6 / 8, all in dependencies (`kuzzle-sdk` `Document.d.ts` TS2344, `kuzzle-logger` vs `pino` TS2694). None are in `kuzzle/dist`. | improvement for `skipLibCheck: false` users | no | yes (strict flip) | — |

Declarations with **no** difference: `Backend` (public members), `BackendController`, `BackendPipe`, `BackendHook`, `BackendPlugin`, `BackendVault`, `BackendStorage`, `BackendCluster`, `BackendImport`, `BackendOpenApi`, `BackendSubscription`, `InternalLogger`, `EmbeddedSDK`, `Mutex`, `MutexOptions`, `HttpStream`, `Koncorde`, `NameGenerator`, `ControllerDefinition`, `HttpRoute` (only the verb order changed), `EventHandler`, `PipeEventHandler`, `HookEventHandler`, `ClusterEventHandler`, the realtime types, `CustomErrorDefinition`, `KuzzleRequest` getters `input`/`context`/`response`/`result`, and `getBody`/`getString`/`getInteger`/`getBoolean`/`getArray`/`getObject`/`setResult`. `RequestContext`'s declared `token`/`user` were already `| null` on BASE.

## Consumer fixture results

Fixture location: `typings-work/consumer/src/{app.ts,extra.ts,extra2.ts}`. It is symlinked into `consumer-base/` and `consumer-head/`, where `node_modules/kuzzle` points at each worktree.

- `app.ts` covers the documented surface: `Backend`, the controller with http routes including `options`, `HttpStream`, a `Controller` subclass, pipes and hooks (sync and async, typed generic events), imports, storage, cluster, subscription, the SDK, `Mutex`, and a `Plugin` with `api`/`hooks`/`pipes`/`authenticators`/`strategies`/`init` using accessors, constructors, errors and log, plus the full `KuzzleRequest` getter set.
- `extra.ts` covers `ObjectRepository` subclassing, error subclassing, and the `declare context` workaround.
- `extra2.ts` covers config assignment and error-constructor edge cases.

Compile: `head/node_modules/.bin/tsc -p tsconfig.{false,true}.json` (TS 5.4.5, commonjs/node10; node16 gives identical results).

### `strict: false` — HEAD-only errors (11)

| file:line | code | offending line | T-id |
|---|---|---|---|
| app.ts:60 | TS2322 | `const origin: string = app.config.content.http.accessControlAllowOrigin;` | T-11 |
| app.ts:92 | TS2322 | `const errProps: string[] = customErr.props;` | T-05 |
| app.ts:102 | TS2353 | `new PartialError("partial", [{ _id: "a", reason: "x" }], "id", 1)` | T-06 |
| app.ts:137 | TS2769 | `request.getId({ ifMissing: mode })` (mode: `"error"\|"generate"\|"ignore"`) | T-03 |
| app.ts:141 | TS2769 | `request.getIndex({ required })` (required: boolean) | T-03 |
| app.ts:252 | TS2559 | `app.pipe.register<EventGenericDocumentAfterGet<CarAlias>>(…)` | T-07 |
| app.ts:253 | TS2559 | `app.pipe.register<EventGenericDocumentAfterGet<Car>>(…)` (interface) | T-07 |
| extra2.ts:7 | TS2322 | `app.config.content = c` (c: `Partial<IKuzzleConfiguration>`) | T-09 / T-12 |
| extra2.ts:11 | TS2322 | `validation: { foo: 42 } as Record<string, unknown>` | T-12 |
| extra2.ts:15 | TS2769 | `new PartialError("x", errs)` (errs: `Error[]`). BASE also errored here, but with TS2554 (4 arguments required). | T-06 |
| extra2.ts:17 | TS2345 | `new InternalError(n)` (n: number) | T-06 |

### `strict: true` — HEAD-only errors (35)

This includes everything above, plus:

| file:line | code | offending line | T-id |
|---|---|---|---|
| app.ts:59 | TS2532 | `app.config.content.plugins?.["my-plugin"].option` | T-10 |
| app.ts:64 | TS2322 | `const n: number = partialConfig.limits!.documentsFetchCount` (a `KuzzleConfiguration` reader) | T-13 |
| app.ts:68 | TS2322 | `const e: JSONObject = pluginsCfg["my-plugin"]` | T-10 |
| app.ts:90 | TS2322 | `const errCode: number = customErr.code` | T-05 |
| app.ts:91 | TS2322 | `const errId: string = customErr.id` | T-05 |
| app.ts:93 | TS18048 | `customErr.props.join(",")` | T-05 |
| app.ts:135 | TS2322 | `const idMaybe: string = request.getId({ ifMissing: "ignore" })` | T-03 |
| app.ts:142 | TS2322 | `const collOpt: string = request.getCollection({ required: false })` | T-03 |
| app.ts:146 | TS2322 | `const userId: string = request.context.user._id` (BASE already flagged `user` possibly null; HEAD adds `_id: string \| null`) | T-27 |
| app.ts:152, 153 | TS2322 | `const controller: string = request.getController()` / `getAction()` | T-02 |
| app.ts:175 | TS2322 | `const h: string \| null = request.response.getHeader("X-Bar")` | T-16 |
| app.ts:184 | TS2322 | `const c: string = request.pojo().input.controller` | T-02 |
| app.ts:223 | TS2322 | `const ctrlName: string = this.name` (in a `Controller` subclass) | T-08 |
| app.ts:224 | TS2532 | `Object.keys(this.definition.actions)` | T-08 |
| app.ts:335 | TS18047 | `const status: number = (await context.accessors.execute(req)).status` | T-04 |
| app.ts:336 | TS2531 | `context.accessors.execute(req).then(r => r.result)` | T-04 |
| app.ts:345, 346 | TS2532 | `this.context.log.info(…)`, `this.context.accessors.sdk` (plugin method) | T-01 |
| app.ts:348 | TS2532 | `this.config.someOption` (plugin method) | T-01 |
| extra.ts:11 | TS18047 | `(await this.load(id)).name` in an `ObjectRepository` subclass | T-26 |
| extra.ts:33 | TS2322 | `const code: number = e.code` (`KuzzleError` subclass) | T-05 |
| extra.ts:62 | TS18048 | `c.definition.actions` (`Controller` read externally) | T-08 |
| extra.ts:69 | TS18048 | `const v = res.getHeader("x"); if (v === null) return; v.toUpperCase()` | T-16 |

### Errors on BASE that HEAD fixes

- `new context.constructors.Request/RequestInput/RequestContext/Koncorde(...)` failed with TS2351 on BASE (T-20).
- `new PartialError(msg, body)` needed 4 arguments on BASE (T-06).
- `app.config.merge({ server: { port } })` and `KuzzleConfiguration` literals needed full sections on BASE (T-09, T-13).
- With `strict: true`, 9 `app.config.content.*` reads were "possibly undefined" on BASE (T-09).

### Things that still compile on HEAD

- `app.controller.register` with routes (including the `options` verb), `HttpStream`, pipe and hook registration (sync and async), `app.import.*`, `app.vault`, `app.openApi`, `app.errors.register/get/getFrom/wrap`, the `app.sdk.*` calls, `app.cluster.on/broadcast`, `Mutex`, `app.plugin.use/get`, the plugin `hooks`/`pipes`/`strategies`/`authenticators` literals, and all the `getBody`/`getString`/`getInteger`/`getArray`/`getObject`/`setResult`/`response.configure` calls.
- A plugin written as `declare context: PluginContext; declare config: JSONObject;` compiles on HEAD with `strict` (the T-01 workaround).

## Remediation hints

These are non-breaking alternatives, if the maintainer wants a minor release. They are recorded here only; nothing was changed in the repo.

- **T-01:** declare `context!: PluginContext; config!: JSONObject;` (definite assignment), or keep the fields non-optional.
- **T-04:** add overloads, `execute(request): Promise<KuzzleRequest>` and `execute(request, callback): null`.
- **T-03:** add a catch-all overload, `getIndex(options?: { required?: boolean }): string | null`. Do the same for `getCollection`, and add `getId(options?: { ifMissing?: "error" | "generate" | "ignore" }): string | null`. The non-literal case then compiles again. It still yields `string | null` under strict, which is honest.
- **T-07:** constrain `TContent` with `KDocumentContentGeneric`/`JSONObject`, or drop the constraint and wrap `KDocument<TContent & KDocumentContent>`.
- **T-05:** keep `props` as `string[] | undefined`, or type it `any[]` at the public boundary, so that `strict: false` compiles.
- **T-02, T-27, T-08, T-10, T-16, T-26:** these are truthful nullability. They only break `strict` consumers. Either accept them as documented typing breaks (BREAKING CHANGE note / major), or revert to the BASE lie at the public boundary.

## Not checked, and why

- **Other TypeScript versions.** Only TS 5.4.5 (the pinned compiler on both sides) was used. A consumer on TS ≥ 5.5 may see different inference, notably around `DeepPartial` and weak-type detection, but no other compiler is installed and the task forbids installing into the worktrees.
- **Other consumer flags.** `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` and `useDefineForClassFields`/ES2022 targets were not run. They would add more HEAD-only errors from the new `?:` members (T-01, T-08, T-13, T-24), but users rarely enable them.
- **Private members.** They were compared by name only. Changes to private or `​`-keyed members affect only nominal assignability, which consumers cannot exploit anyway because every class involved already had private members on BASE.
- **The `kuzzle-sdk` surface.** It is identical (7.17.1 on both sides), but HEAD's `package.json` range is now `>=7.17.1 <8.0.0` while BASE's was `>=7.17.1`. A fresh install of BASE could have pulled an SDK 8, so this is a tightening of the dependency, not of the typings.
- **JavaScript consumers using JSDoc `@ts-check`.** Not covered by the fixture. They are affected like `strict: false` TS consumers if they enable `checkJs`.
- **Runtime behaviour behind the loosened types.** For example T-16 `getHeader`, which returned `undefined` on both sides. This belongs to the runtime audit parts. Only T-04 and T-16 were confirmed runtime-identical by reading the source.
