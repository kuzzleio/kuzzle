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
import { inspect } from "node:util";

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
import type Plugin from "../core/plugin/plugin";
import type { OpenApiDefinition } from "../types/OpenApiDefinition";
import RealtimeModule from "../core/realtime";
import SecurityModule from "../core/security";
import Statistics from "../core/statistics/statistics";
import StorageEngine from "../core/storage/storageEngine";
import Validation from "../core/validation/validation";
import * as kerror from "../kerror";
import type { IKuzzleConfiguration } from "../types/config/KuzzleConfiguration";
import AsyncStore from "../util/asyncStore";
import { sha256 } from "../util/crypto";
import { releaseAllLocksBeforeExit, withLock } from "../util/distributedLock";
import { Mutex } from "../util/mutex";
import type {
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
import { NameGenerator } from "../util/name-generator";

let _kuzzle: Kuzzle | null = null;

/**
 * How long a shutdown caused by a failure may run before the process exits
 * anyway: a `kuzzle:shutdown` pipe or a lock release that never settles must
 * not keep a failed node alive, which a bare `process.exit(1)` never did
 */
const FAILURE_SHUTDOWN_TIMEOUT = 30000;

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
  initialized?: boolean;
  firstCall?: boolean;
};

class Kuzzle extends KuzzleEventEmitter {
  public config: IKuzzleConfiguration;
  private _state: kuzzleStateEnum = kuzzleStateEnum.STARTING;
  /** The running shutdown, which later `shutdown()` calls wait for (#3017) */
  private shutdownPromise: Promise<void> | null = null;
  /** The highest exit code asked for by the `shutdown()` calls so far */
  private shutdownExitCode = 0;
  /** Ends a failure's shutdown that does not finish in time */
  private shutdownWatchdog: NodeJS.Timeout | null = null;
  public log: Logger;
  /** Read by `PluginsManager` to locate the plugins directories. */
  public rootPath: string;
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
  public statistics: Statistics;

  /**
   * Network entry point
   */
  public entryPoint: EntryPoint;

  /**
   * Validation core component
   */
  public validation: Validation;

  /**
   * Dump generator
   */
  private dumpGenerator: DumpGenerator;

  /**
   * Vault component (will be initialized after bootstrap)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  public vault: any;

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

  /**
   * Built by `start()`, from the application's own OpenAPI declaration.
   * Nothing reads it before then — `server:openapi` answers off it, and the
   * API is not serving yet.
   */
  private openApiManager: OpenApiManager | undefined;

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

  /**
   * The realtime engine, and the secret read out of the internal index.
   * Both are set by `start()`, before anything that uses them is wired up.
   */
  public koncorde!: Koncorde;
  public secret!: string;

  /**
   * Node unique ID amongst other cluster nodes
   */
  public id: string;

