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

import path from "path";

import Bluebird from "bluebird";
import stringify from "json-stable-stringify";
import { Koncorde } from "koncorde";
import _ from "lodash";
import murmur from "murmurhash";

import { version } from "../../package.json";
import Funnel from "../api/funnel";
import { OpenApiManager } from "../api/openapi";
import Cluster from "../cluster";
import PassportWrapper from "../core/auth/passportWrapper";
import { TokenManager } from "../core/auth/tokenManager";
import CacheEngine from "../core/cache/cacheEngine";
import { KuzzleDebugger } from "../core/debug/kuzzleDebugger";
import EntryPoint from "../core/network/entryPoint";
import Router from "../core/network/router";
import PluginsManager from "../core/plugin/pluginsManager";
import RealtimeModule from "../core/realtime";
import SecurityModule from "../core/security";
import Statistics from "../core/statistics";
import StorageEngine from "../core/storage/storageEngine";
import Validation from "../core/validation";
import * as kerror from "../kerror";
import { KuzzleConfiguration } from "../types/config/KuzzleConfiguration";
import AsyncStore from "../util/asyncStore";
import { sha256 } from "../util/crypto";
import { Mutex } from "../util/mutex";
import { NameGenerator } from "../util/name-generator";
import {
  ImportConfig,
  InstallationConfig,
  StartOptions,
  SupportConfig,
} from "./../types/Kuzzle";
import DumpGenerator from "./dumpGenerator";
import KuzzleEventEmitter from "./event/KuzzleEventEmitter";
import InternalIndexHandler from "./internalIndexHandler";
import kuzzleStateEnum from "./kuzzleStateEnum";
import { Logger } from "./Logger";
import vault from "./vault";

let _kuzzle = null;

Reflect.defineProperty(global, "kuzzle", {
  configurable: true,
  enumerable: false,
  get() {
    if (_kuzzle === null) {
      throw new Error(
        "Kuzzle instance not found. Did you try to use a live-only feature before starting your application?",
      );
    }

    return _kuzzle;
  },
  set(value) {
    if (_kuzzle !== null) {
      throw new Error(
        "Cannot build a Kuzzle instance: another one already exists",
      );
    }

    _kuzzle = value;
  },
});

/**
 * @class Kuzzle
 * @extends EventEmitter
 */

type ImportStatus = {
  locked?: boolean;
  initialized?: boolean;
  firstCall?: boolean;
};

class Kuzzle extends KuzzleEventEmitter {
  public config: KuzzleConfiguration;
  private _state: typeof kuzzleStateEnum = kuzzleStateEnum.STARTING;
  public log: Logger;
  private rootPath: string;
  /**
   * Internal index bootstrapper and accessor
   */
  public internalIndex: InternalIndexHandler;

  public pluginsManager: PluginsManager;
  public tokenManager: TokenManager;
  public passport: PassportWrapper;

  /**
   * The funnel dispatches messages to API controllers
   */
  public funnel: Funnel;

  /**
   * The router listens to client requests and pass them to the funnel
   */
  public router: Router;

  /**
   * Statistics core component
   */
  private statistics: Statistics;

  /**
   * Network entry point
   */
  public entryPoint: EntryPoint;

  /**
   * Validation core component
   */
  public validation: typeof Validation;

  /**
   * Dump generator
   */
  private dumpGenerator: DumpGenerator;

  /**
   * Vault component (will be initialized after bootstrap)
   */
  public vault: typeof vault;

  /**
   * AsyncLocalStorage wrapper
   */
  public asyncStore: AsyncStore;

  /**
   * Kuzzle internal debugger
   */
  private debugger: KuzzleDebugger;

  /**
   * Kuzzle version
   */
  private version: string;

  private openApiManager: OpenApiManager;

  /**
   * List of differents imports types and their associated method
   */
  private importTypes: {
    [key: string]: (
      config: {
        toImport: ImportConfig;
        toSupport: SupportConfig;
      },
      status: ImportStatus,
    ) => Promise<void>;
  };

