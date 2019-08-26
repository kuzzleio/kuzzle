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
<<<<<<< HEAD
  errorsManager = require('../config/error-codes');
=======
  {
    errors: {
      InternalError: KuzzleInternalError
    }
  } = require('kuzzle-common-objects');
>>>>>>> 0fc0bd0319dd4bf9985a36737ba429f40193eb90

/**
 * @class Services
 * @param kuzzle
 */
class Services {
  constructor(kuzzle) {
    this.list = {};
    this.kuzzle = kuzzle;
  }

  /**
   * Initializes all services.
   */
  init() {
    const promises = Object.keys(this.kuzzle.config.services)
      .filter(key => key !== 'common')
      .map(service => {
        // We need to use a deferred promise here as the internalEngine (es)
        // promises do not implement `finally`.
        let opt = { service };

        return this.kuzzle.internalEngine
          .get('services', service)
          .then(response => {
            opt = _.merge(opt, response._source);

            return registerService.call(this, service, opt);
          })
          .catch(err => {
            if (err.status === 404) {
              return registerService.call(this, service, opt);
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
 * @returns {Promise.<*>}
 */
function registerService(serviceName, opts) {
  const
    services = this.kuzzle.config.services,
    timeout = opts.timeout || services.common.defaultInitTimeout,
    file = services[serviceName].backend || serviceName,
    aliases = services[serviceName].aliases || [serviceName];

  const promises = aliases.map(alias => {
    opts.service = alias;

    debug(
      '[%s] register internal service with alias %s from source %s',
      serviceName,
      alias,
      file);

    this.list[alias] = new (require(`./${file}`))(
      this.kuzzle,
      opts,
      services[serviceName]);

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
