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

import * as kerror from '../../kerror';
import { EventHandler } from '../../types';
import { ApplicationManager } from './index';

const assertionError = kerror.wrap('plugin', 'assert');
const runtimeError = kerror.wrap('plugin', 'runtime');

export class BackendHook extends ApplicationManager {
  /**
   * Registers a new hook on an event
   *
   * @param event - Event name
   * @param handler - Function to execute when the event is triggered
   *
   */
  register (event: string, handler: EventHandler): void {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'hook');
    }

    if (typeof handler !== 'function') {
      throw assertionError.get('invalid_hook', event);
    }

    if (! this._application._hooks[event]) {
      this._application._hooks[event] = [];
    }

    this._application._hooks[event].push(handler);
  }
}