  public koncorde: Koncorde;
  public secret: string;

  /**
   * Node unique ID amongst other cluster nodes
   */
  public id: string;

  constructor(config: KuzzleConfiguration) {
    super(
      config.plugins.common.maxConcurrentPipes,
      config.plugins.common.pipesBufferSize,
    );

    global.kuzzle = this;

    this._state = kuzzleStateEnum.STARTING;

    this.config = config;

    this.log = new Logger(config);

    this.rootPath = path.resolve(path.join(__dirname, "../.."));

    this.internalIndex = new InternalIndexHandler();
    this.pluginsManager = new PluginsManager();
    this.tokenManager = new TokenManager();
    this.passport = new PassportWrapper();
    this.funnel = new Funnel();
    this.router = new Router();
    this.statistics = new Statistics();
    this.entryPoint = new EntryPoint();
    this.validation = new Validation();
    this.dumpGenerator = new DumpGenerator();
    this.vault = null;
    this.asyncStore = new AsyncStore();
    this.debugger = new KuzzleDebugger();
    this.version = version;

    this.importTypes = {
      fixtures: this.importFixtures.bind(this),
      mappings: this.importMappings.bind(this),
      permissions: this.importPermissions.bind(this),
      userMappings: this.importUserMappings.bind(this),
    };
  }

  /**
   * Initializes all the needed components of Kuzzle.
   *
   * @param {Application} - Application Plugin instance
   * @param {Object} - Additional options (import, installations, plugins, secretsFile, support, vaultKey)
   *
   * @this {Kuzzle}
   */
  async start(application: any, options: StartOptions = { import: {} }) {
    this.registerSignalHandlers();

    try {
      this.log.info(`[ℹ] Starting Kuzzle ${this.version} ...`);
      await this.pipe("kuzzle:state:start");

      // Koncorde realtime engine
      this.koncorde = new Koncorde({
        maxConditions: this.config.limits.subscriptionConditionsCount,
        regExpEngine: this.config.realtime.pcreSupport ? "js" : "re2",
        seed: this.config.internal.hash.seed,
      });

      await new CacheEngine().init();
      await new StorageEngine().init();
      await new RealtimeModule().init();
      await this.internalIndex.init();

      await new SecurityModule().init();

      // This will init the cluster module if enabled
      this.id = await this.initKuzzleNode();

      this.vault = vault.load(options.vaultKey, options.secretsFile);

      await this.validation.init();

      await this.tokenManager.init();

      await this.funnel.init();

      this.statistics.init();

      await this.validation.curateSpecification();

      // must be initialized before plugins to allow API requests from plugins
      // before opening connections to external users
      await this.entryPoint.init();

      await this.debugger.init();

      this.pluginsManager.application = application;
      const pluginImports = await this.pluginsManager.init(options.plugins);
      this.log.info(
        `[✔] Successfully loaded ${
          this.pluginsManager.loadedPlugins.length
        } plugins: ${this.pluginsManager.loadedPlugins.join(", ")}`,
      );

      const imports = _.merge({}, pluginImports, options.import);

      // Authentification plugins must be loaded before users import to avoid
      // credentials related error which would prevent Kuzzle from starting
      await this.loadInitialState(imports, options.support);

      await this.ask("core:security:verify");

      this.router.init();

      this.log.info("[✔] Core components loaded");

      await this.install(options.installations);

      this.log.info(
        `[✔] Start "${this.pluginsManager.application.name}" application`,
      );
      this.openApiManager = new OpenApiManager(
        application.openApi,
        this.config.http.routes,
        this.pluginsManager.routes,
      );

      // @deprecated
      await this.pipe("kuzzle:start");

      await this.pipe("kuzzle:state:live");

      await this.entryPoint.startListening();

      await this.pipe("kuzzle:state:ready");

      this.log.info(
        `[✔] Kuzzle ${this.version} is ready (node name: ${this.id})`,
      );

      // @deprecated
      this.emit("core:kuzzleStart", "Kuzzle is ready to accept requests");

      this._state = kuzzleStateEnum.RUNNING;
    } catch (error) {
      this.log.error(
        `[X] Cannot start Kuzzle ${this.version}: ${error.message}`,
      );

      throw error;
    }
  }

