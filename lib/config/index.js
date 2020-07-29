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

const
  rc = require('rc'),
  packageJson = require('../../package.json'),
  kerror = require('../kerror').wrap('core', 'configuration'),
  { isPlainObject } = require('../util/safeObject');

/**
 * Loads, interprets and checks configuration files
 * @returns {object}
 */
function loadConfig () {
  const config = unstringify(rc('kuzzle', require('../config/default.config')));

  checkLimitsConfig(config);

  config.internal = {
    hash: {
      seed: Buffer.from('^m&mOISKBvb1xpl1mRsrylaQXpjb&IJX')
    }
  };

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
 * @returns {object} correctly typed configuration
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
    'loginsPerSecond',
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

  if (!isPlainObject(cfg.limits)) {
    throw kerror.get('invalid_type', 'limits', 'object');
  }

  for (const opt of limits) {
    if (typeof cfg.limits[opt] !== 'number') {
      throw kerror.get('invalid_type', `limits.${opt}`, 'number');
    }

    if ( cfg.limits[opt] < 0
      || cfg.limits[opt] === 0 && !canBeZero.includes(opt)
    ) {
      const allowed = `>= ${canBeZero.includes(opt) ? '0' : '1'}`;
      throw kerror.get('out_of_range', `limits.${opt}`, allowed);
    }
  }

  if (cfg.limits.concurrentRequests >= cfg.limits.requestsBufferSize) {
    throw kerror.get('out_of_range', 'limits.concurrentRequests', 'lower than "limits.requestsBufferSize"');
  }

  if ( cfg.limits.requestsBufferWarningThreshold < cfg.limits.concurrentRequests
    || cfg.limits.requestsBufferWarningThreshold > cfg.limits.requestsBufferSize
  ) {
    throw kerror.get(
      'out_of_range',
      'limits.requestsBufferWarningThreshold',
      '[limits.concurrentRequests, limits.requestsBufferSize]');
  }
}

module.exports = loadConfig();
