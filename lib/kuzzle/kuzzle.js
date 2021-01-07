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
const Koncorde = require('koncorde');
const Bluebird = require('bluebird');

const nameGenerator = require('../util/name-generator');
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
const InternalIndexHandler = require('./internalIndexHandler');
const CacheEngine = require('../core/cache/cacheEngine');
const StorageEngine = require('../core/storage/storageEngine');
const SecurityModule = require('../core/security');
const RealtimeModule = require('../core/realtime');

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

    // Node unique identifier
    this.id = nameGenerator();

    this.state = Kuzzle.states.STARTING;

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
   * @param {Object} - Additional options (plugins, vaultKey, secretsFile, mappings, fixtures, securities)
   *
   * @this {Kuzzle}
   */
  async start (application, options = {}) {
    this.registerSignalHandlers(this);

    try {
      this.log.info(`[ℹ] Starting Kuzzle ${this.version} ...`);
      await this.pipe('kuzzle:state:start');

      // Koncorde realtime engine
      this.koncorde = new Koncorde({
        maxMinTerms: this.config.limits.subscriptionMinterms,
        regExpEngine: this.config.realtime.pcreSupport ? 'js' : 're2',
        seed: this.config.internal.hash.seed
      });

      await (new CacheEngine()).init();
      await (new StorageEngine()).init();

      await this.internalIndex.init();

      // Secret used to generate JWTs
      this.secret = await this.internalIndex.getSecret();

      this.vault = vault.load(options.vaultKey, options.secretsFile);

      await (new SecurityModule()).init();
      await (new RealtimeModule()).init();

      await this.validation.init();

      await this.tokenManager.init();

      await this.funnel.init();

      this.statistics.init();

      await this.validation.curateSpecification();

      await this.ask('core:storage:public:mappings:import', options.mappings);

      await this.ask('core:storage:public:document:import', options.fixtures);

      if (options.securities) {
        this.log.info('[ℹ] Loading default rights... This can take some time.');
        await this.ask('core:security:load', options.securities, { force: true });
        this.log.info('[✔] Default rights loaded');
      }
      // must be initialized before plugins to allow API requests from plugins
      // before opening connections to external users
      await this.entryPoint.init();

      this.pluginsManager.application = application;
      await this.pluginsManager.init(options.plugins);
      this.log.info(`[✔] Successfully loaded ${this.pluginsManager.plugins.length} plugins: ${this.pluginsManager.plugins.map(p => p.name).join(', ')}`);

      await this.ask('core:security:verify');

      this.router.init();

      this.log.info('[✔] Core components loaded');

      // @deprecated
      await this.pipe('kuzzle:start');

      await this.pipe('kuzzle:state:live');

      await this.entryPoint.startListening();

      await this.pipe('kuzzle:state:ready');

      this.log.info(`[✔] Kuzzle ${this.version} is ready (node name: ${this.id})`);

      // @deprecated
      this.emit('core:kuzzleStart', 'Kuzzle is ready to accept requests');

      this.state = Kuzzle.states.RUNNING;
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
    this.state = Kuzzle.states.SHUTTING_DOWN;

    this.log.info('Initiating shutdown...');
    this.emit('kuzzle:shutdown');

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

  get starting () {
    return this.state === Kuzzle.states.STARTING;
  }

  get running () {
    return this.state === Kuzzle.states.RUNNING;
  }

  get shuttingDown () {
    return this.state === Kuzzle.states.SHUTTING_DOWN;
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
        this.log.error(`ERROR: unhandledRejection: ${reason.message}. Reason: ${reason.stack}`);
      }
      else {
        this.log.error(`ERROR: unhandledRejection: ${promise}`);
      }

      // Crashing on an unhandled rejection is a good idea during development
      // as it helps spotting code errors. And according to the warning messages,
      // this is what Node.js will do automatically in future versions anyway.
      if (process.env.NODE_ENV === 'development') {
        this.log.error('Kuzzle caught an unhandled rejected promise and will shutdown.');
        this.log.error('This behavior is only triggered if NODE_ENV is set to "development"');

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
      process.on(signal, () => this.shutdown());
    }
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

Kuzzle.states = Object.freeze({
  RUNNING: 2,
  SHUTTING_DOWN: 3,
  STARTING: 1,
});

module.exports = Kuzzle;
