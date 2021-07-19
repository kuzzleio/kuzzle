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

const { murmurHash128: murmur } = require('murmurhash-native');
const stringify = require('json-stable-stringify');
const { Koncorde } = require('koncorde');
const Bluebird = require('bluebird');
const segfaultHandler = require('segfault-handler');
const _ = require('lodash');

const kuzzleStateEnum = require('./kuzzleStateEnum');
const KuzzleEventEmitter = require('./event/kuzzleEventEmitter');
const EntryPoint = require('../core/network/entryPoint');
const Funnel = require('../api/funnel');
const PassportWrapper = require('../core/auth/passportWrapper');
const PluginsManager = require('../core/plugin/pluginsManager');
const Router = require('../core/network/router');
const Statistics = require('../core/statistics');
const TokenManager = require('../core/auth/tokenManager');
const Validation = require('../core/validation');
const Logger = require('./log');
const vault = require('./vault');
const DumpGenerator = require('./dumpGenerator');
const AsyncStore = require('../util/asyncStore');
const { Mutex } = require('../util/mutex');
const kerror = require('../kerror');
const InternalIndexHandler = require('./internalIndexHandler');
const CacheEngine = require('../core/cache/cacheEngine');
const StorageEngine = require('../core/storage/storageEngine');
const SecurityModule = require('../core/security');
const RealtimeModule = require('../core/realtime');
const Cluster = require('../cluster');

let _kuzzle = null;

Reflect.defineProperty(global, 'kuzzle', {
  configurable: true,
  enumerable: false,
  get () {
    if (_kuzzle === null) {
      throw new Error('Kuzzle instance not found. Did you try to use a live-only feature before starting your application?');
    }

    return _kuzzle;
  },
  set (value) {
    if (_kuzzle !== null) {
      throw new Error('Cannot build a Kuzzle instance: another one already exists');
    }

    _kuzzle = value;
  },
});

/**
 * @class Kuzzle
 * @extends EventEmitter
 */
class Kuzzle extends KuzzleEventEmitter {
  constructor (config) {
    super(
      config.plugins.common.maxConcurrentPipes,
      config.plugins.common.pipesBufferSize);

    global.kuzzle = this;

    this._state = kuzzleStateEnum.STARTING;

    this.config = config;

    this.log = new Logger();

    this.rootPath = path.resolve(path.join(__dirname, '../..'));

    // Internal index bootstrapper and accessor
    this.internalIndex = new InternalIndexHandler();

    this.pluginsManager = new PluginsManager();
    this.tokenManager = new TokenManager();
    this.passport = new PassportWrapper();

    // The funnel dispatches messages to API controllers
    this.funnel = new Funnel();

    // The router listens to client requests and pass them to the funnel
    this.router = new Router();

    // Statistics core component
    this.statistics = new Statistics();

    // Network entry point
    this.entryPoint = new EntryPoint();

    // Validation core component
    this.validation = new Validation();

    // Dump generator
    this.dumpGenerator = new DumpGenerator();

    // Vault component (will be initialized after bootstrap)
    this.vault = null;

    // AsyncLocalStorage wrapper
    this.asyncStore = new AsyncStore();

    // Kuzzle version
    this.version = require('../../package.json').version;
  }

