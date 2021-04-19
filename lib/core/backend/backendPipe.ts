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

import _ from 'lodash';

import kerror from '../../kerror';
import { EventHandler } from '../../types';
import { ApplicationManager } from './index';

const assertionError = kerror.wrap('plugin', 'assert');
const runtimeError = kerror.wrap('plugin', 'runtime');

export class BackendPipe extends ApplicationManager {
  /**
   * Registers a new pipe on an event
   *
   * @param event - Event name
   * @param handler - Function to execute when the event is triggered
   */
  register (event: string, handler: EventHandler, options: any = {}): string | void {
    if (this._application.started && options.dynamic !== true) {
      throw runtimeError.get('already_started', 'pipe.register');
    }

    if (typeof handler !== 'function') {
      throw assertionError.get('invalid_pipe', event);
    }

    if (this._application.started) {
      return global.kuzzle.pluginsManager.registerPipe(
        global.kuzzle.pluginsManager.application,
        event,
        handler);
    }

    if (! this._application._pipes[event]) {
      this._application._pipes[event] = [];
    }

    this._application._pipes[event].push(handler);
  }

  unregister (pipeId: string): void {
    if (! this._application.started) {
      throw runtimeError.get('unavailable_before_start', 'pipe.unregister');
    }

    global.kuzzle.pluginsManager.unregisterPipe(pipeId);
  }
}