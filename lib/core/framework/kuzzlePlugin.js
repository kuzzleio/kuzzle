/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

const _ = require('lodash');
const assert = require('assert');

class KuzzlePlugin {
  constructor (name, kuzzleVersion) {
    Reflect.defineProperty(this, 'name', {
      enumerable: true,
      value: name
    });

    Reflect.defineProperty(this, 'kuzzleVersion', {
      enumerable: true,
      value: kuzzleVersion
    });

    Reflect.defineProperty(this, '_context', {
      writable: true
    });

    Reflect.defineProperty(this, '_config', {
      writable: true
    });
  }

  get context () { return this._context; }

  get config () { return this._config; }

  init (config, context) {
    this._config = config;
    this._context = context;
  }
}

module.exports = KuzzlePlugin;