  /**
   * Initializes all the needed components of Kuzzle.
   *
   * @param {Application} - Application instance
   * @param {Object} - Additional options (fixtures, import, installations, mappings, plugins, secretsFile, securities, vaultKey)
   *
   * @this {Kuzzle}
   */
  async start (application, options = { import: {} }) {
    this.registerSignalHandlers(this);

    try {
      this.log.info(`[ℹ] Starting Kuzzle ${this.version} ...`);
      await this.pipe('kuzzle:state:start');

      // Koncorde realtime engine
      this.koncorde = new Koncorde({
        maxConditions: this.config.limits.subscriptionConditionsCount,
        regExpEngine: this.config.realtime.pcreSupport ? 'js' : 're2',
        seed: this.config.internal.hash.seed
      });

      await (new CacheEngine()).init();
      await (new StorageEngine()).init();
      await (new RealtimeModule()).init();
      await this.internalIndex.init();

      await (new SecurityModule()).init();

      this.id = await (new Cluster()).init();

      // Secret used to generate JWTs
      this.secret = await this.internalIndex.getSecret();

      this.vault = vault.load(options.vaultKey, options.secretsFile);

      await this.validation.init();

      await this.tokenManager.init();

      await this.funnel.init();

      this.statistics.init();

      await this.validation.curateSpecification();

      await this.internalIndex.updateMapping('users', options.import.userMappings);

      if (! _.isEmpty(options.mappings) && ! _.isEmpty(options.import.mappings)) {
        throw kerror.get(
          'plugin',
          'runtime',
          'incompatible',
          '_support.mappings',
          'import.mappings');
      }
      else if (! _.isEmpty(options.mappings)) {
        await this.ask('core:storage:public:mappings:import', options.mappings);
      }
      else if (! _.isEmpty(options.import.mappings)) {
        await this.ask('core:storage:public:mappings:import', options.import.mappings);
      }

      await this.ask('core:storage:public:document:import', options.fixtures);

      // must be initialized before plugins to allow API requests from plugins
      // before opening connections to external users
      await this.entryPoint.init();

      this.pluginsManager.application = application;
      await this.pluginsManager.init(options.plugins);
      this.log.info(`[✔] Successfully loaded ${this.pluginsManager.plugins.length} plugins: ${this.pluginsManager.plugins.map(p => p.name).join(', ')}`);

      // ACLs must be loaded after plugins has started, otherwise importing
      // users with credentials will fail and will prevent Kuzzle from starting
      this.log.info('[ℹ] Loading default rights... This can take some time.');

      const isSecuritiesImport = ! (
        _.isEmpty(options.import.profiles)
        && _.isEmpty(options.import.roles)
        && _.isEmpty(options.import.users)
      );
      if ((! _.isEmpty(options.securities)) && isSecuritiesImport) {
        throw kerror.get(
          'plugin',
          'runtime',
          'incompatible',
          '_support.securities',
          'import profiles roles or users');
      }
      else if (! _.isEmpty(options.securities)) {
        await this.ask('core:security:load', options.securities, { force: true });
      }
      else if (isSecuritiesImport) {
        await this.ask('core:security:load',
          {
            profiles: options.import.profiles,
            roles: options.import.roles,
            users: options.import.users,
          },
          { onExistingUsers: options.import.onExistingUsers });
      }

      this.log.info('[✔] Default rights loaded');

      await this.ask('core:security:verify');

      this.router.init();

      this.log.info('[✔] Core components loaded');

      await this.install(options.installations);

      // @deprecated
      await this.pipe('kuzzle:start');

      await this.pipe('kuzzle:state:live');

      await this.entryPoint.startListening();

      await this.pipe('kuzzle:state:ready');

      this.log.info(`[✔] Kuzzle ${this.version} is ready (node name: ${this.id})`);

      // @deprecated
      this.emit('core:kuzzleStart', 'Kuzzle is ready to accept requests');

      this._state = kuzzleStateEnum.RUNNING;
    }
    catch(error) {
      this.log.error(`[X] Cannot start Kuzzle ${this.version}: ${error.message}`);

      throw error;
    }
  }

  /**
   * Gracefully exits after processing remaining requests
   *
   * @returns {Promise}
   */
  async shutdown () {
    this._state = kuzzleStateEnum.SHUTTING_DOWN;

    this.log.info('Initiating shutdown...');
    await this.pipe('kuzzle:shutdown');

    // @deprecated
    this.emit('core:shutdown');

    // Ask the network layer to stop accepting new request
    this.entryPoint.dispatch('shutdown');

    while (this.funnel.remainingRequests !== 0) {
      this.log.info(`[shutdown] Waiting: ${this.funnel.remainingRequests} remaining requests`);
      await Bluebird.delay(1000);
    }

    this.log.info('Halted.');

    process.exit(0);
  }

