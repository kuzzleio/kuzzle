/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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

const
  { randomBytes } = require('crypto'),
  EventEmitter = require('eventemitter3'),
  config = require('../config'),
  path = require('path'),
  murmur = require('murmurhash-native').murmurHash128,
  stringify = require('json-stable-stringify'),
  _ = require('lodash'),
  Koncorde = require('koncorde'),
  EntryPoints = require('./core/entrypoints'),
  FunnelController = require('./controllers/funnelController'),
  HotelClerk = require('./core/hotelClerk'),
  Janitor = require('./core/janitor'),
  IndexCache = require('./core/indexCache'),
  InternalEngine = require('../services/internalEngine'),
  Notifier = require('./core/notifier'),
  PassportWrapper = require('./core/auth/passportWrapper'),
  PluginsManager = require('./core/plugins/pluginsManager'),
  Repositories = require('./core/models/repositories'),
  RouterController = require('./controllers/routerController'),
  Services = require('../services'),
  Statistics = require('./core/statistics'),
  TokenManager = require('./core/auth/tokenManager'),
  Validation = require('./core/validation'),
  InternalEngineBootstrap = require('../services/internalEngine/bootstrap'),
  Vault = require('kuzzle-vault'),
  runShutdown = require('../util/shutdown'),
  fs = require('fs'),
  Logger = require('../util/log');

/**
 * For a specific event, returns the event and all its wildcarded versions
 * @example
 *  getWildcardEvents('data:create') // return ['data:create', 'data:*']
 *  getWildcardEvents('data:beforeCreate') // return ['data:beforeCreate',
 *                                         //         'data:*', 'data:before*']
 * @param {String} event
 * @returns {Array<String>} wildcard events
 */
const getWildcardEvents = _.memoize(event => {
  const
    events = [event],
    delimIndex = event.lastIndexOf(':');

  if (delimIndex === -1) {
    return events;
  }

  const
    scope = event.slice(0, delimIndex),
    name = event.slice(delimIndex + 1);

  ['before', 'after'].forEach(prefix => {
    if (name.startsWith(prefix)) {
      events.push(`${scope}:${prefix}*`);
    }
  });

  events.push(`${scope}:*`);

  return events;
});


/**
 * @class Kuzzle
 * @extends EventEmitter
 */
