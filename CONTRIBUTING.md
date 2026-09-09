# How to contribute to Kuzzle

Here are a few rules and guidelines to follow if you want to contribute to Kuzzle and, more importantly, if you want to see your pull requests accepted by Kuzzle team.

## Language

All work in this repository is in **English**: source code, comments, identifiers, documentation (including ADRs and this guide), commit messages and pull requests. This keeps the project accessible to its international community of contributors.

## Coding style

We use most of the [NPM Coding Style](https://www.w3resource.com/npm/npm-coding-style.php) rules, except for these ones:

* Semicolons at the end of lines
* 'Comma first' rule is not followed

## TypeScript migration

Kuzzle is being migrated from JavaScript to TypeScript incrementally (see
[`docs/adr-001/ADR-0001-migration-typescript.md`](docs/adr-001/ADR-0001-migration-typescript.md)).
While the migration is in progress, a few ratcheted rules apply, enforced in CI by
the `migration-ratchets` job:

* **No new `.js` under `lib/` or `bin/`** — write new code in TypeScript. The `.js`
  file count may only decrease.
* **New unit tests in vitest + TypeScript, under `tests/`** — see *Where unit tests
  live* below. The legacy Mocha suite is frozen; its spec count may only decrease.
* **No new explicit `any`** in `lib/**/*.ts` — the count may only decrease
  (`@typescript-eslint/no-explicit-any` is on as a warning). `as unknown as` counts too.
* **No new implicit `any`** — the count of `TS7xxx` diagnostics under `noImplicitAny`
  may only decrease. This is what stops a conversion from being a rename: leaving a
  parameter un-annotated is free for the explicit-`any` ratchet but not for this one.
* When a file passes `strict`, add it to `.migration/strict-adopted.txt`
  (`npm run test:strict -- --candidates` lists the ready ones). For a file you are
  converting, this is part of the PR — not a later chore.
* **Converting a file that has no unit spec? Write one** (vitest + TS) in the same PR.
  `.ts` is measured by the coverage gate, so an untested conversion now fails CI.

Run the gates locally before pushing:

```bash
npm run ratchet             # js / mocha / any / implicit-any (must not increase)
npm run test:strict         # strict type-check on adopted files
.ci/scripts/pr-preflight.sh # the above + lint + error-codes + two reminders
```

If you legitimately reduce a count, update its baseline in the same PR — e.g.
`npm run ratchet:js -- --update` (idem `:mocha`, `:any`, `:implicit-any`) — then
commit `.migration/`.

## Guidelines

* Prefer async/await or promises instead of callbacks as often as you can
  * Except for methods invoked before the funnel module: ALWAYS use callbacks there to prevent event loop saturation (i.e. mostly methods handling network connections) 
* Always add/update the corresponding unit and/or functional tests. We won't accept non-tested pull requests.
* [Documentation and comments are more important than code](http://queue.acm.org/detail.cfm?id=1053354): comment your code, use jsdoc for every new function, add or update markdown documentation if need be. We won't accept undocumented pull requests.
* Similar to the previous rule: documentation is important, but also is code readability. Write [self-describing code](https://en.wikipedia.org/wiki/Self-documenting).

## General rules and principles we'd like you to follow

* If you plan to add new features to Kuzzle, make sure that this is for a general improvement to benefit a majority of Kuzzle users. If not, consider making a plugin instead (check our [plugin documentation](https://docs.kuzzle.io/plugins/1))
* Follow the [KISS Principle](https://en.wikipedia.org/wiki/KISS_principle)
* Follow [The Boy Scout Rule](https://deviq.com/principles/boy-scout-rule)

## Tools

For development only, we built a specific Docker Compose file: `docker-compose.yml`. You can use it to profile, debug, test a variable on the fly, add breakpoints and so on, thanks to [chrome-devtools](https://developer.chrome.com/devtools).  
Check the logs at the start of Kuzzle using the development docker image to get the appropriate debug URL.

How to run the development stack (needs Docker 1.10+ and Docker Compose 1.8+):

```bash
# clone this repository
git clone git@github.com:kuzzleio/kuzzle.git
cd kuzzle

# Start a kuzzle cluster with development tools enabled
# This will start a kuzzle with Elasticsearch 7
docker compose -f docker-compose.yml up

# Start a kuzzle cluster with development tools enabled
# This will start a kuzzle with Elasticsearch 8
# See [docker-compose.override.yml](docker-compose.override.yml) for more details
docker compose up
```

⚠️ **Important**: The two docker-compose command launch launch different configurations.

## ENOSPC error

On some Linux environments, you may get `ENOSPC` errors from the filesystem watcher, because of limits set too low.

If that happens, simply raise the limits on the number of files that can be watched:

`sudo sysctl -w fs.inotify.max_user_watches=524288`

That configuration change will last until the next reboot. 

To make it permanent, add the following line to your `/etc/sysctl.conf` file:

```
fs.inotify.max_user_watches=524288
```

You can now access the Kuzzle HTTP/WebSocket API through the following URL: `http://localhost:7512`.
This is the entrypoint for the loadbalancer: API requests are then forwarded to kuzzle individual kuzzle nodes (round-robin).

For development purposes, nodes can be accessed individually:

| Node no. | HTTP/WebSocket port | MQTT port | Chrome Inspect Port |
|:--------:|:-------------------:|:---------:|:-------------------:|
| 1 | 17510 | 1883 | 9229 |
| 2 | 17511 | 11883 | 9230 |
| 3 | 17512 | 11884 | 9231 |

Everytime a modification is detected in the source files, the nodes are automatically restarted.

### Kuzzle over SSL

The development stack include a endpoint to access Kuzzle API through SSL on port `7443`.  

The certificates are privately signed, using provided [CA certificate](docker/nginx/kuzzleCA.crt).  
Domains accepted:
- localhost
- *.kuzzle.loc

You'll need to import the CA certificate to your browser and possibly your system local authorities to make it verified.
Once done, your browser should not complain when reaching https://localhost:7443.  
The CA certificate is here: [docker/nginx/kuzzleCA.crt](docker/nginx/kuzzleCA.crt)

Using node.js, for instance when using the sdk, you'll need to pass the CA cert using the `NODE_EXTRA_CA_CERTS` environment variable:

```
NODE_EXTRA_CA_CERTS=/path/to/certificate/kuzzleCA.crt wscat -c wss://localhost:7443
```

## Create a plugin

See our [plugins documentation](https://docs.kuzzle.io/core/2/plugins/)


## About Mac M1

First of all make sure that you have at least `4GB` of ram allocated to your vm **docker desktop** and that it is running.

Run the following command to install all the dependencies in your container:
```bash
docker compose run kuzzle_node_1 npm ci
```

Finally, run the command `docker compose up` to start your Kuzzle stack.


## Launching tests suits

### Where unit tests live

| Directory | Runner | Status |
|-----------|--------|--------|
| `tests/` | **vitest + TypeScript** | where **every new spec** goes |
| `test/` | Mocha (JavaScript) | **frozen** — legacy, migrated away progressively |

`tests/` mirrors the source tree: the spec for `lib/util/bytes.ts` is
`tests/util/bytes.test.ts`. Discovery is `tests/**/*.{test,spec}.ts`.

Two things to know about that layout, both learned the hard way (ADR-0001 step 06):
`vitest.config.ts` must **not** set `test.root`, because coverage paths are then
resolved against it — which sends the lcov report to the wrong directory and limits
the instrumented scope to the spec tree, so `lib/` is never measured. And a module
exported with `export =` (most of `lib/util`) is imported in a spec with a **default
import** (`import bytes from "…"`), not `import bytes = require("…")`: the latter
type-checks but does not resolve at runtime under vite.

### How coverage is measured

The quality gate requires **80% coverage on new code**, and the two unit
runners disagree on what "a line" is: `c8` (wrapping Mocha) derives its line
set from the *compiled* output and reports every line of a loaded file, blank
lines and comments included, while vitest's v8 provider reports only real
statements. Merging the two understates coverage — badly, for a file whose
tests live in vitest.

So `.ci/scripts/prepare-coverage.ts` runs between the test suites and the
SonarCloud scan. It drops non-executable lines from both reports, then gives
each file a **single owner**: the runner whose spec targets it, per the `tests/`
mirror convention. It only ever hands a file to vitest when vitest measures it
at least as well, so it cannot lower a file's reported coverage — and it prints
any file where Mocha still measures better, which is worth investigating.

To reproduce the numbers CI sees:

```bash
npm run build
npm run test:unit:mocha:coverage
npm run test:unit:vitest
npx tsx .ci/scripts/prepare-coverage.ts coverage/mocha/lcov.info coverage/vitest/lcov.info
```

### Running unit tests

```bash
npm run test:unit:vitest
npm run test:unit:mocha

# Or, with no local Node.js toolchain (recommended on arm64 — the native `re2`
# binding will not load on the host):
.ci/scripts/docker-test.sh unit vitest
.ci/scripts/docker-test.sh unit mocha
```

### Functional tests

```bash
KUZZLE_FUNCTIONAL_TESTS="test:functional:websocket" ES_VERSION=8 ./.ci/scripts/run-test-cluster.sh
```
