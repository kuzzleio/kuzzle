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

'use strict';

const assert = require('assert');
const { AsyncLocalStorage } = require('async_hooks');

class AsyncStore {
  constructor () {
    this._asyncLocalStorage = new AsyncLocalStorage();
  }

  /**
   * Run the provided method with an async store context
   *
   * @param {Function} callback
   */
  run (callback) {
    this._asyncLocalStorage.run(new Map(), callback);
  }

  /**
   * Returns true if an async store exists
   * for the current asynchronous context
   */
  exists () {
    return Boolean(this._asyncLocalStorage.getStore());
  }

  /**
   * Sets a value in the current async store
   *
   * @param {String} key
   * @param {any} value
   */
  set (key, value) {
    return this._getStore().set(key, value);
  }

  /**
   * Gets a value from the current async store
   *
   * @param {String} key
   *
   * @returns {any} value
   */
  get (key) {
    return this._getStore().get(key);
  }

  /**
   * Checks if a value exists in the current async store
   *
   * @param {String} key
   *
   * @returns {Boolean}
   */
  has (key) {
    return this._getStore().has(key);
  }

  _getStore () {
    const store = this._asyncLocalStorage.getStore();

    assert(Boolean(store), 'Associated AsyncStore is not set');

    return store;
  }
}


class AsyncStoreStub {
  constructor () {}

  run (callback) {
    callback();
  }

  exists () {
    return false;
  }

  set () {}

  get () {}

  has () {}
}

if (process.version >= 'v12.18.1') {
  module.exports = AsyncStore;
}
else {
  module.exports = AsyncStoreStub;
}
