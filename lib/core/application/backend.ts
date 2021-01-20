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

import util from 'util';

import fs from 'fs';
import _ from 'lodash';
import { Client } from '@elastic/elasticsearch';

import Kuzzle from '../../kuzzle';
import PluginObject from '../plugin/plugin';
import { EmbeddedSDK } from '../shared/sdk/embeddedSdk';
import Elasticsearch from '../../service/storage/elasticsearch';
import { kebabCase } from '../../util/inflector';
import kerror from '../../kerror';
import kuzzleConfig from '../../config';
import { JSONObject } from '../../../index';
import {
  ControllerDefinition,
  Plugin,
  Controller,
  EventHandler,
} from '../../types';
import { BackendCluster } from './backendCluster';

const assertionError = kerror.wrap('plugin', 'assert');
const runtimeError = kerror.wrap('plugin', 'runtime');

class ApplicationManager {
  protected _application: any;

  constructor (application: Backend) {
    Reflect.defineProperty(this, '_application', {
      value: application
    });
  }

  protected get _kuzzle () {
    return this._application._kuzzle;
  }
}

/* BackendPipe class ======================================================== */

class BackendPipe extends ApplicationManager {
  /**
   * Registers a new pipe on an event
   *
   * @param event - Event name
   * @param handler - Function to execute when the event is triggered
   *
   */
  register (event: string, handler: EventHandler): void {
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

/* BackendHook class ======================================================== */

class BackendHook extends ApplicationManager {
  /**
   * Registers a new hook on an event
   *
   * @param event - Event name
   * @param handler - Function to execute when the event is triggered
   *
   */
  register (event: string, handler: EventHandler) : void {
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

/* BackendConfig class ====================================================== */

class BackendConfig extends ApplicationManager {
  /**
   * Configuration content
   */
  public content: JSONObject;

  constructor (application: Backend) {
    super(application);

    this.content = kuzzleConfig.load();
  }

  /**
   * Sets a configuration value
   *
   * @param path - Path to the configuration key (lodash style)
   * @param value - Value for the configuration key
   */
  set (path: string, value: any) {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'config');
    }

    _.set(this.content, path, value);
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

    this.content = _.merge(this.content, config);
  }
}

/* BackendController class ================================================== */

class BackendController extends ApplicationManager {
  /**
   * Registers a new controller.
   *
   * Http routes will be auto-generated unless they are provided or an empty array
   * is provided.
   *
   * @param name - Controller name
   * @param definition - Controller definition
   *
   * @example
   * app.controller.register('greeting', {
   *   actions: {
   *     sayHello: {
   *       handler: async request => `Hello, ${request.input.args.name}`,
   *       http: [{ verb: 'post', path: 'greeting/hello/:name' }]
   *     }
   *   }
   * })
   *
   */
  register (name: string, definition: ControllerDefinition) {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'controller');
    }

    this._add(name, definition);
  }

  /**
   * Uses a new controller class.
   *
   * The controller class must:
   *  - call the super constructor with the application instance
   *  - extend the "Controller" class
   *  - define the "definition" property
   *  - (optional) define the "name" property
   *
   * The controller name will be inferred from the class name.
   *   e.g. "PaymentSolutionController" will become "payment-solution"
   *
   * @example
   *
   * class EmailController extends Controller {
   *   constructor (app) {
   *     super(app);
   *
   *     this.definition = {
   *       actions: {
   *         send: {
   *           handler: this.send
   *         }
   *       }
   *     };
   *   }
   *
   *   async send (request: Request) {
   *     // ...
   *   }
   * }
   *
   * app.controller.use(new EmailController(app));
   *
   * @param controller Controller class
   */
  use (controller: Controller) {
    if (this._application.started) {
      throw runtimeError.get('already_started', 'controller');
    }

    if (! controller.name) {
      controller.name = kebabCase(controller.constructor.name)
        .replace('-controller', '');
    }

    for (const [action, definition] of Object.entries(controller.definition.actions)) {
      if (typeof definition.handler !== 'function') {
        throw assertionError.get(
          'invalid_controller_definition',
          controller.name,
          `Handler for action "${action}" is not a function.`);
      }

      // if the function handler is an instance method,
      // bind the context to the controller instance
      const handlerName = definition.handler.name;
      if (handlerName && typeof controller[handlerName] === 'function') {
        definition.handler = definition.handler.bind(controller);
      }
    }

    this._add(controller.name, controller.definition);
  }

