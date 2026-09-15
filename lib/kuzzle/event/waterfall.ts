/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** A step in the chain: the payload, then the callback the step must call. */
type WaterfallStep = (...args: unknown[]) => void;

/**
 * How a step — and the waterfall itself — reports back.
 *
 * The error is `unknown`, not `Error`: a step is arbitrary plugin code and can
 * call its callback with anything at all. `pipeRunner` is what turns whatever
 * arrives into a `KuzzleError`.
 */
type WaterfallCallback = (error?: unknown, ...results: unknown[]) => void;

class WaterfallContext {
  private readonly chain: WaterfallStep[];
  private readonly cb: WaterfallCallback;
  private readonly cbCtx: unknown;
  private readonly args: unknown[];
  private index: number;

  /**
   * @param chain - list of functions to call
   * @param args  - function arguments
   * @param cb    - end of waterfall callback
   * @param cbCtx - functions context
   */
  constructor(
    chain: WaterfallStep[],
    args: unknown[],
    cb: WaterfallCallback,
    cbCtx: unknown,
  ) {
    this.chain = chain;
    this.cb = cb;
    this.cbCtx = cbCtx;
    this.index = 0;

    // since we always add a callback, and since after the 1st chain function
    // there is always at least 1 arg which is the 1st function result (it
    // can be undefined), then we need to force at least 1 argument to make
    // sure that all pipe methods receive the same payload
    this.args = args.length ? args : [null];
  }

  /**
   * Each function in the waterfall chain returns a result. This result should
   * always be the 1st payload argument (updated or left intact, it matters not)
   */
  set result(result: unknown) {
    this.args[0] = result;
  }

  /**
   * The next step to run, or `undefined` once the chain is exhausted.
   *
   * The JavaScript asked twice — `hasNext()` and then an indexed read — and
   * the compiler cannot see that the second is safe because the first ran.
   * One lookup answers both questions, so there is no invariant left to assert.
   */
  shift(): WaterfallStep | undefined {
    const step = this.chain[this.index];

    if (step) {
      this.index++;
    }

    return step;
  }

  /** Runs a step against the current payload. */
  invoke(step: WaterfallStep, cb: WaterfallCallback): void {
    step(...this.args, cb);
  }

  reject(error: unknown): void {
    this.cb.call(this.cbCtx, error);
  }

  // Resolves with the updated payload
  resolve(): void {
    this.cb.call(this.cbCtx, null, ...this.args);
  }
}

/**
 * The declared `this` is what makes the accesses below check: the context is
 * always the `WaterfallContext` bound at the call site.
 *
 * The suppression stays because it is ESLint's *core* `no-invalid-this`, which
 * predates `this` parameters and cannot see the declaration.
 */
/* eslint-disable no-invalid-this */
function waterfallCB(this: WaterfallContext, err?: unknown, res?: unknown) {
  if (err) {
    this.reject(err);
  } else {
    this.result = res;
    waterfallNext(this);
  }
}
/* eslint-enable no-invalid-this */

function waterfallNext(ctx: WaterfallContext): void {
  const step = ctx.shift();

  if (!step) {
    ctx.resolve();
    return;
  }

  try {
    ctx.invoke(step, waterfallCB.bind(ctx));
  } catch (error) {
    ctx.reject(error);
  }
}

function waterfall(
  chain: WaterfallStep[],
  args: unknown[],
  cb: WaterfallCallback,
  context?: unknown,
): void {
  const ctx = new WaterfallContext(chain, args, cb, context);

  waterfallNext(ctx);
}

export = waterfall;