  /**
   * Generates the node ID.
   *
   * This will init the cluster if it's enabled.
   */
  private async initKuzzleNode(): Promise<string> {
    let id;

    if (this.config.cluster.enabled) {
      id = await new Cluster().init();

      this.log.info("[✔] Cluster initialized");
    } else {
      id = NameGenerator.generateRandomName({ prefix: "knode" });
      this.log.info("[X] Cluster disabled: single node mode.");
    }

    return id;
  }

  /**
   * Gracefully exits after processing remaining requests
   *
   * @returns {Promise}
   */
  async shutdown(): Promise<void> {
    this._state = kuzzleStateEnum.SHUTTING_DOWN;

    this.log.info("Initiating shutdown...");

    // Ask the network layer to stop accepting new request
    this.entryPoint.dispatch("shutdown");

    await this.pipe("kuzzle:shutdown");

    // @deprecated
    this.emit("core:shutdown");

    while (this.funnel.remainingRequests !== 0) {
      this.log.info(
        `[shutdown] Waiting: ${this.funnel.remainingRequests} remaining requests`,
      );
      await Bluebird.delay(1000);
    }

    this.log.info("Halted.");

    process.exit(0);
  }

  /**
   * Execute multiple handlers only once on any given environment
   *
   * @param {Array<{ id: string, handler: () => void, description?: string }>} installations - Array of unique methods to execute
   *
   * @returns {Promise<void>}
   */
  async install(installations: InstallationConfig[]): Promise<void> {
    if (!installations?.length) {
      return;
    }

    const mutex = new Mutex("backend:installations");
    await mutex.lock();

    try {
      for (const installation of installations) {
        const isAlreadyInstalled = await this.ask(
          "core:storage:private:document:exist",
          "kuzzle",
          "installations",
          installation.id,
        );

        if (!isAlreadyInstalled) {
          try {
            await installation.handler();
          } catch (error) {
            throw kerror.get(
              "plugin",
              "runtime",
              "unexpected_installation_error",
              installation.id,
              error,
            );
          }

          await this.ask(
            "core:storage:private:document:create",
            "kuzzle",
            "installations",
            {
              description: installation.description,
              handler: installation.handler.toString(),
              installedAt: Date.now(),
            },
            { id: installation.id },
          );

          this.log.info(
            `[✔] Install code "${installation.id}" successfully executed`,
          );
        }
      }
    } finally {
      await mutex.unlock();
    }
  }

  // For testing purpose
  async ask(event: string, ...args: [payload?: any, ...rest: any]) {
    return super.ask(event, ...args);
  }

  // For testing purpose
  emit(event: string, ...args: any[]) {
    return super.emit(event, ...args);
  }

  // For testing purpose
  async pipe(event: string, ...args: any[]) {
    return super.pipe(event, ...args);
  }

  private async importUserMappings(
    config: {
      toImport: ImportConfig;
      toSupport: SupportConfig;
    },
    status: ImportStatus,
  ): Promise<void> {
    if (!status.firstCall) {
      return;
    }

    const toImport = config.toImport;

    if (!_.isEmpty(toImport.userMappings)) {
      await this.internalIndex.updateMapping("users", toImport.userMappings);
      await this.internalIndex.refreshCollection("users");
      this.log.info("[✔] User mappings import successful");
    }
  }

