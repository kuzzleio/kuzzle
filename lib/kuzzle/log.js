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

class Logger {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;
    this.logMethods = ['info', 'warn', 'error', 'silly', 'debug', 'verbose'];

    this._useConsole();

    this.kuzzle.once('core:kuzzleStart', this._useLogger.bind(this));
  }

  _useConsole() {
    // until kuzzle has started, use the console to print logs
    for (const method of this.logMethods) {
      /* eslint-disable-next-line no-console */
      this[method] = console[method] || console.log;
    }
  }

  _useLogger() {
    // when kuzzle has started, use the event to dispatch logs
    for (const method of this.logMethods) {
      this[method] = message => {
        if (this.kuzzle.asyncStore.exists() && this.kuzzle.asyncStore.has('REQUEST')) {
          const request = this.kuzzle.asyncStore.get('REQUEST');

          this.kuzzle.emit(`log:${method}`, `[${request.id}] ${message}`);
        }
        else {
          this.kuzzle.emit(`log:${method}`, message);
        }
      };
    }
  }
}

module.exports = Logger;