  private _add (name: string, definition: ControllerDefinition) {
    // Check definition here to throw error early
    // with the corresponding line number
    PluginObject.checkControllerDefinition(name, definition, { application: true });

    if (this._application._controllers[name]) {
      throw assertionError.get(
        'invalid_controller_definition',
        name,
        'A controller with this name already exists');
    }

    this._application._controllers[name] = definition;
  }
}

/* BackendVault class ======================================================= */

class BackendVault extends ApplicationManager {
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
      throw runtimeError.get('unavailable_before_start', 'vault.secrets');
    }

    return this._kuzzle.vault.secrets;
  }
}

/* BackendPlugin class ====================================================== */

class BackendPlugin extends ApplicationManager {
  /**
   * Uses a plugin in this application
   *
   * @param plugin - Plugin instance
   * @param options - Additionnal options
   *    - `name`: Specify plugin name instead of using the class name.
   *    - `manifest`: Manually add a manifest definition
   *    - `deprecationWarning`: If false, does not display deprecation warnings
   */
  use (
    plugin: Plugin,
    options: { name?: string, manifest?: JSONObject, deprecationWarning?: boolean } = {}
  ) : void {
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

    const name: string = options.name || kebabCase(plugin.constructor.name);
    if (! PluginObject.checkName(name)) {
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
}

/* InternalLogger class ====================================================== */

class InternalLogger extends ApplicationManager implements InternalLogger {
  debug (message: any): void {
    this._log('debug', message);
  }

  /**
   * Logs an info message
   */
  info (message: any): void {
    this._log('info', message);
  }

  /**
   * Logs a warn message
   */
  warn (message: any): void {
    this._log('warn', message);
  }

  /**
   * Logs an error message
   */
  error (message: any): void {
    this._log('error', message);
  }

  /**
   * Logs a verbose message
   */
  verbose (message: any): void {
    this._log('verbose', message);
  }

  private _log (level: string, message: any) {
    if (! this._application.started) {
      // eslint-disable-next-line no-console
      console.log(util.inspect(message));
    }
    else {
      this._kuzzle.log[level](util.inspect(message));
    }
  }
}

/* BackendStorage class ===================================================== */

class BackendStorage extends ApplicationManager {
  private _client: Client = null;
  private _Client: new (clientConfig?: any) => Client = null;

  constructor (application: Backend) {
    super(application);
  }

  /**
   * Storage client constructor.
   * (Currently Elasticsearch)
   *
   * @param clientConfig Overload configuration for the underlaying storage client
   */
  get StorageClient (): new (clientConfig?: any) => Client {
    if (! this._Client) {
      const kuzzle = this._kuzzle;

      this._Client = function ESClient (clientConfig: JSONObject = {}) {
        return Elasticsearch.buildClient({
          ...kuzzle.config.services.storageEngine.client,
          ...clientConfig,
        });
      } as any;
    }

    return this._Client;
  }

  /**
   * Access to the underlaying storage engine client.
   * (Currently Elasticsearch)
   */
  get storageClient (): Client {
    if (! this._client) {
      this._client = Elasticsearch
        .buildClient(this._kuzzle.config.services.storageEngine.client);
    }

    return this._client;
  }}

/* Backend class ======================================================== */

export class Backend {
  private _kuzzle: any;
  private _name: string;
  private _sdk: EmbeddedSDK;

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
   * Current Git commit (if available)
   */
  public commit: string | null;

  /**
   * Errors manager
   */
  public kerror: any;

  /**
   * Pipe definition manager
   *
   * @method register - Registers a new pipe on an event
   */
  public pipe: BackendPipe;

  /**
   * Hook definition manager
   *
   * @method register - Registers a new hook on an event
   */
  public hook: BackendHook;

  /**
   * BackendVault
   *
   * By default Kuzzle will try to load the following locations:
   *  - local path: ./config/secrets.enc.json
   *  - environment variable: KUZZLE_SECRETS_FILE
   *
   * By default Kuzzle will try to load the decryption key from the following
   * environment variable:
   *  - KUZZLE_VAULT_KEY
   */
  public vault: BackendVault;

  /**
   * Configuration definition manager
   *
   * @method set - Sets a configuration value
   * @method merge - Merges a configuration object into the current configuration
   */
  public config: BackendConfig;

  /**
   * Controller manager
   *
   * @method add - Adds a new controller definition
   * @method use - Uses a controller instance
   */
  public controller: BackendController;

  /**
   * Plugin manager
   *
   * @method use - Uses a plugin instance
   */
  public plugin: BackendPlugin;

  /**
   * InternalLogger
   *
   * @method debug
   * @method info
   * @method warn
   * @method error
   * @method verbose
   */
  public log: InternalLogger;

  /**
   * Storage manager
   */
  public storage: BackendStorage;

  /**
   * Cluster manager
   */
  public cluster: BackendCluster;

  /**
   * @deprecated
   *
   * Support for old features available before Kuzzle as a framework
   * to avoid breaking existing deployments.
   *
   * Do not use this property unless you know exactly what you are doing,
   * this property can be removed in future releases.
   */
  public _support: JSONObject = {};

  /**
   * Instantiates a new Kuzzle application
   *
   * @param name - Your application name
   */
  constructor (name: string) {
    if (! PluginObject.checkName(name)) {
      throw assertionError.get('invalid_application_name', name);
    }

    this._name = name;

    Reflect.defineProperty(this, '_kuzzle', {
      writable: true
    });

    Reflect.defineProperty(this, '_sdk', {
      writable: true
    });

    if (global.app) {
      throw assertionError.get('global_app_instance_already_exists');
    }
    Reflect.defineProperty(global, 'app', {
      value: this,
    });

    this.pipe = new BackendPipe(this);
    this.hook = new BackendHook(this);
    this.config = new BackendConfig(this);
    this.vault = new BackendVault(this);
    this.controller = new BackendController(this);
    this.plugin = new BackendPlugin(this);
    this.storage = new BackendStorage(this);
    this.log = new InternalLogger(this);
    this.cluster = new BackendCluster();

    this.kerror = kerror;

    try {
      const info = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
      this.version = info.version;
    }
    catch (error) {
      // Silent if no version can be found
    }

    this.commit = this._readCommit();
  }

  /**
   * Starts the Kuzzle application with the defined features
   */
  async start () : Promise<void> {
    if (this.started) {
      throw runtimeError.get('already_started', 'start');
    }

    this._kuzzle = new Kuzzle(this.config.content);

    // we need to load the default plugins
    for (const plugin of this.config.content.plugins.common.include) {
      const { default: PluginClass } = await import(plugin);
      this.plugin.use(new PluginClass(), {
        deprecationWarning: false,
        name: plugin,
      });
    }

    const application = new PluginObject(
      this._instanceProxy,
      { application: true, name: this.name });

    application.version = this.version;
    application.commit = this.commit;

    const options = {
      fixtures: this._support.fixtures,
      mappings: this._support.mappings,
      plugins: this._plugins,
      secretsFile: this._secretsFile,
      securities: this._support.securities,
      vaultKey: this._vaultKey,
    };

    await this._kuzzle.start(application, options);

    this._sdk = new EmbeddedSDK();

    this.started = true;
  }

  /**
   * Triggers an event
   *
   * @param - Event name
   * @param - Event payload
   *
   * @returns {Promise<any>}
   */
  trigger (event: string, ...payload): Promise<any> {
    if (! this.started) {
      throw runtimeError.get('unavailable_before_start', 'trigger');
    }

    return this._kuzzle.pipe(event, ...payload);
  }

  /**
   * Application Name
   */
  get name (): string { return this._name; }

  /**
   * EmbeddedSDK instance
   */
  get sdk (): EmbeddedSDK {
    if (! this.started) {
      throw runtimeError.get('unavailable_before_start', 'sdk');
    }

    return this._sdk;
  }

  private get _instanceProxy () {
    return {
      api: this._controllers,
      hooks: this._hooks,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      init: () => {},
      pipes: this._pipes,
    };
  }

  /**
   * Try to read the current commit hash.
   */
  private _readCommit (dir = process.cwd(), depth = 3) {
    if (depth === 0) {
      return null;
    }

    if (! fs.existsSync(`${dir}/.git`) && depth > 0) {
      return this._readCommit(`${dir}/..`, depth - 1);
    }

    const ref = fs.readFileSync(`${dir}/.git/HEAD`, 'utf8').split('ref: ')[1];
    const refFile = `${dir}/.git/${ref}`.replace('\n', '');

    if (! fs.existsSync(refFile)) {
      return null;
    }

    return fs.readFileSync(refFile, 'utf8').replace('\n', '');
  }

}