  private async importMappings(
    config: {
      toImport: ImportConfig;
      toSupport: SupportConfig;
    },
    status: ImportStatus,
  ): Promise<void> {
    const toImport = config.toImport;
    const toSupport = config.toSupport;

    if (!_.isEmpty(toSupport.mappings) && !_.isEmpty(toImport.mappings)) {
      throw kerror.get(
        "plugin",
        "runtime",
        "incompatible",
        "_support.mappings",
        "import.mappings",
      );
    } else if (!_.isEmpty(toSupport.mappings)) {
      await this.ask(
        "core:storage:public:mappings:import",
        toSupport.mappings,
        {
          /**
           * If it's the first time the mapping are loaded and another node is already importing the mapping into the database
           * we just want to load the mapping in our own index cache and not in the database.
           */
          indexCacheOnly: status.initialized || !status.locked,
          propagate: false, // Each node needs to do the import themselves
          rawMappings: true,
          refresh: true,
        },
      );
      this.log.info("[✔] Mappings import successful");
    } else if (!_.isEmpty(toImport.mappings)) {
      await this.ask("core:storage:public:mappings:import", toImport.mappings, {
        /**
         * If it's the first time the mapping are loaded and another node is already importing the mapping into the database
         * we just want to load the mapping in our own index cache and not in the database.
         */
        indexCacheOnly: status.initialized || !status.locked,
        propagate: false, // Each node needs to do the import themselves
        refresh: true,
      });
      this.log.info("[✔] Mappings import successful");
    }
  }

  private async importFixtures(
    config: {
      toImport: ImportConfig;
      toSupport: SupportConfig;
    },
    status: ImportStatus,
  ): Promise<void> {
    if (!status.firstCall) {
      return;
    }

    const toSupport = config.toSupport;

    if (!_.isEmpty(toSupport.fixtures)) {
      await this.ask("core:storage:public:document:import", toSupport.fixtures);
      this.log.info("[✔] Fixtures import successful");
    }
  }

  private async importPermissions(
    config: {
      toImport: ImportConfig;
      toSupport: SupportConfig;
    },
    status: ImportStatus,
  ): Promise<void> {
    if (!status.firstCall) {
      return;
    }

    const toImport = config.toImport;
    const toSupport = config.toSupport;

    const isPermissionsToImport = !(
      _.isEmpty(toImport.profiles) &&
      _.isEmpty(toImport.roles) &&
      _.isEmpty(toImport.users)
    );
    const isPermissionsToSupport =
      toSupport.securities &&
      !(
        _.isEmpty(toSupport.securities.profiles) &&
        _.isEmpty(toSupport.securities.roles) &&
        _.isEmpty(toSupport.securities.users)
      );
    if (isPermissionsToSupport && isPermissionsToImport) {
      throw kerror.get(
        "plugin",
        "runtime",
        "incompatible",
        "_support.securities",
        "import profiles roles or users",
      );
    } else if (isPermissionsToSupport) {
      await this.ask("core:security:load", toSupport.securities, {
        force: true,
        refresh: "wait_for",
      });
      this.log.info("[✔] Securities import successful");
    } else if (isPermissionsToImport) {
      await this.ask(
        "core:security:load",
        {
          profiles: toImport.profiles,
          roles: toImport.roles,
          users: toImport.users,
        },
        {
          onExistingUsers: toImport.onExistingUsers,
          onExistingUsersWarning: true,
          refresh: "wait_for",
        },
      );
      this.log.info("[✔] Permissions import successful");
    }
  }
  /**
   * Check if every import has been done, if one of them is not finished yet, wait for it
   */
  private async _waitForImportToFinish() {
    const importTypes = Object.keys(this.importTypes);

    for (const importType of importTypes) {
      // If the import is done, we pop it from the queue to check the next one
      if (
        await this.ask(
          "core:cache:internal:get",
          `backend:init:import:${importType}`,
        )
      ) {
        return;
      }

      await Bluebird.delay(1000);
    }
  }

  private isConfigsEmpty(importConfig, supportConfig) {
    if (
      _.isEmpty(importConfig.mappings) &&
      _.isEmpty(importConfig.profiles) &&
      _.isEmpty(importConfig.roles) &&
      _.isEmpty(importConfig.userMappings) &&
      _.isEmpty(importConfig.users) &&
      _.isEmpty(supportConfig.fixtures) &&
      _.isEmpty(supportConfig.mappings) &&
      _.isEmpty(supportConfig.securities)
    ) {
      return true;
    }
    return false;
  }

