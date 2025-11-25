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

import assert from "assert";
import { AsyncLocalStorage } from "async_hooks";

type Store = Map<string, unknown>;
type RunCallback = () => void;

interface AsyncStoreInterface {
  run(callback: RunCallback): void;
  exists(): boolean;
  set<T>(key: string, value: T): void;
  get<T>(key: string): T | undefined;
  has(key: string): boolean;
}

export default class AsyncStore implements AsyncStoreInterface {
  public _asyncLocalStorage: AsyncLocalStorage<Store>;

  constructor() {
    this._asyncLocalStorage = new AsyncLocalStorage<Store>();
  }

  /**
   * Run the provided method with an async store context
   */
  run(callback: RunCallback): void {
    this._asyncLocalStorage.run(new Map<string, unknown>(), callback);
  }

  /**
   * Returns true if an async store exists
   * for the current asynchronous context
   */
  exists(): boolean {
    return Boolean(this._asyncLocalStorage.getStore());
  }

  /**
   * Sets a value in the current async store
   */
  set<T>(key: string, value: T): void {
    this._getStore().set(key, value);
  }

  /**
   * Gets a value from the current async store
   */
  get<T>(key: string): T | undefined {
    return this._getStore().get(key) as T | undefined;
  }

  /**
   * Checks if a value exists in the current async store
   */
  has(key: string): boolean {
    return this._getStore().has(key);
  }

  private _getStore(): Store {
    const store = this._asyncLocalStorage.getStore();

    assert(Boolean(store), "Associated AsyncStore is not set");

    return store;
  }
}
