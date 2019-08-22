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

const
  debug = require('debug')('kuzzle:services'),
  Bluebird = require('bluebird'),
  _ = require('lodash'),
  errorsManager = require('../config/error-codes');

/**
 * @class Services
 * @param kuzzle
 */
class Services {
  constructor(kuzzle) {
    /**
     * @type {{
   *   internalCache: Redis,
   *   memoryStorage: Redis,
   *   proxyBroker: ProxyBroker,
   *   storageEngine: ElasticSearch
   * }}
     */
    this.list = {};
    this.kuzzle = kuzzle;
  }

  /**
   * Initializes all services.
   * Even if a service is in the blacklist option, it will be instantiated (it won't be initialized though).
   * This allows togglable services.
   * For instance, Kuzzle can be started with some services down by default, and toggled 'on' later.
   *
   * @param options may contains the following properties:
   *            - blacklist (Array): the list of services that should not be initialized
   */
  init(options) {
    let
      blacklist = [],
      whitelist = null;

    if (options) {
      if (options.blacklist) {
        blacklist = options.blacklist;
      }
      if (options.whitelist) {
        whitelist = options.whitelist;
        blacklist = [];
      }
    }

    debug('initializing internal services:\nwhitelist: %O\nblacklist: %O', whitelist, blacklist);

    const promises = Object.keys(this.kuzzle.config.services)
      .filter(key => {
        // @deprecated - "internalBroker" was an internal service until Kuzzle 1.4.0
        // Filtering this configuration allows users to upgrade their Kuzzle from pre-1.4.0
        // without generating a breaking change because of an old configuration file
        // This filter can be removed as soon as Kuzzle v1 support ends
        if (key === 'internalBroker') {
          this.kuzzle.log.warn('Ignoring the "internalBroker" service entry found in the kuzzlerc file. This service is deprecated and its corresponding entry in custom configuration files should be removed.');
          return false;
        }

        return key !== 'common';
      })
      .map(service => {
        // We need to use a deferred promise here as the internalEngine (es) promises do not implement `finally`.
        let opt = {service};

        const init = whitelist
          ? whitelist.indexOf(service) > -1
          : blacklist.indexOf(service) === -1;

        return this.kuzzle.internalEngine
          .get('services', service)
          .then(response => {
            opt = _.merge(opt, response._source);

            return registerService.call(this, service, opt, init);
          })
          .catch(err => {
            if (err.status === 404) {
              return registerService.call(this, service, opt, init);
            }

            return Bluebird.reject(err);
          });
      });

    return Bluebird.all(promises);
  }
}

/**
 * @this {Services}
 * @param serviceName
 * @param opts
 * @param init
 * @returns {Promise.<*>}
 */
function registerService(serviceName, opts, init) {
  const
    services = this.kuzzle.config.services,
    timeout = opts.timeout || this.kuzzle.config.services.common.defaultInitTimeout,
    file = services[serviceName].backend
      ? services[serviceName].backend
      : serviceName,
    aliases = services[serviceName].aliases
      ? services[serviceName].aliases
      : [serviceName];

  const promises = aliases.map(alias => {
    opts.service = alias;

    debug('[%s] register internal service with alias %s from source %s', serviceName, alias, file);

    this.list[alias] =
      new (require('./' + file))(this.kuzzle, opts, services[serviceName]);

    if (! init) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        const error = errorsManager.getError(
          'external',
          'common',
          'service_initialization_timeout',
          alias,
          serviceName,
          timeout);
        reject(error);
      }, timeout);

      this.list[alias].init()
        .then(() => {
          clearTimeout(timeoutHandle);
          resolve();
        })
        .catch(error => reject(error));
    });
  });

  return Promise.all(promises);
}


/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
module.exports = Services;
