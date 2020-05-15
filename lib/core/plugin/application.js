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

const Kuzzle = require('../../kuzzle');
const Plugin = require('./plugin');
const kerror = require('../../kerror');

const assertionError = kerror.wrap('application', 'assert');

class Application {
  constructor (name) {
    this._name = name;

    this._mappings = {};
    this._securities = {};
    this._fixtures = {};

    this._pipes = {};
    this._hooks = {};
    this._controllers = {};
    this._routes = [];
    this._strategies = {};
    this._authenticators = {};

    this._config = {};
    this._context = null;
  }

  start () {
    const primaryPlugin = new Plugin(
      this.instanceProxy,
      { name: this.name, primary: true });

    const kuzzle = new Kuzzle();

    const options = {
      mappings: this._mappings,
      securities: this._securities,
      fixtures: this._fixtures,
      primaryPlugin
    };

    return kuzzle.start(options);
  }

  get name () { return this._name; }

  set mappings (mappings) { this._mappings = mappings; }
  get mappings () { return this._mappings; }

  set securities (securities) { this._securities = securities; }
  get securities () { return this._securities; }

  set fixtures (fixtures) { this._fixtures = fixtures; }
  get fixtures () { return this._fixtures; }

  set pipes (pipes) { this._pipes = pipes; }
  get pipes () { return this._pipes; }

  set hooks (hooks) { this._hooks = hooks; }
  get hooks () { return this._hooks; }

  set controllers (controllers) { this._controllers = controllers; }
  get controllers () { return this._controllers; }

  set routes (routes) { this._routes = routes; }
  get routes () { return this._routes; }

  // @todo allow strategies and authenticators declaration
  get strategies () { return this._strategies; }

  get authenticators () { return this._authenticators; }

  get context () { return this._context; }

  get config () { return this._config; }

  get instanceProxy () {
    return {
      pipes: this._pipes,
      hooks: this._hooks,
      controllers: this._controllers,
      routes: this._routes,
      strategies: this._strategies,
      authenticators: this._authenticators,
      init: (config, context) => {
        this._config = config;
        this._context = context;
      }
    }
  }

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

module.exports = Application;


const app = new Application("omn")

