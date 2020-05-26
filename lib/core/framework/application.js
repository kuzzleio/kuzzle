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

const fs = require('fs');
const _ = require('lodash');

const Kuzzle = require('../../kuzzle');
const Plugin = require('../plugin/plugin');
const kerror = require('../../kerror');

const assertionError = kerror.wrap('application', 'assert');

class Application {
  constructor (name) {
    this._name = name;

    this._mappings = {};
    this._securities = {};
    this._fixtures = {};
    this._vaultKey = null;
    this._secretsFile = null;

    this._pipes = {};
    this._hooks = {};
    this._controllers = {};
    this._routes = [];
    this._plugins = [];

    this._context = null;

    Reflect.defineProperty(this, 'kuzzle', {
      value: new Kuzzle()
    });
  }

  start () {
    const application = new Plugin(
      this.instanceProxy,
      { name: this.name, application: true });

    application.version = this.version;

    const options = {
      mappings: this.mappings,
      securities: this.securities,
      fixtures: this.fixtures,
      secretsFile: this.secretsFile,
      vaultKey: this.vaultKey,
      plugins: this.plugins
    };

    return this.kuzzle.start(application, options);
  }

  get name () { return this._name; }

  get config () { return this.kuzzle.config; }

  set mappings (v) { this._mappings = loadJson(v); }
  get mappings () { return this._mappings; }

  set securities (v) { this._securities = loadJson(v); }
  get securities () { return this._securities; }

  set fixtures (v) { this._fixtures = loadJson(v); }
  get fixtures () { return this._fixtures; }

  set pipes (v) { this._pipes = v; }
  get pipes () { return this._pipes; }

  set hooks (v) { this._hooks = v; }
  get hooks () { return this._hooks; }

  set controllers (v) { this._controllers = v; }
  get controllers () { return this._controllers; }

  set routes (v) { this._routes = v; }
  get routes () { return this._routes; }

  set plugins (v) { this._plugins = v; }
  get plugins () { return this._plugins; }

  set vaultKey (v) { this._vaultKey = v; }
  get vaultKey () { return this._vaultKey; }

  set secretsFile (v) { this._secretsFile = v; }
  get secretsFile () { return this._secretsFile; }

  set version (v) { this._version = v; }
  get version () { return this._version; }

  // @todo allow strategies and authenticators declaration
  get strategies () { return this._strategies; }

  get authenticators () { return this._authenticators; }

  get context () { return this._context; }

  get instanceProxy () {
    return {
      pipes: this._pipes,
      hooks: this._hooks,
      controllers: this._controllers,
      routes: this._routes,
      strategies: this._strategies,
      authenticators: this._authenticators,
      init: (_, context) => {
        this._context = context;
      }
    }
  }

  /**
   * Checks definitions of pipes, hooks and controllers
   */
  _checkDefinitions () {
    for (const [event, handler] of Object.entries(this.pipes)) {
      if (typeof handler !== 'function') {
        throw assertionError.get('invalid_pipe', event);
      }
    }

    for (const [event, handler] of Object.entries(this.hooks)) {
      if (typeof handler !== 'function') {
        throw assertionError.get('invalid_hook', event);
      }
    }

    for (const [controller, definition] of Object.entries(this.controllers)) {
      for (const [action, handler] of Object.entries(definition)) {
        if (typeof handler !== 'function') {
          throw assertionError.get('invalid_controller', controller, action);
        }
      }
    }
  }
}

/**
 * Loads JSON from file.
 * No-op if the parameter is already a POJO
 */
function loadJson (filePath) {
  if (_.isEmpty(filePath)) {
    return {};
  }

  if (_.isPlainObject(filePath)) {
    return filePath;
  }

  const rawData = fs.readFileSync(filePath, 'utf8');

  return JSON.parse(rawData);
}


module.exports = Application;