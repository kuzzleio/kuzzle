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

import fs from "fs";

import Kuzzle from "../../kuzzle";
import { EmbeddedSDK } from "../shared/sdk/embeddedSdk";
import * as kerror from "../../kerror";
import { EventDefinition, JSONObject, NameGenerator } from "../../../index";
import {
  BackendCluster,
  BackendConfig,
  BackendController,
  BackendHook,
  BackendImport,
  BackendPipe,
  BackendPlugin,
  BackendStorage,
  BackendVault,
  BackendOpenApi,
  BackendErrors,
  BackendSubscription,
} from "./index";
import { Logger } from "../../kuzzle/Logger";

const assertionError = kerror.wrap("plugin", "assert");
const runtimeError = kerror.wrap("plugin", "runtime");

let _app = null;

Reflect.defineProperty(global, "app", {
  configurable: true,
  enumerable: false,
  get() {
    if (_app === null) {
      throw new Error(
        "App instance not found. Are you sure you have already started your application?",
      );
    }

    return _app;
  },
  set(value) {
    if (_app !== null) {
      throw new Error(
        "Cannot build an App instance: another one already exists",
      );
    }

    _app = value;
  },
});

export class Backend {
  private _kuzzle: any;
  private _name: string;
  private _sdk: EmbeddedSDK;
  private _started: boolean;

  protected _pipes = {};
  protected _hooks = {};
  protected _controllers = {};
  protected _plugins = {};
  protected _import = {
    mappings: {},
    onExistingUsers: "skip",
    profiles: {},
    roles: {},
    userMappings: {},
    users: {},
  };
  protected _vaultKey?: string;
  protected _secretsFile?: string;
  protected _installationsWaitingList: Array<{
    id: string;
    description?: string;
    handler: () => void;
  }> = [];

  /**
   * Requiring the PluginObject on module top level creates cyclic dependency
   */
  protected PluginObject: any;

  /**
   * Application version
   */
  public version: string;

  /**
   * Current Git commit (if available)
   */
  public commit: string | null = null;

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
  public log: Logger;

  /**
   * Storage manager
   */
  public storage: BackendStorage;

  /**
   * Cluster manager
   */
  public cluster: BackendCluster;

  /**
   * Import manager
   *
   * @method mappings - Import mappings
   * @method profiles - Import profiles
   * @method roles - Import roles
   * @method users - Import users
   * @method userMappings - Import user mappings
   */
  public import: BackendImport;

  /**
   * OpenApi manager
   */
  public openApi: BackendOpenApi;

  /**
   * Standard errors
   */
  public errors: BackendErrors;

  public subscription: BackendSubscription;

  /**
   * @deprecated
   *
   * Use the app.import.xxx() feature instead.
   *
   * Support for old features available before Kuzzle as a framework
   * to avoid breaking existing deployments.
   *
   */
  public _support: JSONObject = {};

  private readonly nodeId: string;

  /**
   * Instantiates a new Kuzzle application
   *
   * @param name - Your application name
   */
  constructor(name: string) {
    /**
     * Requiring the PluginObject on module top level creates cyclic dependency
     */
    Reflect.defineProperty(this, "PluginObject", {
      value: require("../plugin/plugin"),
    });

    if (!this.PluginObject.checkName(name)) {
      throw assertionError.get("invalid_application_name", name);
    }

    this._name = name;

    this.nodeId = NameGenerator.generateRandomName({ prefix: "knode" });

    Reflect.defineProperty(this, "_kuzzle", {
      writable: true,
    });

    Reflect.defineProperty(this, "_sdk", {
      writable: true,
    });

    Reflect.defineProperty(global, "nodeId", {
      get: () => {
        return this.nodeId;
      },
      set: () => {
        throw new Error("nodeId is read-only");
      },
    });

    /**
     * Set the "started" property in this event so developers can use runtime
     * features in pipes/hooks attached to this event.
     */
    this._pipes["kuzzle:state:ready"] = [
      async () => {
        this.started = true;
      },
    ];

    try {
      const info = JSON.parse(fs.readFileSync("./package.json", "utf8"));
      this.version = info.version;
    } catch (error) {
      // Silent if no version can be found
    }

    global.app = this;

    this.pipe = new BackendPipe(this);
    this.hook = new BackendHook(this);
    this.config = new BackendConfig(this);
    this.vault = new BackendVault(this);
    this.controller = new BackendController(this);
    this.plugin = new BackendPlugin(this);
    this.storage = new BackendStorage(this);
    this.import = new BackendImport(this);
    this.cluster = new BackendCluster();
    this.openApi = new BackendOpenApi(this);
    this.errors = new BackendErrors(this);
    this.subscription = new BackendSubscription(this);
    this.log = new Logger(this.config.content, "kuzzle:app");

    this.kerror = kerror;

    try {
      this.commit = this._readCommit();
    } catch {
      // catch errors and leave commit value to "null"
    }
  }

