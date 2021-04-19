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

import util from 'util';

import _ from 'lodash';

import { ApplicationManager } from './index';


export class InternalLogger extends ApplicationManager {
  /**
   * Logs an debug message
   */
  debug (message: any): void {
    this._log('debug', message);
  }

  /**
   * Logs an info message
   */
  info (message: any): void {
    this._log('info', message);
  }

  /**
   * Logs a warn message
   */
  warn (message: any): void {
    this._log('warn', message);
  }

  /**
   * Logs an error message
   */
  error (message: any): void {
    this._log('error', message);
  }

  /**
   * Logs a verbose message
   */
  verbose (message: any): void {
    this._log('verbose', message);
  }

  private _log (level: string, message: any) {
    if (! this._application.started) {
      // eslint-disable-next-line no-console
      console.log(util.inspect(message));
    }
    else {
      this._kuzzle.log[level](util.inspect(message));
    }
  }
}