  private async persistHashedImport({
    existingRedisHash,
    existingESHash,
    importPayloadHash,
    type,
  }) {
    if (!existingRedisHash && !existingESHash) {
      // If the import is not initialized in the redis cache and in the ES, we initialize it
      this.log.info(`${type} import is not initialized, initializing...`);

      await this.ask(
        "core:storage:private:document:create",
        "kuzzle",
        "imports",
        {
          hash: importPayloadHash,
        },
        { id: `backend:init:import:${type}` },
      );
      await this.ask(
        "core:cache:internal:store",
        `backend:init:import:${type}`,
        importPayloadHash,
      );
    } else if (existingRedisHash && !existingESHash) {
      // If the import is initialized in the redis cache but not in the ES
      // We initialize it in the ES
      this.log.info(
        `${type} import is not initialized in %kuzzle.imports, initializing...`,
      );

      const redisCache = await this.ask(
        "core:cache:internal:get",
        `backend:init:import:${type}`,
      );

      await this.ask(
        "core:storage:private:document:create",
        "kuzzle",
        "imports",
        {
          hash: redisCache,
        },
        { id: `backend:init:import:${type}` },
      );
    } else if (!existingRedisHash && existingESHash) {
      // If the import is initialized in the ES but not in the redis cache
      // We initialize it in the redis cache
      this.log.info(
        `${type} import is not initialized in the redis cache, initializing...`,
      );

      const esDocument = await this.ask(
        "core:storage:private:document:get",
        "kuzzle",
        "imports",
        `backend:init:import:${type}`,
      );

      await this.ask(
        "core:cache:internal:store",
        `backend:init:import:${type}`,
        esDocument._source.hash,
      );
    }
  }

  /**
   * Load into the app several imports
   *
   * @param {Object} toImport - Contains `mappings`, `onExistingUsers`, `profiles`, `roles`, `userMappings`, `users`
   * @param {Object} toSupport - Contains `fixtures`, `mappings`, `securities` (`profiles`, `roles`, `users`)
   *
   * @returns {Promise<void>}
   */
  async loadInitialState(
    toImport: ImportConfig = {},
    toSupport: SupportConfig = {},
  ): Promise<void> {
    if (this.isConfigsEmpty(toImport, toSupport)) {
      return;
    }

    const lockedMutex = [];

    try {
      for (const [type, importMethod] of Object.entries(this.importTypes)) {
        const importPayload = {};

        switch (type) {
          case "fixtures":
            _.set(importPayload, "toSupport.fixtures", toSupport.fixtures);
            break;
          case "mappings":
            _.set(importPayload, "toSupport.mappings", toSupport.mappings);
            _.set(importPayload, "toImport.mappings", toImport.mappings);
            break;
          case "permissions":
            _.set(importPayload, "toSupport.securities", toSupport.securities);
            _.set(importPayload, "toImport.profiles", toImport.profiles);
            _.set(importPayload, "toImport.roles", toImport.roles);
            _.set(importPayload, "toImport.users", toImport.users);
            break;
        }

        const importPayloadHash = sha256(stringify(importPayload));
        const mutex = new Mutex(`backend:import:${type}`, { timeout: 0 });

        const existingRedisHash = await this.ask(
          "core:cache:internal:get",
          `backend:init:import:${type}`,
        );

        const existingESHash = await this.ask(
          "core:storage:private:document:exist",
          "kuzzle",
          "imports",
          `backend:init:import:${type}`,
        );

        let initialized = false;

        if (existingRedisHash) {
          // Check if the import is already initialized inside the redis cache
          initialized = existingRedisHash === importPayloadHash;
        } else if (existingESHash) {
          // Check if the import is already initialized inside the ES
          const esDocument = await this.ask(
            "core:storage:private:document:get",
            "kuzzle",
            "imports",
            `backend:init:import:${type}`,
          );
          initialized = esDocument._source.hash === importPayloadHash;
        }

        const locked = await mutex.lock();

        await importMethod(
          { toImport, toSupport },
          {
            firstCall: !initialized && locked,
            initialized: initialized,
            locked,
          },
        );

        if (locked) {
          lockedMutex.push(mutex);

          await this.persistHashedImport({
            existingESHash,
            existingRedisHash,
            importPayloadHash,
            type,
          });
        }
      }

      await this._waitForImportToFinish();

      this.log.info("[✔] Import successful");
    } finally {
      await Promise.all(lockedMutex.map((mutex) => mutex.unlock()));
    }
  }

