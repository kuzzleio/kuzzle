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

import assert from "node:assert";

import Denque from "denque";

import * as kerrorLib from "../../kerror";
import { KuzzleError } from "../../kerror/errors";
import { causeOf } from "../../util/thrown";
import waterfall from "./waterfall";

const kerror = kerrorLib.wrap("plugin", "runtime");

/** A pipe in a chain: the payload, then the callback the pipe must call. */
type Pipe = (...args: unknown[]) => void;

/**
 * How a pipe chain reports back to whoever asked for it to be run.
 *
 * The error is `unknown` for the same reason it is in `waterfall`: a pipe is
 * plugin code and can call its callback with anything.
 */
type PipeCallback = (error?: unknown, ...results: unknown[]) => void;

/**
 * The context `waterfallCallback` is called with. It carries the runner so the
 * callback can free its slot, which is why the function cannot be a closure.
 */
interface WaterfallCallbackContext {
  callback: PipeCallback;
  callbackContext: unknown;
  instance: PipeRunner;
}

/**
 * We declare the callback used by waterfall one time instead
 * of redeclaring a closure each time we want to run the pipes.
 *
 * The declared `this` is what makes the accesses below check: the context is
 * the object `run` builds.
 *
 * The suppression stays because it is ESLint's *core* `no-invalid-this`, which
 * predates `this` parameters and cannot see the declaration.
 */
/* eslint-disable no-invalid-this */
function waterfallCallback(
  this: WaterfallCallbackContext,
  error?: unknown,
  ...result: unknown[]
) {
  this.instance.running--;

  if (!this.instance.buffer.isEmpty()) {
    setImmediate(this.instance._boundRunNext);
  }

  if (error) {
    this.callback.call(this.callbackContext, toKuzzleError(error));
  } else {
    this.callback.call(this.callbackContext, null, ...result);
  }
}
/* eslint-enable no-invalid-this */

/**
 * Wraps whatever a pipe rejected with into a `KuzzleError`.
 *
 * The message is the rejected value's own `message`, as the JavaScript read
 * it: a plugin rejecting with `{ message: "oops" }` says "oops", and one
 * calling `cb("oops")` still says "undefined".
 */
function toKuzzleError(error: unknown): KuzzleError {
  if (error instanceof KuzzleError) {
    return error;
  }

  return kerror.getFrom(error, "unexpected_error", causeOf(error).message);
}

/**
 * @private
 */
class PipeChain {
  readonly chain: Pipe[];
  readonly args: unknown[];
  readonly callback: PipeCallback;
  readonly callbackContext: unknown;

  constructor(
    chain: Pipe[],
    args: unknown[],
    callback: PipeCallback,
    callbackContext: unknown,
  ) {
    this.chain = chain;
    this.args = args;
    this.callback = callback;
    this.callbackContext = callbackContext;
  }
}

/**
 * Runs pipe chains if the number of already running concurrent pipes allows it.
 * Otherwise, delays the pipe chain until a slot is freed. If the storage
 * buffer is full, rejects the provided callback and discard the pipe chain.
 */
class PipeRunner {
  readonly maxConcurrent: number;
  readonly maxBufferSize: number;
  readonly buffer: Denque<PipeChain>;

  /** Read and written by `waterfallCallback`, which runs outside the class. */
  running: number;

  /** Same: `waterfallCallback` schedules it, so it cannot be private. */
  readonly _boundRunNext: () => void;

  /**
   * @param concurrent - max number of concurrent pipes
   * @param bufferSize - max number of delayed pipe chains
   */
  constructor(concurrent: number, bufferSize: number) {
    assert(
      typeof concurrent === "number" && concurrent > 0,
      "Cannot instantiate pipes executor: invalid maxConcurrentPipes parameter value",
    );
    assert(
      typeof bufferSize === "number" && bufferSize > 0,
      "Cannot instantiate pipes executor: invalid pipesBufferSize parameter value",
    );

    this.maxConcurrent = concurrent;
    this.running = 0;
    this.maxBufferSize = bufferSize;
    this.buffer = new Denque<PipeChain>();

    this._boundRunNext = this._runNext.bind(this);
  }

  /**
   * @warning Critical code section
   *
   * Pipes can be run thousands of times per seconds
   * @param chain           - functions chain
   * @param args            - functions arguments
   * @param callback        - end-of-chain callback
   * @param callbackContext - functions/callback context
   */
  run(
    chain: Pipe[],
    args: unknown[],
    callback: PipeCallback,
    callbackContext: unknown,
  ): void {
    if (this.running >= this.maxConcurrent) {
      if (this.buffer.length >= this.maxBufferSize) {
        callback.call(callbackContext, kerror.get("too_many_pipes"));
      } else {
        this.buffer.push(new PipeChain(chain, args, callback, callbackContext));
      }

      return;
    }

    this.running++;

    // Create a context for the waterfall callback
    const waterfallCallbackCtx: WaterfallCallbackContext = {
      callback,
      callbackContext,
      instance: this,
    };

    waterfall(chain, args, waterfallCallback, waterfallCallbackCtx);
  }

  _runNext(): void {
    if (this.running >= this.maxConcurrent) {
      return;
    }

    // One lookup rather than `isEmpty()` and then `shift()`: `shift()` on an
    // empty Denque returns `undefined` and mutates nothing, so the two forms
    // agree, and this one leaves no invariant for the compiler to take on
    // trust.
    const pipe = this.buffer.shift();

    if (!pipe) {
      return;
    }

    this.run(pipe.chain, pipe.args, pipe.callback, pipe.callbackContext);
  }
}

export = PipeRunner;
