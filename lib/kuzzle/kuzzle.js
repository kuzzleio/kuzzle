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

const KuzzleEventEmitter = require('./events/emitter');
const path = require('path');
const { murmurHash128: murmur } = require('murmurhash-native');
const stringify = require('json-stable-stringify');
const Koncorde = require('koncorde');

const config = require('../config');
const EntryPoints = require('../core/network');
const Funnel = require('../api/funnel');
const HotelClerk = require('../core/realtime/hotelClerk');
const Notifier = require('../core/realtime/notifier');
const PassportWrapper = require('../core/auth/passportWrapper');
const PluginsManager = require('../core/plugins/manager');
const Repositories = require('../core/security');
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

/**
 * @class Kuzzle
 * @extends EventEmitter
 */
class Kuzzle extends KuzzleEventEmitter {
  constructor() {
    super(
      config.plugins.common.maxConcurrentPipes,
      config.plugins.common.pipesBufferSize);

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

    this.repositories = new Repositories(this);

    this.passport = new PassportWrapper();

    // The funnel dispatches messages to API controllers
    this.funnel = new Funnel(this);

    // The router listens to client requests and pass them to the funnel
    this.router = new Router(this);

    // Room subscriptions core components
    this.hotelClerk = new HotelClerk(this);

    // Notifications core component
    this.notifier = new Notifier(this);

    // Statistics core component
    this.statistics = new Statistics(this);

    // Network entry points
    this.entryPoints = new EntryPoints(this);

    // Validation core component
    this.validation = new Validation(this);

    // Dump generator
    this.dumpGenerator = new DumpGenerator(this);

    // Vault component (will be initialized after bootstrap)
    this.vault = null;
  }

  /**
   * Initializes all the needed components of a Kuzzle Server instance.
   *
   * By default, this script runs a standalone Kuzzle Server instance:
   *   - Internal services
   *   - Controllers
   *
   * @this {Kuzzle}
   */
  async start (params = {}) {
    signal.register(this);

    try {
      await this.cacheEngine.init();
      this.log.info('[✔] Cache engine initialized');

      await this.storageEngine.init();
      await this.internalIndex.init();
      await this.log.info('[✔] Storage engine initialized');

      this.vault = vault.load(params.vaultKey, params.secretsFile);

      await this.validation.init();
      await this.repositories.init();
      await this.funnel.init();
      await this.storageEngine.public.loadMappings(params.mappings);
      await this.storageEngine.public.loadFixtures(params.fixtures);
      await this.pluginsManager.init(params.additionalPlugins);
      await this.pluginsManager.run();
      this.log.info('[✔] Core components loaded');

      if (params.securities) {
        this.log.info('[ℹ] Loading default rights... This can take some time.');
        await this.ask('core:security:load', params.securities);
      }

      this.log.info('[✔] Default rights loaded');
      this.router.init();
      this.statistics.init();

      this.koncorde = new Koncorde({
        maxMinTerms: this.config.limits.subscriptionMinterms,
        regExpEngine: this.config.realtime.pcreSupport ? 'js' : 're2',
        seed: this.config.internal.hash.seed
      });

      await this.validation.curateSpecification();

      await this.repositories.role.sanityCheck();

      await this.pipe('kuzzle:start');

      await this.entryPoints.init();

      // @deprecated
      this.emit('core:kuzzleStart', 'Kuzzle is started');
    }
    catch(error) {
      this.log.error(error);
      throw error;
    }
  }

  async adminExists () {
    const count = await this.internalIndex.count('users', {
      query: {
        terms: {
          profileIds: ['admin']
        }
      }
    });

    return count > 0;
  }

  shutdown () {
    shutdown(this);
  }

  dump (suffix) {
    return this.dumpGenerator.run(suffix);
  }

  static hash (input) {
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

    return murmur(Buffer.from(inString), 'hex', config.internal.hash.seed);
  }
}

module.exports = Kuzzle;
