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

import type PluginManifest from "../core/plugin/pluginManifest";
import type { PluginContext } from "../core/plugin/pluginContext";
import type {
  PluginApiDefinition,
  PluginHookDefinition,
  PluginPipeDefinition,
} from "./Plugin";

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
  authenticators?: JSONObject;
  version?: string;
  _manifest?: PluginManifest;
  api?: PluginApiDefinition;
  imports?: JSONObject;
  hooks?: PluginHookDefinition;
  pipes?: PluginPipeDefinition;
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