  /**
   * Starts the Kuzzle application with the defined features
   */
  async start(): Promise<void> {
    if (this.started) {
      throw runtimeError.get("already_started", "start");
    }

    this._kuzzle = new Kuzzle(this.config.content);
    for (const plugin of this.config.content.plugins.common.include) {
      const { default: PluginClass } = await import(plugin);

      this.plugin.use(new PluginClass(), {
        deprecationWarning: false,
        name: plugin,
      });
    }

    const application = new this.PluginObject(this._instanceProxy, {
      application: true,
      name: this.name,
    });

    application.version = this.version;
    application.commit = this.commit;
    application.openApi = this.openApi.definition;

    const options = {
      import: this._import,
      installations: this._installationsWaitingList,
      plugins: this._plugins,
      secretsFile: this._secretsFile,
      support: this._support, // NOSONAR
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
  trigger<TEventDefinition extends EventDefinition = EventDefinition>(
    event: TEventDefinition["name"],
    ...payload: TEventDefinition["args"]
  ): Promise<TEventDefinition["args"][0]> {
    if (!this.started) {
      throw runtimeError.get("unavailable_before_start", "trigger");
    }

    return this._kuzzle.pipe(event, ...payload);
  }

  /**
   * Register a method that will be executed only once on any given environment.
   * If this method throws, the app won't start.
   *
   * @param {string} id - Unique id needed to differenciate each installation
   * @param {Function} handler - Method to execute only once
   * @param {string | undefined} description - Optional: Describe the purpose of this installation
   *
   */
  install(
    id: string,
    handler: () => Promise<void>,
    description?: string,
  ): void {
    if (this.started) {
      throw runtimeError.get("already_started", "install");
    }
    if (typeof id !== "string") {
      throw kerror.get("validation", "assert", "invalid_type", "id", "string");
    }
    if (typeof handler !== "function") {
      throw kerror.get(
        "validation",
        "assert",
        "invalid_type",
        "handler",
        "function",
      );
    }
    if (description && typeof description !== "string") {
      throw kerror.get("validation", "assert", "invalid_type", "id", "string");
    }

    this._installationsWaitingList.push({ description, handler, id });
  }

  /**
   * Application Name
   */
  get name(): string {
    return this._name;
  }

  /**
   * EmbeddedSDK instance
   */
  get sdk(): EmbeddedSDK {
    if (!this.started) {
      throw runtimeError.get("unavailable_before_start", "sdk");
    }

    return this._sdk;
  }

  private get _instanceProxy() {
    return {
      api: this._controllers,
      hooks: this._hooks,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      init: () => {},
      pipes: this._pipes,
    };
  }

  get started() {
    return this._started;
  }

  protected set started(started: boolean) {
    this._started = started;
  }

  /**
   * Try to read the current commit hash.
   */
  private _readCommit(dir = process.cwd(), depth = 3) {
    if (depth === 0) {
      return null;
    }

    const gitDir = `${dir}/.git`;

    if (!fs.existsSync(gitDir) && depth > 0) {
      return this._readCommit(`${dir}/..`, depth - 1);
    }

    if (!fs.statSync(gitDir).isDirectory()) {
      return null;
    }

    const ref = fs.readFileSync(`${dir}/.git/HEAD`, "utf8").split("ref: ")[1];
    const refFile = `${dir}/.git/${ref}`.replace("\n", "");

    if (!fs.existsSync(refFile)) {
      return null;
    }

    return fs.readFileSync(refFile, "utf8").replace("\n", "");
  }
}
