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

'use strict';

const path = require('path');
const fs = require('fs');
const semver = require('semver');

const { PluginContext } = require('./pluginContext');
const PrivilegedPluginContext = require('./privilegedContext');
const kerror = require('../../kerror');
const errorCodes = require('../../kerror/codes');
const Manifest = require('./pluginManifest');
const { has, isPlainObject } = require('../../util/safeObject');

const assertionError = kerror.wrap('plugin', 'assert');
const runtimeError = kerror.wrap('plugin', 'runtime');

const PLUGIN_NAME_REGEX = /^[a-z-\d]+$/;
const HTTP_VERBS = ['get', 'head', 'post', 'put', 'delete', 'patch', 'options'];

class Plugin {
  constructor (
    instance,
    { name, application = false, deprecationWarning = true } = {}
  ) {
    this._instance = instance;

    this._application = application;

    this._initCalled = false;
    this._config = {};
    this._context = null;
    this._version = instance.version || '';
    this._name = '';
    this._manifest = instance._manifest || null;
    this._deprecationWarning = deprecationWarning;

    if (name) {
      this.name = name;
    }
  }

  init (name) {
    this.name = name;

    if (global.kuzzle.config.plugins[this.name]) {
      this.config = JSON.parse(JSON.stringify(global.kuzzle.config.plugins[this.name]));
    }

    // check plugin privileged prerequisites
    // user need to acknowledge privileged mode in plugin configuration
    if (this.config.privileged) {
      if (! this.manifest || ! this.manifest.privileged) {
        throw assertionError.get('privileged_not_supported', this.name);
      }
    }
    else if (this.manifest && this.manifest.privileged) {
      throw assertionError.get('privileged_not_set', this.name);
    }

    if (this.manifest && this.manifest.kuzzleVersion) {
      if (! semver.satisfies(global.kuzzle.config.version, this.manifest.kuzzleVersion)) {
        throw kerror.get(
          'plugin',
          'manifest',
          'version_mismatch',
          this.name,
          global.kuzzle.config.version,
          this.manifest.kuzzleVersion);
      }
    }

    this._context = this.config.privileged
      ? new PrivilegedPluginContext(this.name)
      : new PluginContext(this.name);
  }

  info () {
    /* eslint-disable sort-keys */
    if (this.application) {
      return {
        name: this.name,
        version: this.version,
        commit: this.commit,
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

  printDeprecation (message) {
    if (this.deprecationWarning) {
      global.kuzzle.log.warn(`${this.logPrefix} ${message}`);
    }
  }

  // getters/setters ===========================================================

  get instance () {
    return this._instance;
  }

  get context () {
    return this._context;
  }

  get application () {
    return this._application;
  }

  get logPrefix () {
    return `[${this.name}]`;
  }

  get config () {
    return this._config;
  }
  set config (config) {
    this._config = config;
  }

  get version () {
    return this._version;
  }
  set version (version) {
    this._version = version;
  }

  get deprecationWarning () {
    return this._deprecationWarning;
  }
  set deprecationWarning (value) {
    this._deprecationWarning = value;
  }

  get name () {
    return this._name;
  }
  set name (name) {
    if (! this.constructor.checkName(name)) {
      this.printDeprecation('Plugin names should be in kebab-case. This behavior will be enforced in futur versions of Kuzzle.');
    }

    this._name = name;
  }

  get manifest () {
    return this._manifest;
  }
  set manifest (manifest) {
    this._manifest = manifest;
  }

  // static methods ============================================================

  static loadFromDirectory (pluginPath) {
    if (! fs.statSync(pluginPath).isDirectory()) {
      throw assertionError.get('cannot_load', pluginPath, 'Not a directory.');
    }

    let plugin;
    let PluginClass = {};
    try {
      PluginClass = require(pluginPath);

      const pluginInstance = new PluginClass();

      plugin = new Plugin(pluginInstance);
    }
    catch (error) {
      if (error.message.match(/not a constructor/i)) {
        throw assertionError.get('not_a_constructor', PluginClass.name);
      }

      throw runtimeError.getFrom(error, 'unexpected_error', error.message);
    }

    // load manifest
    plugin.manifest = new Manifest(pluginPath);
    plugin.manifest.load();

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
        const config = global.kuzzle.config[plugin.manifest.name];
        const pluginCode = config && config._pluginCode
          ? config._pluginCode
          : 0x00;

        errorCodes.loadPluginsErrors(plugin.manifest.raw, pluginCode);

        global.kuzzle.log.info(`${plugin.logPrefix} Custom errors successfully loaded.`);
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

  static checkControllerDefinition (name, definition, { application = false } = {}) {
    if (typeof name !== 'string') {
      throw assertionError.get(
        'invalid_controller_definition',
        'Controller name must be a string');
    }

    if (! isPlainObject(definition)) {
      throw assertionError.get(
        'invalid_controller_definition',
        name,
        'Controller definition must be an object');
    }

    if (! isPlainObject(definition.actions)) {
      throw assertionError.get(
        'invalid_controller_definition',
        name,
        'Controller definition "actions" property must be an object');
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
              `action "${action}" http "verb" property must be a non-empty string`);
          }

          if (! HTTP_VERBS.includes(route.verb.toLowerCase())) {
            throw assertionError.get(
              'invalid_controller_definition',
              name,
              `action "${action}" http verb "${route.verb}" is not a valid http verb`);
          }

          checkHttpRouteProperties(route, action, name, application);

          const routeProperties = Object.keys(route);
          if (routeProperties.length > 3) {
            routeProperties.splice(routeProperties.indexOf('url'), 1);
            routeProperties.splice(routeProperties.indexOf('path'), 1);
            routeProperties.splice(routeProperties.indexOf('verb'), 1);
            routeProperties.splice(routeProperties.indexOf('openapi'), 1);

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

function checkHttpRouteProperties (route, action, name, application) {
  if (typeof route.path !== 'string' || route.path.length === 0) {
    if (! application && (typeof route.url === 'string' && route.url.length > 0)) {
      return;
    }

    throw assertionError.get(
      'invalid_controller_definition',
      name,
      `action "${action}" http "path" property must be a non-empty string`);
  }
}

module.exports = Plugin;
