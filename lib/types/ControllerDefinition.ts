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

import { JSONObject } from 'kuzzle-sdk';
import { KuzzleRequest } from '../api/request';

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
export type ControllerDefinition = {
  /**
   * Definition of controller actions
   *
   * @example
   * {
   *   sayHello: {
   *     handler: async request => `Hello, ${request.input.args.name}`,
   *     http: [{ verb: 'POST', path: '/greeting/hello/:name' }],
   *     openapi: {
   *       "/_/greeting/sayHello": {
   *         get: {
   *           description: "Simply say hello",
   *           responses: {
   *             200: {
   *               description: "Custom greeting",
   *               content: {
   *                 "application/json": {
   *                   schema: {
   *                     type: "string",
   *                   }
   *                 }
   *               }
   *             }
   *           }
   *         }
   *       }
   *     }
   *   }
   * }
   */
  actions: {
    /**
     * Name of the API action
     */
    [action: string]: {
      /**
       * Function handler for incoming requests.
       */
      handler: (request: KuzzleRequest) => Promise<any>,
      /**
       * Declare HTTP routes (optional).
       * Http routes will be auto-generated unless at least one is provided
       * or an empty array is provided.
       */
      http?: HttpRoute[]
      /**
       * Provide a (openAPI specification v3)[https://swagger.io/specification/#paths-object] for this route.
       * Kuzzle only expect the `paths` object of the specification.
       * When not defined, Kuzzle generate one from the action definition by itself.
       *
       * @example
       * {
       *   "/_/greeting/sayHello/{name}": {
       *     get: {
       *       description: "Simply say hello",
       *       parameters: [{
       *         in: "path",
       *         name: "name",
       *         schema: {
       *           type: "integer"
       *         },
       *         required: true,
       *       }],
       *       responses: {
       *         200: {
       *           description: "Custom greeting",
       *           content: {
       *             "application/json": {
       *               schema: {
       *                 type: "string",
       *               }
       *             }
       *           }
       *         }
       *       }
       *     }
       *   }
       * }
       */
      openapi?: JSONObject
    }
  }
};

/**
 * Http route definition
 */
export type HttpRoute = {
  /**
   * HTTP verb.
   */
  verb: 'get' | 'post' | 'put' | 'delete' | 'head',
  /**
   * Route path.
   * A route starting with `/` will be prefixed by `/_` otherwise the route
   * will be prefixed by `/_/<application-name>/`.
   */
  path: string
  /**
   * Provide a (openAPI specification v3)[https://swagger.io/specification/#paths-object] for this route.
   * Kuzzle only expect the `paths` object of the specification.
   * When not defined, Kuzzle generate one from the action definition by itself.
   *
   * @example
   * {
   *   "/_/greeting/sayHello/{name}": {
   *     get: {
   *       description: "Simply say hello",
   *       parameters: [{
   *         in: "path",
   *         name: "name",
   *         schema: {
   *           type: "integer"
   *         },
   *         required: true,
   *       }],
   *       responses: {
   *         200: {
   *           description: "Custom greeting",
   *           content: {
   *             "application/json": {
   *               schema: {
   *                 type: "string",
   *               }
   *             }
   *           }
   *         }
   *       }
   *     }
   *   }
   * }
   */
  openapi?: JSONObject
};
