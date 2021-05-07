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

import { Inflector } from '../../util/inflector';
import kerror from '../../kerror';
import { ControllerDefinition, Controller } from '../../types';
import { ApplicationManager } from './index';

const assertionError = kerror.wrap('plugin', 'assert');
const runtimeError = kerror.wrap('plugin', 'runtime');

export class BackendController extends ApplicationManager {
  /**
   * Registers a new controller.
   *
   * Http routes will be auto-generated unless they are provided or an empty array
   * is provided.
   *
   * @param name - Controller name
   * @param definition - Controller definition
   *
   * @example
   * app.controller.register('greeting', {
   *   actions: {
   *     sayHello: {
   *       handler: async request => `Hello, ${request.input.args.name}`,
   *       http: [{ verb: 'post', path: 'greeting/hello/:name' }]
   *     }
   *   }
   * })
   *
   */
  register (name: string, definition: ControllerDefinition) {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'controller');
    }

    this._add(name, definition);
  }

  /**
   * Uses a new controller class.
   *
   * The controller class must:
   *  - call the super constructor with the application instance
   *  - extend the "Controller" class
   *  - define the "definition" property
   *  - (optional) define the "name" property
   *
   * The controller name will be inferred from the class name.
   *   e.g. "PaymentSolutionController" will become "payment-solution"
   *
   * @example
   *
   * class EmailController extends Controller {
   *   constructor (app) {
   *     super(app);
   *
   *     this.definition = {
   *       actions: {
   *         send: {
   *           handler: this.send
   *         }
   *       }
   *     };
   *   }
   *
   *   async send (request: Request) {
   *     // ...
   *   }
   * }
   *
   * app.controller.use(new EmailController(app));
   *
   * @param controller Controller class
   */
  use (controller: Controller) {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'controller');
    }

    if (! controller.name) {
      controller.name = Inflector.kebabCase(controller.constructor.name)
        .replace('-controller', '');
    }

    for (const [action, definition] of Object.entries(controller.definition.actions)) {
      if (typeof definition.handler !== 'function') {
        throw assertionError.get(
          'invalid_controller_definition',
          controller.name,
          `Handler for action "${action}" is not a function.`);
      }

      // if the function handler is an instance method,
      // bind the context to the controller instance
      const handlerName = definition.handler.name;
      if (handlerName && typeof controller[handlerName] === 'function') {
        definition.handler = definition.handler.bind(controller);
      }
    }

    this._add(controller.name, controller.definition);
  }

  private _add (name: string, definition: ControllerDefinition) {
    // Check definition here to throw error early
    // with the corresponding line number
    this._application.PluginObject.checkControllerDefinition(name, definition, { application: true });

    if (this._application._controllers[name]) {
      throw assertionError.get(
        'invalid_controller_definition',
        name,
        'A controller with this name already exists');
    }

    this._application._controllers[name] = definition;
  }
}