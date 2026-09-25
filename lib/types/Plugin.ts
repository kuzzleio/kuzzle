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

import type { JSONObject } from "kuzzle-sdk";
import type { PluginContext } from "../core/plugin/pluginContext";
import type { ControllerDefinition } from "./controllers/ControllerDefinition";
import type { PluginManifest } from "./PluginManifest";
import type { StrategyDefinition } from "./StrategyDefinition";
import type { HookEventHandler, RegisteredPipeHandler } from "./EventHandler";
import * as kerror from "../kerror";
import { has } from "../util/safeObject";
import type { ImportConfig } from "./Kuzzle";

/**
 * Allows to define plugins controllers and actions
 */
export type PluginApiDefinition = {
  /**
   * Name of the API controller.
   */
  [controller: string]: ControllerDefinition;
};

/**
 * A hook or pipe target given as the **name** of one of the plugin's methods
 * instead of the function itself.
 *
 * @deprecated Pass the function. Kuzzle still resolves the name, and prints a
 * deprecation warning when it registers the handler.
 */
export type PluginMethodName = string;

/**
 * Allows to define hooks on events
 */
export type PluginHookDefinition = {
  /**
   * Event name or wildcard event.
   */
  [event: string]:
    | HookEventHandler
    | PluginMethodName
    | Array<HookEventHandler | PluginMethodName>;
};

/**
 * Allows to define pipes on events.
 *
 * A pipe either returns a promise, or takes a trailing `callback(error,
 * request)`: both forms are documented, and the runner accepts both.
 */
export type PluginPipeDefinition = {
  /**
   * Event name or wildcard event.
   */
  [event: string]:
    | RegisteredPipeHandler
    | PluginMethodName
    | Array<RegisteredPipeHandler | PluginMethodName>;
};

/**
 * Plugins must implements this abstract class.
 */
export abstract class Plugin {
  public _manifest: PluginManifest;

  /**
   * Plugin context.
   *
   * Kuzzle hands it to `init(config, context)` and never assigns it here:
   * storing it is the documented convention plugin authors follow. It is
   * declared as always present (`!`) because that is what every method but
   * `init` can rely on, and what v2.56.0 declared — an optional field made
   * every `this.context.*` of a `strict` plugin a compile error.
   */
  public context!: PluginContext;

  /**
   * Plugin config.
   *
   * Declared as always present for the same reason as {@link context}.
   */
  public config!: JSONObject;

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
  public api?: PluginApiDefinition;

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
  public hooks?: PluginHookDefinition;

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
  public pipes?: PluginPipeDefinition;

  /**
   * Define authenticator classes used by strategies.
   *
   * @see https://docs.kuzzle.io/core/2/plugins/guides/strategies/overview
   */
  public authenticators?: {
    /**
     * The key is the authenticator name and the value is the class.
     */
    [name: string]: any;
  };

  /**
   * Define authentications strategies.
   *
   * @see https://docs.kuzzle.io/core/2/plugins/guides/strategies/overview
   */
  public strategies?: StrategyDefinition;

  /**
   * Define default imports
   */
  public imports?: ImportConfig;

  /**
   * Plugin initialization method.
   *
   * Will be called during plugin initialization before Kuzzle starts to serve
   * requests.
   *
   * @see https://docs.kuzzle.io/core/2/plugins/guides/manual-setup/init-function/
   */
  abstract init(config: JSONObject, context: PluginContext): Promise<any> | any;

  /**
   * @param manifest Manifest containing the required kuzzleVersion number
   */
  constructor(manifest: PluginManifest) {
    if (!has(manifest, "kuzzleVersion")) {
      // eslint-disable-next-line new-cap
      throw kerror.get("plugin", "manifest", "missing_version");
    }

    this._manifest = manifest;
  }
}
