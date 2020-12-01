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

import { PluginContext } from '../core/plugin/pluginContext';
import { ControllerDefinition } from './ControllerDefinition';
import { PluginManifest } from './PluginManifest';
import { EventHandler } from './EventHandler';
import { JSONObject} from '../../index';
import kerror from '../kerror';
import { has } from '../util/safeObject';

/**
 * Plugins must implements this interface.
 */
export abstract class Plugin {
  public _manifest: PluginManifest;

  /**
   * Plugin context.
   */
  public context: PluginContext;

  /**
   * Plugin config.
   */
  public config: JSONObject;

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

  constructor (manifest: PluginManifest) {
    if (! has(manifest, 'kuzzleVersion')) {
      throw new kerror.get('plugin', 'manifest', 'missing_version');
    }

    this._manifest = manifest;
  }
}