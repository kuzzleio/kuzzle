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
import { Backend } from '../core/application/backend';
import { PluginContext } from '../core/plugin/pluginContext';

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
         * will be prefixed by `/_/<application-name>/`.
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
  private app: Backend;

  /**
   * Controller name
   */
  public name: string;

  /**
   * Controller definition
   *
   * @example
   *
   * {
   *   actions: {
   *     sayHello: {
   *       handler: async request => `Hello, ${request.input.args.name}`,
   *       http: [{ verb: 'post', path: '/greeting/hello/:name' }]
   *     }
   *   }
   * }
   */
  public definition: ControllerDefinition;

  constructor (app: Backend) {
    this.app = app;
  }
}

/**
 * Type for handler attached to Kuzzle events. Either hooks or pipes.
 * `(...payload: any) => Promise<any>`
 */
export type EventHandler = (...payload: any) => Promise<any>

/**
 * Plugins must implements this interface.
 */
export abstract class Plugin {
  /**
   * Plugin context.
   *
   * Must be set in the plugin init() method before use.
   */
  protected context?: PluginContext;

  /**
   * Plugin config.
   *
   * Must be set in the plugin init() method before use.
   */
  protected config?: JSONObject;

  /**
   * Define new API controllers.
   *
   * @example
   *
   * this.api = {
   *   email: {
   *     actions: {
   *       send: {
   *         handler: async request => ...,
   *         http: [{ verb: 'post', path: '/email/send' }]
   *       }
   *     }
   *   }
   * }
   */
  public api?: {
    /**
     * Name of the API controller.
     */
    [controller: string]: ControllerDefinition
  }

  /**
   * Define hooks on Kuzzle events.
   *
   * @see https://docs.kuzzle.io/core/2/plugins/guides/hooks/
   *
   * @example
   *
   * this.hooks = {
   *   'security:afterCreateUser': async (request: Request) => ...
   * }
   */
  public hooks?: {
    /**
     * Event name or wildcard event.
     */
    [event: string]: Array<EventHandler> | EventHandler
  }

  /**
   * Define pipes on Kuzzle events.
   *
   * @see https://docs.kuzzle.io/core/2/plugins/guides/pipes/
   *
   * @example
   *
   * this.pipes = {
   *   'document:afterCreate': async (request: Request) => ...
   * }
   */
  public pipes?: {
    /**
     * Event name or wildcard event.
     */
    [event: string]: Array<EventHandler> | EventHandler
  }

  /**
   * Define authenticator classes used by strategies.
   *
   * @see https://docs.kuzzle.io/core/2/plugins/guides/strategies/overview
   */
  public authenticators?: {
    /**
     * The key is the authenticator name and the value is the class.
     */
    [name: string]: any
  }

  /**
   * Define authentications strategies.
   *
   * @see https://docs.kuzzle.io/core/2/plugins/guides/strategies/overview
   */
  public strategies?: {
    /**
     * Strategy name and definition.
     */
    [name: string]: {
      /**
       * Strategy configuration.
       */
      config: {
        /**
         * Name of a registered authenticator to use with this strategy.
         */
        authenticator: string,
        [key: string]: any
      },
      /**
       * Strategy methods.
       *
       * Each method must be exposed by the plugin
       * under the same name as specified.
       */
      methods: {
        afterRegister?: string,
        create: string,
        delete: string,
        exists: string,
        getById?: string,
        getInfo?: string,
        update: string,
        validate: string,
        verify: string,
      }
    }
  }

  /**
   * Plugin initialization method.
   *
   * Will be called during plugin initialization before Kuzzle starts to serve
   * requests.
   *
   * @see https://docs.kuzzle.io/core/2/plugins/guides/manual-setup/init-function/
   */
  abstract init (config: JSONObject, context: PluginContext): Promise<any> | any
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