  dump(suffix) {
    return this.dumpGenerator.dump(suffix);
  }

  hash(input: any) {
    let inString;

    switch (typeof input) {
      case "string":
      case "number":
      case "boolean":
        inString = input;
        break;
      default:
        inString = stringify(input);
    }

    return murmur.v3(
      Buffer.from(inString),
      this.config.internal.hash.seed as number,
    );
  }

  get state(): typeof kuzzleStateEnum {
    return this._state;
  }

  set state(value: typeof kuzzleStateEnum) {
    this._state = value;
    this.emit("kuzzle:state:change", value);
  }

  /**
   * Register handlers and do a kuzzle dump for:
   * - system signals
   * - unhandled-rejection
   * - uncaught-exception
   */
  registerSignalHandlers() {
    process.removeAllListeners("unhandledRejection");
    process.on("unhandledRejection", (reason, promise) => {
      if (reason !== undefined) {
        if (reason instanceof Error) {
          this.log.error(
            `ERROR: unhandledRejection: ${reason.message}. Reason: ${reason.stack}`,
          );
        } else {
          this.log.error(`ERROR: unhandledRejection: ${reason}`);
        }
      } else {
        this.log.error(`ERROR: unhandledRejection: ${promise}`);
      }

      // Crashing on an unhandled rejection is a good idea during development
      // as it helps spotting code errors. And according to the warning messages,
      // this is what Node.js will do automatically in future versions anyway.
      if (global.NODE_ENV === "development") {
        this.log.error(
          "Kuzzle caught an unhandled rejected promise and will shutdown.",
        );
        this.log.error(
          'This behavior is only triggered if global.NODE_ENV is set to "development"',
        );

        throw reason;
      }
    });

    process.removeAllListeners("uncaughtException");
    process.on("uncaughtException", (err) => {
      this.log.error(`ERROR: uncaughtException: ${err.message}\n${err.stack}`);
      this.dumpAndExit("uncaught-exception");
    });

    // abnormal termination signals => generate a core dump
    for (const signal of ["SIGQUIT", "SIGABRT"]) {
      process.removeAllListeners(signal);
      process.on(signal, () => {
        this.log.error(`ERROR: Caught signal: ${signal}`);
        this.dumpAndExit("signal-".concat(signal.toLowerCase()));
      });
    }

    // signal SIGTRAP is used to generate a kuzzle dump without stopping it
    process.removeAllListeners("SIGTRAP");
    process.on("SIGTRAP", () => {
      this.log.error("Caught signal SIGTRAP => generating a core dump");
      this.dump("signal-sigtrap");
    });

    // gracefully exits on normal termination
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.removeAllListeners(signal);
      process.on(signal, () => {
        this.log.info(`Caught signal ${signal} => gracefully exit`);
        this.shutdown();
      });
    }
  }

  async dumpAndExit(suffix) {
    if (this.config.dump.enabled) {
      try {
        await this.dump(suffix);
      } catch (error) {
        // this catch is just there to prevent unhandled rejections, there is
        // nothing to do with that error
      }
    }

    await this.shutdown();
  }
}

export { Kuzzle };
export default Kuzzle;
