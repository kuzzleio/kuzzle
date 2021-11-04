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

import { PluginContext } from '../../core/plugin/pluginContext';
import { ControllerDefinition } from '../ControllerDefinition';
import { PluginManifest } from './PluginManifest';
import { StrategyDefinition } from '../StrategyDefinition';
import { EventHandler } from '../EventHandler';
import { JSONObject} from '../../../index';
import kerror from '../../kerror';
import { has } from '../../util/safeObject';

/**
 * Allows to define plugins controllers and actions
 */
export type PluginApiDefinition = {
  /**
   * Name of the API controller.
   */
  [controller: string]: ControllerDefinition
}

/**
 * Allows to define hooks on events
 */
export type PluginHookDefinition = {
  /**
   * Event name or wildcard event.
   */
  [event: string]: EventHandler | EventHandler[]
}

/**
 * Allows to define pipes on events
 */
export type PluginPipeDefinition = {
  /**
   * Event name or wildcard event.
   */
  [event: string]: EventHandler | EventHandler[]
}

/**
 * Plugins must implements this abstract class.
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
  public api?: PluginApiDefinition

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
  public hooks?: PluginHookDefinition

  /**
   * Define pipes on Kuzzle events.
   *
   * @see https://docs.kuzzle.io/core/2/guides/write-plugins/4-old-guides/pipes
   *
   * @example
   *
   * this.pipes = {
   *   'document:afterCreate': async (request: Request) => ...
   * }
   */
  public pipes?: PluginPipeDefinition

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
  public strategies?: StrategyDefinition

  /**
   * Plugin initialization method.
   *
   * Will be called during plugin initialization before Kuzzle starts to serve
   * requests.
   *
   * @see https://docs.kuzzle.io/core/2/plugins/guides/manual-setup/init-function/
   */
  abstract init (config: JSONObject, context: PluginContext): Promise<any> | any

  /**
   * @param manifest Manifest containing the required kuzzleVersion number
   */
  constructor (manifest: PluginManifest) {
    if (! has(manifest, 'kuzzleVersion')) {
      // eslint-disable-next-line new-cap
      throw new kerror.get('plugin', 'manifest', 'missing_version');
    }

    this._manifest = manifest;
  }
}