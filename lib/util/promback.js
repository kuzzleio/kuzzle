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
"use strict";

const Bluebird = require("bluebird");

class Promback {
  constructor(callback = null) {
    this._callback = callback;
    this._resolve = null;
    this._reject = null;
    this.deferred = null;
    this.isPromise = this._callback === null;

    if (this.isPromise) {
      this.deferred = new Bluebird((res, rej) => {
        this._resolve = res;
        this._reject = rej;
      });
    }
  }

  resolve(result) {
    if (this.isPromise) {
      this._resolve(result);
    } else {
      this._callback(null, result);
    }

    return this.deferred;
  }

  reject(error) {
    if (this.isPromise) {
      this._reject(error);
    } else {
      this._callback(error);
    }

    return this.deferred;
  }

  get promise() {
    return this.deferred;
  }
}

module.exports = Promback;
