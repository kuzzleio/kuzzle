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

import type { JSONObject } from "./JSONObject";

import type { Logger } from "../kuzzle/Logger";
import type PluginManifest from "../core/plugin/pluginManifest";
import type { PluginContext } from "../core/plugin/pluginContext";
import type { PluginApiDefinition } from "./Plugin";
import type { HookEventHandler, RegisteredPipeHandler } from "./EventHandler";

/**
 * The hooks Kuzzle accepts off a plugin object: the public
 * `PluginHookDefinition`, plus the (deprecated) name of one of the plugin's
 * methods in place of a handler — the `string` — which the public type
 * leaves out (see there).
 */
type InstanceHookDefinition = {
  [event: string]: HookEventHandler | string | Array<HookEventHandler | string>;
};

/**
 * The pipes Kuzzle accepts off a plugin object: either handler form, or a
 * method name (see `PluginPipeDefinition`).
 */
type InstancePipeDefinition = {
  [event: string]:
    RegisteredPipeHandler | string | Array<RegisteredPipeHandler | string>;
};

/**
 * What Kuzzle needs of a plugin's own object. The full contract third parties
 * implement is the abstract `Plugin` in `lib/types/Plugin.ts`; this is the
 * subset this wrapper reads, and every member is optional because a plugin is
 * a user-supplied object that may declare none of them.
 */
export interface PluginInstance {
  /**
   * A plugin is a user-supplied object and may expose any member: the named
   * ones below are what Kuzzle reads, and handlers are routinely referenced by
   * name (`controllers.foo.bar = "someMethod"`), which needs this signature.
   */
  [member: string]: unknown;

  init?: (config: JSONObject, context: PluginContext) => unknown;
  /**
   * An application's own logger (`Backend.log`). Only an application has one —
   * a plain plugin does not — and it lives here, on the instance, not on the
   * `Plugin` wrapper: the shutdown path read it off the wrapper for years and
   * silently flushed nothing (TD-51).
   */
  log?: Logger;
  authenticators?: JSONObject;
  version?: string;
  _manifest?: PluginManifest;
  api?: PluginApiDefinition;
  imports?: JSONObject;
  hooks?: InstanceHookDefinition;
  pipes?: InstancePipeDefinition;
  /** The pre-Kaaf controller shape: controller → action → handler or method name. */
  controllers?: JSONObject;
  routes?: JSONObject[];
  /**
   * `JSONObject`, not `StrategyDefinition`: that type is the *authoring*
   * contract a plugin writes against, while this interface describes what
   * Kuzzle reads off a plugin object before anything has validated it.
   * `PluginsManager.validateStrategy` is what turns one into the other.
   */
  strategies?: JSONObject;
}

export interface PluginOptions {
  name?: string;
  application?: boolean;
  deprecationWarning?: boolean;
}
