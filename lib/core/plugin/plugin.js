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

const PluginContext = require('./pluginContext');
const PrivilegedPluginContext = require('./privilegedContext');
const kerror = require('../../kerror');
const errorCodes = require('../../kerror/codes');
const Manifest = require('./pluginManifest');
const { has, isPlainObject } = require('../../util/safeObject');

const assertionError = kerror.wrap('plugin', 'assert');
const runtimeError = kerror.wrap('plugin', 'runtime');

const PLUGIN_NAME_REGEX = /^[a-z-]+$/;
const HTTP_VERBS = ['get', 'head', 'post', 'put', 'delete', 'patch', 'options'];

class Plugin {
  constructor (kuzzle, instance, { name, application=false } = {}) {
    Reflect.defineProperty(this, '_kuzzle', {
      value: kuzzle
    });

    this._instance = instance;

    this._application = application;

    this._initCalled = false;
    this._config = {};
    this._context = null;
    this._version = instance.version || '';
    this._name = '';
    this._manifest = null;

    if (name) {
      this.name = name;
    }
  }

  init (name) {
    this.name = name;

    if (this.kuzzle.config.plugins[this.name]) {
      this.config = JSON.parse(JSON.stringify(this.kuzzle.config.plugins[this.name]));
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
      ? new PrivilegedPluginContext(this.kuzzle, this.name)
      : new PluginContext(this.kuzzle, this.name);
  }

  info () {
    /* eslint-disable sort-keys */
    if (this.application) {
      return {
        name: this.name,
        version: this.version,
        controllers: this.instance.api,
        pipes: Object.keys(this.instance.pipes),
        hooks: Object.keys(this.instance.hooks),
      };
    }

    const description = {
      controllers: [],
      hooks: [],
      manifest: this.manifest,
      pipes: [],
      routes: [],
      strategies: [],
      version: this.version
    };
    /* eslint-enable sort-keys */

    if (has(this.instance, 'hooks')) {
      description.hooks = Object.keys(this.instance.hooks);
    }

    if (has(this.instance, 'pipes')) {
      description.pipes = Object.keys(this.instance.pipes);
    }

    if (has(this.instance, 'controllers')) {
      description.controllers = Object
        .keys(this.instance.controllers)
        .map(controller => `${this.name}/${controller}`);
    }

    if (has(this.instance, 'routes')) {
      description.routes = this.instance.routes;
    }

    if (has(this.instance, 'strategies')) {
      description.strategies = Object.keys(this.instance.strategies);
    }

    return description;
  }

  // getters/setters ===========================================================

  get instance () { return this._instance; }

  get kuzzle () { return this._kuzzle; }

  get context () { return this._context; }

  get application () { return this._application; }

  get logPrefix () { return `[${this.name}]`; }

  get config () { return this._config; }
  set config (config) { this._config = config; }

  get version () { return this._version; }
  set version (version) { this._version = version; }

  get name () { return this._name; }
  set name (name) {
    if (! this.constructor.checkName(name)) {
      this.kuzzle.log.warn(`${this.logPrefix} Plugin names should be in kebab-case. This behavior will be enforced in futur versions of Kuzzle."`);
    }

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
    let PluginClass = {};
    try {
      PluginClass = require(pluginPath);

      const pluginInstance = new PluginClass();

      plugin = new Plugin(kuzzle, pluginInstance);
    }
    catch (error) {
      if (error.message.match(/not a constructor/i)) {
        throw assertionError.get('not_a_constructor', PluginClass.name);
      }

      throw runtimeError.getFrom(error, 'unexpected_error', error.message);
    }
    // load manifest
    plugin.manifest = new Manifest(kuzzle, pluginPath);
    plugin.name = plugin.manifest.name;

    // load plugin version if exists
    const packageJsonPath = path.join(pluginPath, 'package.json');
    if (fs.existsSync(packageJsonPath) && ! plugin.version) {
      plugin.version = require(packageJsonPath).version;
    }

    // load customs errors configuration file
    if (plugin.manifest.raw.errors) {
      try {
        // we use the manifest name instead of the lowerCased plugin name
        // to ensure to match the plugin original name in the configuration
        const pluginCode = kuzzle.config[plugin.manifest.name] && kuzzle.config[plugin.manifest.name]._pluginCode
          ? kuzzle.config[plugin.manifest.name]._pluginCode
          : 0x00;

        errorCodes.loadPluginsErrors(plugin.manifest.raw, pluginCode);

        kuzzle.log.info(`${plugin.logPrefix} Custom errors successfully loaded.`);
      }
      catch (err) {
        if ( err.message.match(/Error configuration file/i)
          || err instanceof SyntaxError
        ) {
          throw kerror.getFrom(
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
    return PLUGIN_NAME_REGEX.test(name);
  }

  static checkControllerDefinition (name, definition) {
    if (typeof name !== 'string') {
      throw assertionError.get(
        'invalid_controller_definition',
        'Controller name must be a string');
    }

    if (! isPlainObject(definition)) {
      throw assertionError.get(
        'invalid_controller_definition',
        name,
        'definition must be an object');
    }

    for (const [action, actionDefinition] of Object.entries(definition.actions)) {
      const actionProperties = Object.keys(actionDefinition);

      if (actionProperties.length > 2) {
        actionProperties.splice(actionProperties.indexOf('handler'), 1);
        actionProperties.splice(actionProperties.indexOf('http'), 1);

        throw assertionError.get(
          'invalid_controller_definition',
          name,
          `action "${action}" has invalid properties: ${actionProperties.join(', ')}`);
      }

      if (typeof action !== 'string') {
        throw assertionError.get(
          'invalid_controller_definition',
          name,
          'action names must be strings');
      }

      if (typeof actionDefinition.handler !== 'function') {
        throw assertionError.get(
          'invalid_controller_definition',
          name,
          `action "${action}" handler must be a function`);
      }

      if (actionDefinition.http) {
        if (! Array.isArray(actionDefinition.http)) {
          throw assertionError.get(
            'invalid_controller_definition',
            name,
            `action "${action}" http definition must be an array`);
        }

        for (const route of actionDefinition.http) {
          if (typeof route.verb !== 'string' || route.verb.length === 0) {
            throw assertionError.get(
              'invalid_controller_definition',
              name,
              `action "${action}" http verb must be a non-empty string`);
          }

          if (! HTTP_VERBS.includes(route.verb.toLowerCase())) {
            throw assertionError.get(
              'invalid_controller_definition',
              name,
              `action "${action}" http verb "${route.verb}" is not a valid http verb`);
          }

          if (typeof route.url !== 'string' || route.url.length === 0) {
            throw assertionError.get(
              'invalid_controller_definition',
              name,
              `action "${action}" http url must be a non-empty string`);
          }

          const routeProperties = Object.keys(route);
          if (routeProperties.length > 2) {
            routeProperties.splice(routeProperties.indexOf('url'), 1);
            routeProperties.splice(routeProperties.indexOf('verb'), 1);

            throw assertionError.get(
              'invalid_controller_definition',
              name,
              `action "${action}" has invalid http properties: ${routeProperties.join(', ')}`);
          }
        }
      }
    }
  }
}

module.exports = Plugin;
