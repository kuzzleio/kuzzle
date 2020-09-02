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

import { Request } from 'kuzzle-common-objects';

/**
 * An interface representing an object with string key and any value
 */
export interface JSONObject {
  [key: string]: JSONObject | any
}

/**
 * API controller definition.
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
 */
export interface ControllerDefinition {
  actions: {
    /**
     * Name of the API action
     */
    [action: string]: {
      /**
       * Function handler for incoming requests.
       */
      handler: (request: Request) => Promise<any>,
      /**
       * Declare HTTP routes (optional).
       * Http routes will be auto-generated unless at least one is provided
       * or an empty array is provided.
       *
       */
      http?: Array<{
        /**
         * HTTP verb.
         */
        verb: string,
        /**
         * Route path.
         * A route starting with `/` will be prefixed by `/_` otherwise the route
         * will be prefixed by `/_/<application-name>/`
         */
        path: string
      }>
    }
  }
}

/**
 * Interface to declare and use a controller class
 */
export interface Controller {
  /**
   * Controller name
   */
  name: string;
  /**
   * Controller definition
   */
  definition: ControllerDefinition;
}

export interface BasePlugin {
  init: (config: JSONObject, context: any) => Promise<any> | any
}
