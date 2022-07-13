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

import { Backend } from "../core/backend";
import { ControllerDefinition } from "./ControllerDefinition";
import { EmbeddedSDK } from "../core/shared/sdk/embeddedSdk";

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
   */
  public name: string;

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
   */
  public definition: ControllerDefinition;

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
