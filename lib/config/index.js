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
  rc = require('rc'),
  packageJson = require('../../package.json'),
  errorCodes = require('./error-codes/'),
  { InternalError: KuzzleInternalError } = require('kuzzle-common-objects').errors;

/**
 * Loads, interprets and checks configuration files
 * @return {object}
 */
function loadConfig () {
  const config = unstringify(rc('kuzzle', require('../../default.config')));

  checkErrorCodes();
  checkLimitsConfig(config);

  config.internal = {
    hash: {
      seed: Buffer.from('^m&mOISKBvb1xpl1mRsrylaQXpjb&IJX')
    }
  };

  if (config.services.proxyBroker) {
    // old configuration style. Disable embedded entry point
    config.server.entryPoints.proxy = true;
    config.server.entryPoints.embedded = false;

    Object.assign(config.server.proxy, config.services.proxyBroker);
    delete config.services.proxyBroker;
  }

  // Injects the current Kuzzle version
  config.version = packageJson.version;

  return config;
}

/**
 * RC params can be overriden using environment variables,
 * in which case all values are passed as strings.
 *
 * When dealing with configuration, we can safely assume the expected
 * correct type
 *
 * @param {object} cfg - configuration loaded using RC
 * @return {object} correctly typed configuration
 */
function unstringify (cfg) {
  Object.keys(cfg)
    .filter(k => !/version$/i.test(k) && (typeof cfg[k] === 'string' || cfg[k] instanceof Object))
    .forEach(k => {
      if (typeof cfg[k] === 'string') {
        if (cfg[k] === 'true') {
          cfg[k] = true;
        }
        else if (cfg[k] === 'false') {
          cfg[k] = false;
        }
        else if (/^(-|\+)?([0-9]+)$/.test(cfg[k])) {
          cfg[k] = Number.parseInt(cfg[k]);
        }
        else if (/^(-|\+)?([0-9]+(\.[0-9]+)?)$/.test(cfg[k])) {
          cfg[k] = parseFloat(cfg[k]);
        }
      }
      else {
        cfg[k] = unstringify(cfg[k]);
      }
    });

  return cfg;
}

/**
 * Checks the "limits" section of the provided configuration object.
 * Throw warnings if invalid configuration are detected and auto-correct
 * them if necessary
 *
 * @param {object} cfg
 */
function checkLimitsConfig (cfg) {
  const limits = [
    'concurrentRequests',
    'documentsFetchCount',
    'documentsWriteCount',
    'requestsBufferSize',
    'requestsBufferWarningThreshold',
    'subscriptionConditionsCount',
    'subscriptionMinterms',
    'subscriptionRooms',
    'subscriptionDocumentTTL'
  ];
  const canBeZero = [
    'subscriptionMinterms',
    'subscriptionRooms',
    'subscriptionDocumentTTL'
  ];

  if (cfg.limits && (typeof cfg.limits !== 'object' || Array.isArray(cfg.limits))) {
    throw new KuzzleInternalError('Invalid config.limits configuration format: please check your Kuzzle configuration files');
  }

  for (const opt of limits) {
    if (typeof cfg.limits[opt] !== 'number' || cfg.limits[opt] < 0 || (cfg.limits[opt] === 0 && !canBeZero.includes(opt))) {
      throw new KuzzleInternalError(`Invalid configuration: value set for "${opt}" limit is outside the allowed range`);
    }
  }

  if (cfg.limits.concurrentRequests >= cfg.limits.requestsBufferSize) {
    throw new KuzzleInternalError('Invalid configuration: the concurrentRequests limit configuration must be strictly inferior to requestsBufferSize');
  }

  if (!(cfg.limits.requestsBufferWarningThreshold >= cfg.limits.concurrentRequests && cfg.limits.requestsBufferWarningThreshold <= cfg.limits.requestsBufferSize)) {
    throw new KuzzleInternalError('Invalid configuration: limits.requestsBufferWarningThreshold should be comprised between limits.concurrentRequests and limits.requestsBufferSize');
  }
}

/** Check the format of the error-codes config files
 *
 */

function checkErrorCodes() {

  for (const domain in errorCodes) {
    const name = errorCodes[domain];
    if (!name.hasOwnProperty('subdomains') || !name.hasOwnProperty('code')) {
      throw new KuzzleInternalError(`Invalid configuration: Missing mandatory field in ${domain} error-codes config file.`, name, 0);
    }
    for (const subdomain in errorCodes[domain]['subdomains']) {
      const name = errorCodes[domain]['subdomains'][subdomain];
      if (!name.hasOwnProperty('errors') || !name.hasOwnProperty('code')) {
        throw new KuzzleInternalError(`Invalid configuration: Missing mandatory field in ${domain} error-codes config file.`, name, 0);
      }
      for (const error in errorCodes[domain]['subdomains'][subdomain]['errors']) {
        const name = errorCodes[domain]['subdomains'][subdomain]['errors'][error];
        if (!name.hasOwnProperty('code') || !name.hasOwnProperty('message') || !errorCodes[domain]['subdomains'][subdomain]['errors'][error].hasOwnProperty('class')) {
          throw new KuzzleInternalError(`Invalid configuration: Missing mandatory field in ${domain} error-codes config file.`, name, 0);
        }
      }
    }
  }
}

module.exports = loadConfig();
