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

import { Inflector } from '../../util/inflector';
import * as kerror from '../../kerror';
import { JSONObject } from '../../../index';
import { Plugin } from '../../types';
import { ApplicationManager } from './index';
import didYouMean from '../../util/didYouMean';

const assertionError = kerror.wrap('plugin', 'assert');
const runtimeError = kerror.wrap('plugin', 'runtime');

export class BackendPlugin extends ApplicationManager {
  /**
   * Uses a plugin in this application.
   *
   * Plugin name will be inferred from the class name.
   * e.g. `DeviceManagerPlugin` => `device-manager`
   *
   * @param plugin - Plugin instance
   * @param options - Additionnal options
   *    - `name`: Specify a plugin's name instead of using the class name.
   *    - `manifest`: Manually add a manifest definition
   *    - `deprecationWarning`: If false, does not display deprecation warnings
   */
  use (
    plugin: Plugin,
    options: { name?: string; manifest?: JSONObject; deprecationWarning?: boolean } = {}
  ): void {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'plugin');
    }

    // Avoid plain objects
    if ((typeof plugin.constructor !== 'function'
      || plugin.constructor.name === 'Object')
      && ! options.name
    ) {
      throw assertionError.get('no_name_provided');
    }

    const name: string = options.name
      || Inflector.kebabCase(plugin.constructor.name.replace('Plugin', ''));

    if (! this._application.PluginObject.checkName(name)) {
      throw assertionError.get('invalid_plugin_name', name);
    }

    if (this._application._plugins[name]) {
      throw assertionError.get('name_already_exists', name);
    }

    if (typeof plugin.init !== 'function') {
      throw assertionError.get('init_not_found', name);
    }

    this._application._plugins[name] = { options, plugin };
  }

  /**
   * Gets the instance of an already loaded plugin.
   *
   * @param name Plugin name
   */
  get (name: string): Plugin {
    if (! this._application._plugins[name]) {
      throw assertionError.get('plugin_not_found', name, didYouMean(name, this.list()));
    }

    return this._application._plugins[name].plugin;
  }

  /**
   * Lists loaded plugins
   */
  list (): string[] {
    return Object.keys(this._application._plugins);
  }
}