  /**
   * Execute multiple handlers only once on any given environment
   *
   * @param {Array<{ id: string, handler: () => void, description?: string }>} installations - Array of unique methods to execute
   *
   * @returns {Promise<void>}
   */
  async install (installations) {
    if (! installations || ! installations.length) {
      return;
    }

    const mutex = new Mutex('backend:installations');
    await mutex.lock();

    try {
      for (const installation of installations) {
        const isAlreadyInstalled = await this.ask(
          'core:storage:private:document:exist',
          'kuzzle',
          'installations',
          installation.id );

        if (! isAlreadyInstalled) {
          try {
            await installation.handler();
          }
          catch (error) {
            throw kerror.get(
              'plugin',
              'runtime',
              'unexpected_installation_error',
              installation.id, error);
          }

          await this.ask(
            'core:storage:private:document:create',
            'kuzzle',
            'installations',
            {
              description: installation.description,
              handler: installation.handler.toString(),
              installedAt: Date.now() },
            { id: installation.id });

          this.log.info(`[✔] Install code "${installation.id}" successfully executed`);
        }
      }
    }
    finally {
      await mutex.unlock();
    }
  }

  dump (suffix) {
    return this.dumpGenerator.dump(suffix);
  }

  hash (input) {
    let inString;

    switch (typeof input) {
      case 'string':
      case 'number':
      case 'boolean':
        inString = input;
        break;
      default:
        inString = stringify(input);
    }

    return murmur(Buffer.from(inString), 'hex', this.config.internal.hash.seed);
  }

  get state () {
    return this._state;
  }

  set state (value) {
    this._state = value;
    this.emit('kuzzle:state:change', value);
  }

  /**
   * Register handlers and do a kuzzle dump for:
   * - system signals
   * - unhandled-rejection
   * - uncaught-exception
   *
   * @param {Kuzzle} kuzzle
   */
  registerSignalHandlers () {
    process.removeAllListeners('unhandledRejection');
    process.on('unhandledRejection', (reason, promise) => {
      if (reason !== undefined) {
        if (reason instanceof Error) {
          this.log.error(`ERROR: unhandledRejection: ${reason.message}. Reason: ${reason.stack}`);
        }
        else {
          this.log.error(`ERROR: unhandledRejection: ${reason}`);
        }
      }
      else {
        this.log.error(`ERROR: unhandledRejection: ${promise}`);
      }

      // Crashing on an unhandled rejection is a good idea during development
      // as it helps spotting code errors. And according to the warning messages,
      // this is what Node.js will do automatically in future versions anyway.
      if (global.NODE_ENV === 'development') {
        this.log.error('Kuzzle caught an unhandled rejected promise and will shutdown.');
        this.log.error('This behavior is only triggered if global.NODE_ENV is set to "development"');

        throw reason;
      }
    });

    process.removeAllListeners('uncaughtException');
    process.on('uncaughtException', err => {
      this.log.error(`ERROR: uncaughtException: ${err.message}\n${err.stack}`);
      this.dumpAndExit('uncaught-exception');
    });

    // abnormal termination signals => generate a core dump
    for (const signal of ['SIGQUIT', 'SIGABRT']) {
      process.removeAllListeners(signal);
      process.on(signal, () => {
        this.log.error(`ERROR: Caught signal: ${signal}`);
        this.dumpAndExit('signal-'.concat(signal.toLowerCase()));
      });
    }

    // signal SIGTRAP is used to generate a kuzzle dump without stopping it
    process.removeAllListeners('SIGTRAP');
    process.on('SIGTRAP', () => {
      this.log.error('Caught signal SIGTRAP => generating a core dump');
      this.dump('signal-sigtrap');
    });

    // gracefully exits on normal termination
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.removeAllListeners(signal);
      process.on(signal, () => {
        this.log.info(`Caught signal ${signal} => gracefully exit`);
        this.shutdown();
      });
    }

    segfaultHandler.registerHandler();
  }

  async dumpAndExit (suffix) {
    if (this.config.dump.enabled) {
      try {
        await this.dump(suffix);
      }
      catch(error) {
        // this catch is just there to prevent unhandled rejections, there is
        // nothing to do with that error
      }
    }

    await this.shutdown();
  }
}

module.exports = Kuzzle;
