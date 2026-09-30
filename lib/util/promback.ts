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

import Bluebird from "bluebird";

type PrombackCallback<T> = (error: unknown, result?: T) => void;

/**
 * `resolve()` may be called with no argument, and callers do pass a possibly
 * missing value (`promback.resolve(updated[0])` under
 * `noUncheckedIndexedAccess`), so the settled value is `T | undefined` — not
 * `T`. Declaring it honestly is what lets `resolve`/`reject` type-check
 * without a cast.
 */
type PrombackResult<T> = T | undefined;

class Promback<T = unknown> {
  private readonly _callback: PrombackCallback<T> | null;
  private _resolve: ((result: PrombackResult<T>) => void) | null;
  private _reject: ((error: unknown) => void) | null;

  public deferred: Bluebird<PrombackResult<T>> | null;
  public isPromise: boolean;

  constructor(callback: PrombackCallback<T> | null = null) {
    this._callback = callback;
    this._resolve = null;
    this._reject = null;
    this.deferred = null;
    this.isPromise = this._callback === null;

    if (this.isPromise) {
      this.deferred = new Bluebird<PrombackResult<T>>((res, rej) => {
        this._resolve = res;
        this._reject = rej;
      });
    }
  }

  resolve(result?: T) {
    // Narrowing on the settler rather than on `isPromise` is equivalent — the
    // Bluebird executor runs synchronously, so `_resolve` is set if and only
    // if no callback was given — and it is what makes the two branches
    // provably non-null.
    if (this._resolve !== null) {
      this._resolve(result);
    } else {
      this._callback?.(null, result);
    }

    return this.deferred;
  }

  reject(error?: unknown) {
    if (this._reject !== null) {
      this._reject(error);
    } else {
      this._callback?.(error);
    }

    return this.deferred;
  }

  get promise() {
    return this.deferred;
  }
}

export = Promback;
