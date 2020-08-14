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

const KuzzleEventEmitter = require('./event/kuzzleEventEmitter');
const EntryPoint = require('../core/network/entryPoint');
const Funnel = require('../api/funnel');
const PassportWrapper = require('../core/auth/passportWrapper');
const PluginsManager = require('../core/plugin/pluginsManager');
const Router = require('../core/network/router');
const Statistics = require('../core/statistics');
const TokenManager = require('../core/auth/tokenManager');
const Validation = require('../core/validation');
const InternalIndexBootstrap = require('../core/storage/bootstrap/internalIndexBootstrap');
const IndexStorage = require('../core/storage/indexStorage');
const CacheEngine = require('../core/cache/cacheEngine');
const StorageEngine = require('../core/storage/storageEngine');
const Logger = require('./log');
const signal = require('./signal');
const vault = require('./vault');
const shutdown = require('./shutdown');
const DumpGenerator = require('./dumpGenerator');
const AsyncStore = require('../util/asyncStore');
const coreModules = require('../core');

/**
 * @class Kuzzle
 * @extends EventEmitter
 */
class Kuzzle extends KuzzleEventEmitter {
  constructor (config) {
    super(
      config.plugins.common.maxConcurrentPipes,
      config.plugins.common.pipesBufferSize);

    this.started = false;
    this.config = config;

    this.log = new Logger(this);

    this.rootPath = path.resolve(path.join(__dirname, '../..'));

    this.cacheEngine = new CacheEngine(this);

    this.storageEngine = new StorageEngine(this);

    // Restricted storage engine for kuzzle internal index ('%kuzzle')
    this.internalIndex = new IndexStorage(
      this.storageEngine.config.internalIndex.name,
      this.storageEngine.internal);
    // Attach bootstraper to internal index engine
    this.internalIndex.bootstrap = new InternalIndexBootstrap(
      this,
      this.internalIndex);

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

    /* eslint-disable no-console */
    try {
      console.log(`[ℹ] Starting Kuzzle ${this.version} ...`);
      await this.pipe('kuzzle:state:start');

      // Koncorde realtime engine
      this.koncorde = new Koncorde({
        maxMinTerms: this.config.limits.subscriptionMinterms,
        regExpEngine: this.config.realtime.pcreSupport ? 'js' : 're2',
        seed: this.config.internal.hash.seed
      });

      await this.cacheEngine.init();
      console.log('[✔] Cache engine initialized');

      await this.storageEngine.init();
      await this.internalIndex.init();
      console.log('[✔] Storage engine initialized');

      this.vault = vault.load(options.vaultKey, options.secretsFile);

      await this.validation.init();

      await coreModules.init(this);

      await this.tokenManager.init();

      await this.funnel.init();

      this.statistics.init();

      await this.validation.curateSpecification();

      await this.storageEngine.public.loadMappings(options.mappings);

      await this.storageEngine.public.loadFixtures(options.fixtures);

      if (options.securities) {
        console.log('[ℹ] Loading default rights... This can take some time.');
        await this.ask('core:security:load', options.securities);
        console.log('[✔] Default rights loaded');
      }

      await this.ask('core:security:verify');

      // must be initialized before plugins to allow API requests from plugins
      // before opening connections to external users
      await this.entryPoint.init();

      this.pluginsManager.application = application;
      await this.pluginsManager.init(options.plugins);
      console.log(`[✔] Successfully loaded ${this.pluginsManager.plugins.length} plugins: ${this.pluginsManager.plugins.map(p => p.name).join(', ')}`);

      this.router.init();

      this.log.info('[✔] Core components loaded');

      // @deprecated
      await this.pipe('kuzzle:start');

      await this.pipe('kuzzle:state:live');

      await this.entryPoint.startListening();

      await this.pipe('kuzzle:state:ready');

      console.log(`[✔] Kuzzle ${this.version} is ready`);

      // @deprecated
      this.emit('core:kuzzleStart', 'Kuzzle is ready to accept requests');

      this.started = true;
    }
    catch(error) {
      this.log.error(error);

      throw error;
    }
    /* eslint-enable no-console */
  }

  shutdown () {
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
}

module.exports = Kuzzle;
