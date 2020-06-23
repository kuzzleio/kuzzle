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

import * as fs from 'fs';
import * as _ from 'lodash';

import * as Kuzzle from '../../kuzzle';
import * as Plugin from '../plugin/plugin';
import * as kerror from '../../kerror';
import { kebabCase } from '../../util/inflector';

import {
  JSONObject,
  ControllerDefinition,
  BasePlugin
} from '../../util/interfaces';

const assertionError = kerror.wrap('plugin', 'assert');
const runtimeError = kerror.wrap('plugin', 'runtime');

/* PipeManager class ======================================================== */

class PipeManager {
  private _application: any;

  constructor (application: any) {
    Reflect.defineProperty(this, '_application', {
      value: application
    });
  }

  /**
   * Registers a new pipe on an event
   *
   * @param event - Event name
   * @param handler - Function to execute when the event is triggered
   *
   */
  register (event: string, handler: (...args: any) => Promise<any>) : void {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'pipe');
    }

    if (typeof handler !== 'function') {
      throw assertionError.get('invalid_pipe', event);
    }

    if (! this._application._pipes[event]) {
      this._application._pipes[event] = [];
    }

    this._application._pipes[event].push(handler);
  }
}

/* HookManager class ======================================================== */

class HookManager {
  private _application: any;

  constructor (application: any) {
    Reflect.defineProperty(this, '_application', {
      value: application
    });
  }

  /**
   * Registers a new hook on an event
   *
   * @param event - Event name
   * @param handler - Function to execute when the event is triggered
   *
   */
  register (event: string, handler: (...args: any) => Promise<any> | void) : void {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'hook');
    }

    if (typeof handler !== 'function') {
      throw assertionError.get('invalid_hook', event);
    }

    if (! this._application._hooks[event]) {
      this._application._hooks[event] = [];
    }

    this._application._hooks[event].push(handler);
  }
}

/* ConfigManager class ====================================================== */

class ConfigManager {
  private _application: any;

  /**
   * Configuration content
   */
  public content: JSONObject;

  constructor (application: any) {
    Reflect.defineProperty(this, '_application', {
      value: application
    });

    this.content = this._application.kuzzle.config;
  }

  /**
   * Sets a configuration value
   *
   * @param path - Path to the configuration key (lodash style)
   * @param value - Value for the configuraiton key
   */
  set (path: string, value: any) {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'config');
    }

    _.set(this._application.kuzzle.config, path, value);
  }

  /**
   * Merges a configuration object into the current configuration
   *
   * @param config - Configuration object to merge
   */
  merge (config: JSONObject) {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'config');
    }

    this._application.kuzzle.config = _.merge(
      this._application.kuzzle.config,
      config);
  }
}

/* ControllerManager class ================================================== */

class ControllerManager {
  private _application: any;

  constructor (application: any) {
    Reflect.defineProperty(this, '_application', {
      value: application
    });
  }

  /**
   * Registers a new controller.
   *
   * @example
   * register('greeting', {
   *   actions: {
   *     sayHello: {
   *       handler: async request => `Hello, ${request.input.args.name}`,
   *       http: [{ verb: 'POST', url: '/greeting/hello/:name' }]
   *     }
   *   }
   * })
   *
   * Http routes will be auto-generated unless they are provided or an empty array
   * is provided
   *
   * @param name - Controller name
   * @param definition - Controller definition
   */
  register (name: string, definition: ControllerDefinition) {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'controller');
    }

    // Check definition here to throw error early
    // with the corresponding line number
    Plugin.checkControllerDefinition(name, definition);

    if (this._application._controllers[name]) {
      throw assertionError.get(
        'invalid_controller_definition',
        name,
        'A controller with this name already exists');
    }

    this._generateMissingRoutes(name, definition);

    this._application._controllers[name] = definition;
  }

  _generateMissingRoutes (name: string, controllerDefinition: ControllerDefinition) {
    for (const [action, definition] of Object.entries(controllerDefinition.actions)) {
      if (! definition.http) {
        definition.http = [{ verb: 'POST', url: `/${name}/${action}` }];
      }
    }
  }
}

/* VaultManager class ======================================================= */

class VaultManager {
  private _application: any;

  constructor (application: any) {
    Reflect.defineProperty(this, '_application', {
      value: application
    });
  }

  /**
   * Secret key to decrypt encrypted secrets.
   */
  set key (key: string) {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'vault');
    }

    this._application._vaultKey = key;
  }

  /**
   * File containing encrypted secrets
   */
  set file (file: string) {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'vault');
    }

    this._application._secretsFile = file;
  }

  /**
   * Decrypted secrets
   */
  get secrets () : JSONObject {
    if (! this._application.started) {
      throw runtimeError.get('only_after_startup', 'vault.secrets');
    }

    return this._application.kuzzle.vault.secrets;
  }
}

