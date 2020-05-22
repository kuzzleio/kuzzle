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
const assert = require('assert');
const fs = require('fs');

const PluginContext = require('./context');
const PrivilegedPluginContext = require('./privilegedContext');
const kerror = require('../../kerror');
const Manifest = require('./pluginManifest');

const assertionError = kerror.wrap('plugin', 'assert');
const runtimeError = kerror.wrap('plugin', 'runtime');

const PLUGIN_NAME_REGEX = /^[a-z-]+$/;

class Plugin {
  constructor (instance, { name, application=false } = {}) {
    this._instance = instance;

    this._application = application;

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
    else if (this.manifest && this.manifest.privileged) {
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

  get application () { return this._application; }

  get errorPrefix () { return `[${this.name}]:` }

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

  static loadFromClass (PluginClass) {
    const plugin = this._instantiatesPlugin(PluginClass);

    // check if the plugin exposes a "init" method
    if (typeof plugin.instance.init !== 'function') {
      throw assertionError.get('init_not_found', plugin.name);
    }

    // @todo do better LOL
    assert(plugin.instance.name, `Plugin "${PluginClass.name}" must have a name`);

    // @todo kuzzleVersion

    return plugin;
  }

  static loadFromDirectory (kuzzle, pluginPath) {
    if (! fs.statSync(pluginPath).isDirectory()) {
      throw assertionError.get('cannot_load', pluginPath, 'Not a directory.');
    }

    const plugin = this._instantiatesPlugin(pluginPath);

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

          kerror.loadPluginsErrors(plugin.manifest.raw, pluginCode);

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

    // check if the plugin exposes a "init" method
    if (typeof plugin.instance.init !== 'function') {
      throw assertionError.get('init_not_found', plugin.name);
    }

    return plugin;
  }

  static checkName (name) {
    if (! PLUGIN_NAME_REGEX.test(name)) {
      throw assertionError.get('invalid_plugin_name', name)
    }
  }

  /**
   * Instantiates the plugin class and wrap it in a Kuzzle plugin
   *
   * @param {Class|String} - Plugin class or path to a module to require
   */
  static _instantiatesPlugin (PluginClassOrPath) {
    try {
      const PluginClass = typeof PluginClassOrPath === 'string'
        ? require(PluginClassOrPath)
        : PluginClassOrPath;

      const pluginClass = new PluginClass();

      return new Plugin(pluginClass);
    }
    catch (error) {
      if (error.message.match(/not a constructor/i)) {
        throw assertionError.get('not_a_constructor', PluginClass.name);
      }

      throw runtimeError.getFrom(error, 'unexpected_error', error.message);
    }
  }
}

module.exports = Plugin;