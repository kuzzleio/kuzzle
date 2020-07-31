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
      // @todo use KuzzleRequest from common objects
      /**
       * Function handler for incoming requests.
       */
      handler: (request: any) => Promise<any>,
      /**
       * Declare optional HTTP routes.
       * Http routes will be auto-generated unless they are provided or an empty array
       * is provided.
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

export interface BasePlugin {
  init: (config: JSONObject, context: any) => Promise<void> | void
}
