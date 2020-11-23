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

import { Request } from '../api/request';
import { Backend } from '../core/application/backend';

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
        verb: 'get' | 'post' | 'put' | 'delete' | 'head',
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
   */
  public definition: ControllerDefinition;

  constructor (app: Backend) {
    this.app = app;
  }
}

export interface BasePlugin {
  init: (config: JSONObject, context: any) => Promise<any> | any
}

/**
 * Kuzzle API request
 *
 * @see https://docs.kuzzle.io/core/2/api/essentials/query-syntax/#other-protocols
 */
export interface KuzzleRequest extends JSONObject {
  controller: string;
  action: string;
  index?: string;
  collection?: string;
  _id?: string;
  jwt?: string;
  volatile?: JSONObject;
  body?: JSONObject;
  [key: string]: any;
}

/**
 * Kuzzle API response
 *
 * @see https://docs.kuzzle.io/core/2/api/essentials/kuzzle-response/
 */
export interface KuzzleResponse extends JSONObject {
  controller: string;
  action: string;
  index?: string;
  collection?: string;
  error?: {
    id: string;
    code: number;
    message: string;
    status: number;
    stack?: string;
  };
  requestId: string;
  result: any;
  status: number;
  volatile?: JSONObject;
  room?: string;
}

/**
 * Deprecation warning about a specific feature.
 * Only available in developement mode (NODE_ENV=development)
 */
export interface Deprecation {
  /**
   * Version since the feature is deprecated
   */
  version: string;
  /**
   * Information about the deprecation, replacement, etc.
   */
  message: string;
}