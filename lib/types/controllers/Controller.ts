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

import type { Backend } from "../../core/backend";
import type { ControllerDefinition } from "./ControllerDefinition";
import type { EmbeddedSDK } from "../../core/shared/sdk/embeddedSdk";

/**
 * Base class to declare a controller class
 */
export abstract class Controller {
  /**
   * Current application instance
   */
  protected app: Backend;

  /**
   * Controller name
   *
   * Optional: `app.controller.use()` derives it from the class name when the
   * author has not set one, which is the check that has always made this
   * field's absence a supported state rather than a missing initialiser.
   */
  public name?: string;

  /**
   * Controller definition
   *
   * @example
   * {
   *   actions: {
   *     sayHello: {
   *       handler: async request => `Hello, ${request.input.args.name}`,
   *       http: [{ verb: 'POST', path: '/greeting/hello/:name' }]
   *     }
   *   }
   * }
   *
   * Optional here because the documented pattern is to assign it in the
   * subclass constructor, which an `abstract` member forbids. It is
   * `app.controller.use()` that makes it mandatory, by rejecting a controller
   * without one — see Plugin.checkControllerDefinition.
   */
  public definition?: ControllerDefinition;

  /**
   * EmbeddedSDK instance
   */
  get sdk(): EmbeddedSDK {
    return this.app.sdk;
  }

  constructor(app: Backend) {
    this.app = app;
  }
}
