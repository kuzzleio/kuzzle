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

class Logger {
  constructor() {
    this.logMethods = ["info", "warn", "error", "silly", "debug", "verbose"];

    this.failsafeModeString = global.kuzzle.config.plugins.common.failsafeMode
      ? "[FAILSAFE MODE] "
      : "";

    this._useConsole();

    global.kuzzle.once("core:kuzzleStart", this._useLogger.bind(this));
  }

  _useConsole() {
    // until kuzzle has started, use the console to print logs
    for (const method of this.logMethods) {
      this[method] = (message) => {
        /* eslint-disable-next-line no-console */
        const writer = console[method] || console.log;

        writer(`${this.failsafeModeString}${message}`);
      };
    }
  }

  _useLogger() {
    // when kuzzle has started, use the event to dispatch logs
    for (const method of this.logMethods) {
      this[method] = (message) => {
        if (
          global.kuzzle.asyncStore.exists() &&
          global.kuzzle.asyncStore.has("REQUEST")
        ) {
          const request = global.kuzzle.asyncStore.get("REQUEST");

          global.kuzzle.emit(
            `log:${method}`,
            `[${global.kuzzle.id}] ${this.failsafeModeString}[${request.id}] ${message}`
          );
        } else {
          global.kuzzle.emit(
            `log:${method}`,
            `[${global.kuzzle.id}] ${this.failsafeModeString}${message}`
          );
        }
      };
    }
  }
}

module.exports = Logger;