class Kuzzle extends EventEmitter {
  constructor() {
    super();

    this.id = randomBytes(8);
    this.config = config;
    this.log = new Logger(this);

    this.rootPath = path.resolve(path.join(__dirname, '..', '..'));

    this.services = new Services(this);
    this.internalEngine = new InternalEngine(this);
    this.pluginsManager = new PluginsManager(this);
    this.tokenManager = new TokenManager(this);
    this.indexCache = new IndexCache(this);
    this.repositories = new Repositories(this);

    this.passport = new PassportWrapper();

    // The funnel controller dispatch messages between the router controller and other controllers
    this.funnel = new FunnelController(this);

    // The router controller listens to client requests and pass them to the funnel controller
    this.router = new RouterController(this);

    // Room subscriptions core components
    this.hotelClerk = new HotelClerk(this);

    // Notifications core component
    /** @type {Notifier} */
    this.notifier = new Notifier(this);

    // Statistics core component
    this.statistics = new Statistics(this);

    // Http server and websocket channel with server
    this.entryPoints = new EntryPoints(this);

    // Validation core component
    this.validation = new Validation(this);

    // Janitor component
    this.janitor = new Janitor(this);

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
  start (params = {}) {
    const internalEngineBootstrap = new InternalEngineBootstrap(this, this.internalEngine);
    registerSignalHandlers(this);

    return this.internalEngine.init(internalEngineBootstrap)
      .then(() => this.internalEngine.bootstrap.all())
      .then(() => {
        this.vault = initVault(params.vaultKey, params.secretsFile);
      })
      .then(() => this.services.init())
      .then(() => this.validation.init())
      .then(() => this.indexCache.init())
      .then(() => this.repositories.init())
      .then(() => this.funnel.init())
      .then(() => this.janitor.loadMappings(params.mappings))
      .then(() => this.janitor.loadFixtures(params.fixtures))
      .then(() => this.pluginsManager.init(params.additionalPlugins))
      .then(() => this.pluginsManager.run())
      .then(() => {
        this.log.info('Services Initialized');

        if (!params.securities) {
          return null;
        }

        this.log.info('Loading default rights... This can take some time.');
        return this.janitor.loadSecurities(params.securities);
      })
      .then(() => {
        this.log.info('Default rights loaded.');
        this.router.init();
        this.statistics.init();

        this.realtime = new Koncorde({
          seed: this.config.internal.hash.seed,
          maxMinTerms: this.config.limits.subscriptionMinterms,
          regExpEngine: this.config.realtime.pcreSupport ? 'js' : 're2'
        });

        return this.validation.curateSpecification();
      })
      .then(() => this.entryPoints.init())
      .then(() => {
        this.emit('core:kuzzleStart', 'Kuzzle is started');
        return null;
      })
      .catch(error => {
        this.log.error(error);
        throw error;
      });
  }

  /**
   * Emits an event and all its wildcarded versions
   *
   * @param  {string} event
   * @param  {*} data
   */
  emit (event, data) {
    const events = getWildcardEvents(event);

    let i; // NOSONAR
    for (i = 0; i < events.length; i++) {
      super.emit(events[i], data);
    }
  }

  /**
   * Chains all registered pipes on an event, and then emits it the regular
   * way.
   *
   * @param  {string} event
   * @param  {*} data
   * @return {Promise.<*>}
   */
  pipe (event, ...data) {
    const events = getWildcardEvents(event);

    return this.pluginsManager.pipe(events, ...data)
      .then(updated => {
        let i; // NOSONAR
        for (i = 0; i < events.length; i++) {
          super.emit(events[i], updated);
        }

        return updated;
      });
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

/**
 * Register handlers and do a kuzzle dump for:
 * - system signals
 * - unhandled-rejection
 * - uncaught-exception
 *
 * @param {Kuzzle} kuzzle
 */
function registerSignalHandlers (kuzzle) {
  // Remove external listeners (PM2) to avoid other listeners to exit current
  // process
  process.removeAllListeners('unhandledRejection');
  process.on('unhandledRejection', (reason, promise) => {
    if (reason !== undefined) {
      kuzzle.log.error(
        `ERROR: unhandledRejection: ${reason.message}`, reason.stack, promise);
    } else {
      kuzzle.log.error(`ERROR: unhandledRejection: ${promise}`);
    }

    // Crashing on an unhandled rejection is a good idea during development
    // as it helps spotting code errors. And according to the warning messages,
    // this is what Node.js will do automatically in future versions anyway.
    if (process.env.NODE_ENV === 'development') {
      kuzzle.log.error('Kuzzle caught an unhandled rejected promise and will shutdown.');
      kuzzle.log.error('This behavior is only triggered if NODE_ENV is set to "development"');

      throw reason;
    }
  });

  process.removeAllListeners('uncaughtException');
  process.on('uncaughtException', err => {
    kuzzle.log.error(`ERROR: uncaughtException: ${err.message}\n${err.stack}`);
    dumpAndExit(kuzzle, 'uncaught-exception');
  });

  // abnormal termination signals => generate a core dump
  for (const signal of ['SIGQUIT', 'SIGABRT']) {
    process.removeAllListeners(signal);
    process.on(signal, () => {
      kuzzle.log.error(`ERROR: Caught signal: ${signal}`);
      dumpAndExit(kuzzle, 'signal-'.concat(signal.toLowerCase()));
    });
  }

  // signal SIGTRAP is used to generate a kuzzle dump without stopping it
  process.removeAllListeners('SIGTRAP');
  process.on('SIGTRAP', () => {
    kuzzle.log.error('Caught signal SIGTRAP => generating a core dump');
    kuzzle.janitor.dump('signal-sigtrap');
  });

  // gracefully exits on normal termination
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.removeAllListeners(signal);
    process.on(signal, () => runShutdown(kuzzle));
  }
}

function dumpAndExit(kuzzle, suffix) {
  if (!kuzzle.config.dump.enabled) {
    return runShutdown(kuzzle)
      .catch(() => {
        // do nothing, prevents unhandled rejections
      });
  }

  kuzzle.janitor.dump(suffix)
    .catch(() => {
      // do nothing, prevents unhandled rejections
    })
    .finally(() => runShutdown(kuzzle));
}

function initVault (vaultKey, secretsFile) {
  const
    defaultEncryptedSecretsFile =
      path.resolve(`${__dirname}/../../config/secrets.enc.json`),
    encryptedSecretsFile =
      secretsFile || process.env.KUZZLE_SECRETS_FILE || defaultEncryptedSecretsFile;

  let key = vaultKey;
  if ((!_.isString(vaultKey) || vaultKey.length <= 0)
     && _.isString(process.env.KUZZLE_VAULT_KEY)
     && process.env.KUZZLE_VAULT_KEY.length > 0
  ) {
    key = process.env.KUZZLE_VAULT_KEY;
  }

  const vault = new Vault(key, null, encryptedSecretsFile);

  if (key && fs.existsSync(encryptedSecretsFile)) {
    vault.decrypt();
  }

  return vault;
}

module.exports = Kuzzle;