  constructor(config: IKuzzleConfiguration) {
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

    // `global.nodeId` when a `Backend` named this process, and a name of the
    // same shape otherwise — the draw `ClusterIdCardHandler` makes for the
    // same reason. This field was declared `string` and assigned nowhere, so
    // every reader of `kuzzle.id` — the redis `SETNAME`, the ID card, the
    // `node` field of every realtime notification — has been reading
    // `undefined`. `accessLogger` sends `global.nodeId` to its worker and
    // reads it back as `kuzzle.id`, which is what says the two are the same
    // value.
    this.id =
      global.nodeId ?? NameGenerator.generateRandomName({ prefix: "knode" });

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
   *
   * The public signature takes `unknown`, which every call that compiled with
   * v2.56.0's `any` still satisfies. `Backend.start()` is the one caller, and
   * it hands the application wrapper the implementation reads.
   */
  start(application: unknown, options?: StartOptions): Promise<void>;
  async start(
    application: Plugin & { openApi: OpenApiDefinition },
    options?: StartOptions,
  ): Promise<void> {
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
      await this.initKuzzleNode();

      this.vault = vault.load(
        options?.vaultKey,
        options?.secretsFile,
        this.config.vault?.newAlgorithm,
      );

      this.validation.init();

      await this.tokenManager.init();

      await this.funnel.init();

      this.statistics.init();

      await this.validation.curateSpecification();

      // must be initialized before plugins to allow API requests from plugins
      // before opening connections to external users
      await this.entryPoint.init();

      await this.debugger.init();

      this.pluginsManager.application = application;
      const pluginImports = await this.pluginsManager.init(options?.plugins);

      const imports = _.merge({}, pluginImports, options?.import);

      // Authentification plugins must be loaded before users import to avoid
      // credentials related error which would prevent Kuzzle from starting
      await this.loadInitialState(imports, options?.support);

      await this.ask("core:security:verify");

      this.router.init();

      this.log.info("[✔] Core components loaded");

      await this.install(options?.installations);

      // `application` is the very wrapper handed to the plugins manager six
      // lines up, so reading the name back off the manager was a round trip
      // through a getter that can answer `undefined`.
      this.log.info(`[✔] Start "${application.name}" application`);
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
        `[✔] Kuzzle ${this.version} is ready (node name: ${global.nodeId})`,
      );

      // @deprecated
      this.emit("core:kuzzleStart", "Kuzzle is ready to accept requests");

      this._state = kuzzleStateEnum.RUNNING;
    } catch (error) {
      this.log.error(
        `[X] Cannot start Kuzzle ${this.version}: ${
          error instanceof Error ? error.message : inspect(error)
        }`,
      );

      // A failed start cannot be retried (a second Kuzzle instance cannot be
      // built), and what it did start keeps the process alive: in production,
      // a node with no listener and an ID card still renewed (#3020). Not
      // awaited, so the caller still gets the error before the process exits.
      this.shutdown(1).catch((shutdownError: unknown) => {
        this.log.error(
          `Unable to shut down after a failed start: ${
            shutdownError instanceof Error
              ? shutdownError.message
              : inspect(shutdownError)
          }`,
        );
        process.exit(1);
      });

      throw error;
    }
  }

  /**
   * Generates the node ID.
   *
   * This will init the cluster if it's enabled.
   */
  private async initKuzzleNode(): Promise<void> {
    if (this.config.cluster.enabled) {
      await new Cluster().init();

      this.log.info("[✔] Cluster initialized");

      // The storage caches were loaded before the join: what a peer created
      // in between was broadcast before this node could hear it. Read them
      // again before the plugins' `init()` relies on them (#3044).
      await Promise.all([
        this.ask("core:storage:public:cache:reload"),
        this.ask("core:storage:private:cache:reload"),
      ]);
    } else {
      this.log.info("[X] Cluster disabled: single node mode.");
    }
  }

  /**
   * Gracefully exits after processing remaining requests
   *
   * @param exitCode - the process exit code: 0 for a requested shutdown, and
   *   non-zero when the node leaves because of a failure (e.g. a cluster
   *   eviction), so that an `on-failure` restart policy brings it back
   *
   * @returns {Promise}
   */
  async shutdown(exitCode = 0): Promise<void> {
    // Several sources can ask for it at once (a signal, a cluster eviction,
    // the `exit` handler that `process.exit` below fires): they share the one
    // shutdown, and a failure reported by any of them keeps the exit non-zero
    this.shutdownExitCode = Math.max(this.shutdownExitCode, exitCode);

    // Not for a requested shutdown: it waits for the requests still running,
    // however long they take
    if (exitCode !== 0) {
      this.shutdownWatchdog ??= setTimeout(() => {
        this.log.error(
          `[shutdown] Not finished after ${FAILURE_SHUTDOWN_TIMEOUT}ms: exiting now`,
        );
        process.exit(this.shutdownExitCode);
      }, FAILURE_SHUTDOWN_TIMEOUT);
    }

    this.shutdownPromise ??= this.runShutdown();

    return this.shutdownPromise;
  }

  private async runShutdown(): Promise<void> {
    this._state = kuzzleStateEnum.SHUTTING_DOWN;

    this.log.info("Initiating shutdown...");

    // Ask the network layer to stop accepting new request
    this.entryPoint.dispatch("shutdown", {});

    await this.pipe("kuzzle:shutdown");

    // @deprecated
    this.emit("core:shutdown");

    while (this.funnel.remainingRequests !== 0) {
      this.log.info(
        `[shutdown] Waiting: ${this.funnel.remainingRequests} remaining requests`,
      );
      await Bluebird.delay(1000);
    }

    // The other nodes may be waiting on a lock this one holds: a node leaving
    // mid-startup is often in the middle of one (F-13).
    await Promise.all([
      releaseAllLocksBeforeExit(),
      Mutex.releaseAllBeforeExit(), // NOSONAR: frees locks taken through the deprecated API
    ]);

    this.log.info("Halted.");

    // flush both application and Kuzzle core loggers before leaving (Could happen even if some core/application components are not initialized)
    await this?.log?.flush?.();

    // `log` lives on the application *instance* (`Backend`), while
    // `pluginsManager.application` is the `Plugin` wrapper around it, which
    // nothing ever assigns a `log` to — so the previous
    // `pluginsManager?.application?.log?.flush?.()` was a silent no-op and the
    // application's buffered logs were dropped on shutdown (TD-51).
    await this?.pluginsManager?.application?.instance?.log?.flush?.();

    if (this.shutdownWatchdog !== null) {
      clearTimeout(this.shutdownWatchdog);
    }

    process.exit(this.shutdownExitCode);
  }

  /**
   * Execute multiple handlers only once on any given environment
   *
   * @param {Array<{ id: string, handler: () => void, description?: string }>} installations - Array of unique methods to execute
   *
   * @returns {Promise<void>}
   */
  async install(installations?: InstallationConfig[]): Promise<void> {
    // Optional, which is what `options.installations` is and what the
    // `?.length` below already read it as.
    if (!installations?.length) {
      return;
    }

    // No retry limit: another node is running the installations, and this
    // one must not start before they are recorded
    await withLock(
      "backend:installations",
      async () => {
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
      },
      { retryAttempts: Number.POSITIVE_INFINITY },
    );
  }

  // For testing purpose
  async ask(event: string, ...args: [payload?: unknown, ...rest: unknown[]]) {
    return super.ask(event, ...args);
  }

  // For testing purpose
  emit(event: string, ...args: unknown[]) {
    return super.emit(event, ...args);
  }

  // For testing purpose
  async pipe(event: string, ...args: unknown[]) {
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
          // Already imported (by this node or another one): only fill the cache
          indexCacheOnly: status.initialized,
          propagate: false, // Each node needs to do the import themselves
          rawMappings: true,
          refresh: true,
        },
      );
      this.log.info("[✔] Mappings import successful");
    } else if (!_.isEmpty(toImport.mappings)) {
      await this.ask("core:storage:public:mappings:import", toImport.mappings, {
        // Already imported (by this node or another one): only fill the cache
        indexCacheOnly: status.initialized,
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
  private isConfigsEmpty(
    importConfig: ImportConfig,
    supportConfig: SupportConfig,
  ) {
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

  /**
   * Records the hash of the payload just imported (or found already imported)
   * in both Redis and `%kuzzle.imports`, so that the next node or the next
   * start can tell the import is done for this very payload
   */
  private async persistHashedImport({
    existingRedisHash,
    existingESHash,
    importPayloadHash,
    initialized,
    type,
  }: {
    existingRedisHash: string | null;
    existingESHash: string | null;
    importPayloadHash: string;
    initialized: boolean;
    type: string;
  }) {
    // Not initialized: the payload was just imported, and a hash left by a
    // previous payload must be replaced, or every start would import it again
    if (!initialized || !existingESHash) {
      this.log.info(`Recording the ${type} import in %kuzzle.imports...`);

      // `createOrReplace`, not `create`: this document has a fixed id, so a
      // conflict on it means another node initialized the same import — an
      // outcome to converge on, not an error to die on. `create` made that
      // conflict fatal to startup (TD-69, #2782).
      await this.ask(
        "core:storage:private:document:createOrReplace",
        "kuzzle",
        "imports",
        `backend:init:import:${type}`,
        {
          hash: importPayloadHash,
        },
      );
    }

    if (!initialized || !existingRedisHash) {
      await this.ask(
        "core:cache:internal:store",
        `backend:init:import:${type}`,
        importPayloadHash,
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

    const importTypes = Object.entries(this.importTypes);

    // Imports the types from `index` on. Each type's lock is taken around the
    // remaining types, so that every lock taken is held until all the imports
    // are done: a node waiting for the first lock starts only once the node
    // ahead of it has imported everything.
    const importFrom = async (index: number): Promise<void> => {
      const next = importTypes[index];

      if (!next) {
        return;
      }

      const [type, importMethod] = next;
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

      // `?? ""`: `json-stable-stringify` answers undefined for a value it
      // cannot serialise, and the payload is built right above.
      const importPayloadHash = sha256(stringify(importPayload) ?? "");

      const importType = async () => {
        // Read the bookkeeping *after* the lock, never before: a read taken
        // before acquiring it is not protected by it, and the holder that
        // acted on a stale "not initialized" used to create a document the
        // previous holder had just written — killing its own startup with
        // `Document already exists`. See TD-69 (#2782).
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

        await importMethod(
          { toImport, toSupport },
          {
            firstCall: !initialized,
            initialized,
          },
        );

        await this.persistHashedImport({
          existingESHash,
          existingRedisHash,
          importPayloadHash,
          initialized,
          type,
        });

        await importFrom(index + 1);
      };

      // No retry limit: the node holding it is running this import, and this
      // one must not start before it is done. Once it gets the lock, it finds
      // the import done for this payload and only fills its cache; if the
      // node ahead died mid-import, it runs the import itself. The lock is
      // refreshed while held; a lost lock fails the startup with
      // `MutexLockLostError` (the bookkeeping write stays idempotent, TD-69).
      await withLock(`backend:import:${type}`, importType, {
        retryAttempts: Number.POSITIVE_INFINITY,
        ttl: 60000,
      });
    };

    await importFrom(0);

    this.log.info("[✔] Import successful");
  }

  dump(suffix: string) {
    return this.dumpGenerator.dump(suffix);
  }

  hash(input: unknown) {
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
      Buffer.from(String(inString)),
      this.config.internal.hash.seed as number,
    );
  }

  get state(): kuzzleStateEnum {
    return this._state;
  }

  set state(value: kuzzleStateEnum) {
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

    process.on("exit", () => {
      this.shutdown();
    });

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
      // Nothing awaits this dump: a failure (another dump running, an
      // unwritable dump path) is logged rather than left unhandled.
      this.dump("signal-sigtrap").catch((error: unknown) => {
        this.log.error(
          `Unable to dump on SIGTRAP: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
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

  async dumpAndExit(suffix: string) {
    if (this.config.dump.enabled) {
      try {
        await this.dump(suffix);
      } catch {
        // this catch is just there to prevent unhandled rejections, there is
        // nothing to do with that error
      }
    }

    // Only abnormal terminations get here: exit non-zero, so that an
    // `on-failure` restart policy brings the node back (#3020)
    await this.shutdown(1);
  }
}

export { Kuzzle };
export default Kuzzle;
