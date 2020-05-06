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

'use strict';

const path = require('path');
const fs = require('fs');

const PluginContext = require('./context');
const PrivilegedPluginContext = require('./privilegedContext');
const errorsManager = require('../../util/errors');
const Manifest = require('./pluginManifest');
const { loadPluginsErrors } = require('../../config/error-codes');

const assertionError = errorsManager.wrap('plugin', 'assert');
const runtimeError = errorsManager.wrap('plugin', 'runtime');

const PLUGIN_NAME_REGEX = /^[a-z-]+$/;

class Plugin {
  constructor (instance, { name, primary=false } = {}) {
    this._instance = instance;

    this._primary = primary;

    this._initCalled = false;
    this._config = {};
    this._context = null;
    this._version = '';
    this._name = '';
    this._manifest = null;

    if (name) {
      this.name = name;
    }
  }

  init (kuzzle, name) {
    this.name = name;

    if (kuzzle.config.plugins[this.name]) {
      this.config = JSON.parse(JSON.stringify(kuzzle.config.plugins[this.name]));
    }

    // check plugin privileged prerequisites
    // user need to acknowledge privileged mode in plugin configuration
    if (this.config.privileged) {
      if (! this.manifest.privileged) {
        throw assertionError.get('privileged_not_supported', this.name);
      }
    }
    else if (this.manifest.privileged) {
      throw assertionError.get('privileged_not_set', this.name);
    }


    this._context = this.config.privileged
      ? new PrivilegedPluginContext(kuzzle, this.name)
      : new PluginContext(kuzzle, this.name);
  }

  // getters/setters ===========================================================

  get instance () { return this._instance; }

  get kuzzle () { return this._kuzzle; }

  get context () { return this._context; }

  get config () { return this._config; }
  set config (config) { this._config = config; }

  get version () { return this._version; }
  set version (version) { this._version = version; }

  get name () { return this._name; }
  set name (name) {
    Plugin.checkName(name);

    this._name = name;
  }

  get manifest () { return this._manifest; }
  set manifest (manifest) {
    this._manifest = manifest;
  }

  // static methods ============================================================

  static loadFromDirectory (kuzzle, pluginPath) {
    if (! fs.statSync(pluginPath).isDirectory()) {
      throw assertionError.get('cannot_load', pluginPath, 'Not a directory.');
    }

    let plugin;

    // load plugin definition
    try {
      const PluginClass = require(pluginPath);

      const pluginClass = new PluginClass();

      plugin = new Plugin(pluginClass);
    }
    catch (e) {
      if (e.message.match(/not a constructor/i)) {
        throw assertionError.get('not_a_constructor', plugin.name);
      }

      throw runtimeError.getFrom(e, 'unexpected_error', e.message);
    }

    // check if the plugin exposes a "init" method
    if (typeof plugin.instance.init !== 'function') {
      throw assertionError.get('init_not_found', plugin.name);
    }

    // load manifest
    plugin.manifest = new Manifest(kuzzle, pluginPath);

    // load plugin version if exists
    const packageJsonPath = path.join(pluginPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      plugin.version = require(packageJsonPath).version;
    }

    // load customs errors configuration file
    if (plugin.manifest.raw.errors) {
      try {
        // we use the manifest name instead of the lowerCased plugin name
        // to ensure to match the plugin original name in the configuration
        const pluginCode = kuzzle.config[plugin.manifest.name] && kuzzle.config[plugin.manifest.name]._pluginCode
          ? kuzzle.config[plugin.manifest.name]._pluginCode // @todo put _pluginCode in the manifest
          : 0x00;

        loadPluginsErrors(plugin.manifest.raw, pluginCode);

        kuzzle.log.info(`[${plugin.name}] Custom errors successfully loaded.`);
      }
      catch (err) {
        if ( err.message.match(/Error configuration file/i)
          || err instanceof SyntaxError
        ) {
          throw errorsManager.getFrom(
            err,
            'plugin',
            'manifest',
            'invalid_errors',
            plugin.manifest.name,
            err.message);
        }

        throw err;
      }
    }

    plugin.init(kuzzle, plugin.manifest.raw.name);

    return plugin;
  }

  static checkName (name) {
    if (! PLUGIN_NAME_REGEX.test(name)) {
      throw assertionError.get('invalid_plugin_name', name)
    }
  }
}

module.exports = Plugin;