/* PluginManager class ============================================================== */

interface UsePluginOptions {
  /**
   * Specify plugin name instead of using the class name.
   */
  name?: string
}

class PluginManager {
  private _application: any;

  constructor (application: any) {
    Reflect.defineProperty(this, '_application', {
      value: application
    });
  }

  /**
   * Uses a plugin in this application
   *
   * @param plugin - Plugin instance
   * @param options - Additionnal options
   */
  use (plugin: BasePlugin, options: UsePluginOptions = {}) : void {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'plugin');
    }

    if (typeof plugin.constructor !== 'function' && ! options.name) {
      throw assertionError.get('no_name_provided');
    }

    const name: string = options.name || kebabCase(plugin.constructor.name);
    if (! Plugin.checkName(name)) {
      throw assertionError.get('invalid_application_name', name)
    }

    if (this._application._plugins[name]) {
      throw assertionError.get('name_already_exists', name);
    }

    if (typeof plugin.init !== 'function') {
      throw assertionError.get('init_not_found', name);
    }

    this._application._plugins[name] = plugin;
  }
}

/* Backend class ======================================================== */


export class Backend {
  private kuzzle: any;
  private _context: any = null;
  private _name: string;

  protected started = false;

  protected _pipes = {};
  protected _hooks = {};
  protected _controllers = {};
  protected _plugins = {};
  protected _vaultKey?: string;
  protected _secretsFile?: string;

  /**
   * Application version
   */
  public version: string;

  /**
   * PipeManager definition manager
   *
   * @method register - Registers a new pipe on an event
   */
  public pipe: PipeManager;

  /**
   * HookManager definition manager
   *
   * @method register - Registers a new hook on an event
   */
  public hook: HookManager;

  /**
   * VaultManager
   *
   * By default Kuzzle will try to load the following locations:
   *  - local path: ./config/secrets.enc.json
   *  - environment variable: KUZZLE_SECRETS_FILE
   *
   * By default Kuzzle will try to load the decryption key from the following
   * environment variable:
   *  - KUZZLE_VAULT_KEY
   */
  public vault: VaultManager;

  /**
   * Configuration definition manager
   *
   * @method set - Sets a configuration value
   * @method merge - Merges a configuration object into the current configuration
   */
  public config: ConfigManager;

  /**
   * Controller manager
   *
   * @method add - Adds a new controller definition
   * @method use - Uses a controller instance
   */
  public controller: ControllerManager;

  /**
   * Plugin manager
   *
   * @method use - Uses a plugin instance
   */
  public plugin: PluginManager;

  /**
   * @deprecated
   */
  public mappings: JSONObject;

  /**
   * @deprecated
   */
  public securities: JSONObject;

  /**
   * @deprecated
   */
  public fixtures: JSONObject;

  /**
   * Instantiates a new Kuzzle application
   *
   * @param name - Your application name
   */
  constructor (name: string) {
    this._name = name;

    Reflect.defineProperty(this, 'kuzzle', {
      value: new Kuzzle()
    });

    this.pipe = new PipeManager(this);
    this.hook = new HookManager(this);
    this.config = new ConfigManager(this);
    this.vault = new VaultManager(this);
    this.controller = new ControllerManager(this);
    this.plugin = new PluginManager(this);

    try {
      const info = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
      this.version = info.version;
    }
    catch (error) {
      // Silent if no version can be found
    }
  }

  /**
   * Starts the Kuzzle application with the defined features
   */
  async start () : Promise<void> {
    if (this.started) {
      throw runtimeError.get('already_started', 'start');
    }

    const application = new Plugin(
      this.kuzzle,
      this.instanceProxy,
      { name: this.name, application: true });

    application.version = this.version;

    const options = {
      secretsFile: this._secretsFile,
      vaultKey: this._vaultKey,
      plugins: this._plugins,
      mappings: this.mappings,
      fixtures: this.fixtures,
      securities: this.securities,
    };

    await this.kuzzle.start(application, options);

    this.started = true;
  }

  /**
   * Application Name
   */
  get name () { return this._name; }

  /**
   * Internal SDK
   */
  get sdk () { return this.context.accessors.sdk; }

  /**
   * Application context object
   */
  get context () {
    if (! this.started) {
      throw runtimeError.get('unavailable_before_start', 'context');
    }

    return this._context;
  }

  get instanceProxy () {
    return {
      pipes: this._pipes,
      hooks: this._hooks,
      api: this._controllers,
      init: (_, context) => {
        this._context = context;
      }
    };
  }

}

module.exports = { Backend };