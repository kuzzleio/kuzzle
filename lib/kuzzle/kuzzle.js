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
const signal = require('./signal');
const vault = require('./vault');
const shutdown = require('./shutdown');
const DumpGenerator = require('./dumpGenerator');
const AsyncStore = require('../util/asyncStore');
const CacheEngine = require('../core/cache/cacheEngine');
const StorageEngine = require('../core/storage/storageEngine');
const SecurityModule = require('../core/security');
const RealtimeModule = require('../core/realtime');
const InternalIndexHandler = require('./internalIndexHandler');

/**
 * @class Kuzzle
 * @extends EventEmitter
 */
class Kuzzle extends KuzzleEventEmitter {
  constructor (config) {
    super(
      config.plugins.common.maxConcurrentPipes,
      config.plugins.common.pipesBufferSize);

    // Node unique identifier
    this.id = nameGenerator();

    this.state = Kuzzle.states.STARTING;

    this.config = config;

    this.log = new Logger(this);

    this.rootPath = path.resolve(path.join(__dirname, '../..'));

    // Internal index bootstrapper and accessor
    this.internalIndex = new InternalIndexHandler(this);

    this.pluginsManager = new PluginsManager(this);

    this.tokenManager = new TokenManager(this);

    this.passport = new PassportWrapper();

    // The funnel dispatches messages to API controllers
    this.funnel = new Funnel(this);

    // The router listens to client requests and pass them to the funnel
    this.router = new Router(this);

    // Statistics core component
    this.statistics = new Statistics(this);

    // Network entry point
    this.entryPoint = new EntryPoint(this);

    // Validation core component
    this.validation = new Validation(this);

    // Dump generator
    this.dumpGenerator = new DumpGenerator(this);

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
    signal.register(this);

    try {
      this.log.info(`[ℹ] Starting Kuzzle ${this.version} ...`);
      await this.pipe('kuzzle:state:start');

      // Koncorde realtime engine
      this.koncorde = new Koncorde({
        maxMinTerms: this.config.limits.subscriptionMinterms,
        regExpEngine: this.config.realtime.pcreSupport ? 'js' : 're2',
        seed: this.config.internal.hash.seed
      });

      await (new CacheEngine(this)).init();
      await (new StorageEngine(this)).init();

      await this.internalIndex.init();

      // Secret used to generate JWTs
      this.secret = await this.internalIndex.getSecret();

      this.vault = vault.load(options.vaultKey, options.secretsFile);

      await (new SecurityModule(this)).init();
      await (new RealtimeModule(this)).init();

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

      await this.entryPoint.init();

      await this.pluginsManager.init(application, options.plugins);

      await this.ask('core:security:verify');

      await this.router.init();

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

  shutdown () {
    this.state = Kuzzle.states.SHUTTING_DOWN;

    shutdown(this);
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
}

Kuzzle.states = Object.freeze({
  RUNNING: 2,
  SHUTTING_DOWN: 3,
  STARTING: 1,
});

module.exports = Kuzzle;
