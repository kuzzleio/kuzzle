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

const assert = require('assert');

const rc = require('rc');
const defaultConfig = require('../config/defaultTsConfig');
const packageJson = require('../../package.json');
const kerror = require('../kerror').wrap('core', 'configuration');
const { isPlainObject } = require('../util/safeObject');
const bytes = require('../util/bytes');

/**
 * Loads, interprets and checks configuration files
 * @returns {object}
 */
function loadConfig () {
  let config;

  try {
    config = rc('kuzzle', defaultConfig.default);
  }
  catch (e) {
    throw kerror.get('cannot_parse', e.message);
  }

  config = unstringify(config);

  checkLimitsConfig(config);
  checkHttpOptions(config);
  checkWebSocketOptions(config);
  checkClusterOptions(config);

  config.internal = {
    hash: {
      seed: Buffer.from('^m&mOISKBvb1xpl1mRsrylaQXpjb&IJX')
    }
  };

  preprocessHttpOptions(config);
  preprocessProtocolsOptions(config);
  preprocessRedisOptions(config.services.internalCache);
  preprocessRedisOptions(config.services.memoryStorage);

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
        else if (cfg[k].startsWith('*json:')) {
          try {
            cfg[k] = JSON.parse(cfg[k].replace(/^\*json:/, ''));
          }
          catch (e) {
            throw kerror.get('cannot_parse', `the key "${k}" does not contain a valid stringified JSON (${cfg[k]})`);
          }
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

function checkWebSocketOptions (config) {
  const cfg = config.server.protocols.websocket;

  if (cfg === undefined) {
    return;
  }

  assert(typeof cfg.enabled === 'boolean', `[websocket] "enabled" parameter: invalid value "${cfg.enabled}" (boolean expected)`);
  assert(Number.isInteger(cfg.idleTimeout) && cfg.idleTimeout >= 0, `[websocket] "idleTimeout" parameter: invalid value "${cfg.idleTimeout}" (integer >= 1000 expected)`);
  assert(Number.isInteger(cfg.rateLimit) && cfg.rateLimit >= 0, `[websocket] "rateLimit" parameter: invalid value "${cfg.rateLimit}" (integer >= 0 expected)`);
  assert(typeof cfg.compression === 'boolean', `[websocket] "compression" parameter: invalid value "${cfg.compression}" (boolean value expected)`);
}

function checkHttpOptions (config) {
  const cfg = config.server.protocols.http;

  if (cfg === undefined) {
    return;
  }

  assert(typeof config.http.accessControlAllowOrigin === 'string' || Array.isArray(config.http.accessControlAllowOrigin), `[http] "accessControlAllowOrigin" parameter: invalid value "${config.http.accessControlAllowOrigin}" (array or string expected)`);
  assert(typeof config.http.accessControlAllowOriginUseRegExp === 'boolean', `[http] "accessControlAllowOriginUseRegExp" parameter: invalid value "${cfg.accessControlAllowOriginUseRegExp}" (boolean expected)`);
  assert(typeof cfg.enabled === 'boolean', `[http] "enabled" parameter: invalid value "${cfg.enabled}" (boolean expected)`);
  assert(typeof cfg.allowCompression === 'boolean', `[http] "allowCompression" parameter: invalid value "${cfg.allowCompression}" (boolean expected)`);
  assert(Number.isInteger(cfg.maxEncodingLayers) && cfg.maxEncodingLayers >= 1, `[http] "maxEncodingLayers" parameter: invalid value "${cfg.maxEncodingLayers}" (integer >= 1 expected)`);

  const maxFormFileSize = bytes(cfg.maxFormFileSize);
  assert(Number.isInteger(maxFormFileSize) && maxFormFileSize >= 0, `[http] "maxFormFileSize" parameter: cannot parse "${cfg.maxFormFileSize}"`);
  cfg.maxFormFileSize = maxFormFileSize;
  assert(typeof config.http.cookieAuthentication === 'boolean', `[http] "cookieAuthentication" parameter: invalid value "${config.http.cookieAuthentication }" (boolean expected)`);
}


function checkClusterOptions (config) {
  const cfg = config.cluster;

  for (const prop of ['heartbeat', 'joinTimeout', 'minimumNodes', 'activityDepth', 'syncTimeout']) {
    assert(typeof cfg[prop] === 'number' && cfg[prop] > 0, `[CONFIG] kuzzlerc.cluster.${prop}: value must be a number greater than 0`);
  }

  assert(cfg.syncTimeout < cfg.joinTimeout, '[CONFIG] kuzzlerc.cluster.syncTimeout: value must be lower than kuzzlerc.cluster.joinTimeout');

  for (const prop of ['command', 'sync']) {
    assert(typeof cfg.ports[prop] === 'number' && cfg.ports[prop] > 0, `[CONFIG] kuzzlerc.cluster.ports.${prop}: value must be a number greater than 0`);
  }

  assert(typeof cfg.ipv6 === 'boolean', '[CONFIG] kuzzlerc.cluster.ipv6: boolean expected');
  // If config is passed with env variable, ip cannot be the value null
  // but only blank string or the string "null"
  if (`${cfg.ip}`.length === 0 || cfg.ip === 'null') {
    cfg.ip = null;
  }
  assert(!cfg.ip || ['private', 'public'].includes(cfg.ip), '[CONFIG] kuzzlerc.cluster.ip: invalid value (accepted values: public, private)');

  assert(!cfg.interface || typeof cfg.interface === 'string', '[CONFIG] kuzzlerc.cluster.interface: value must be either null, or a string');
}

function preprocessHttpOptions (config) {
  const httpConfig = config.http;

  if (httpConfig === undefined) {
    return;
  }

  if (typeof httpConfig.accessControlAllowOrigin === 'string') {
    httpConfig.accessControlAllowOrigin =
      httpConfig.accessControlAllowOrigin
        .split(',')
        .map(value => value.trim());
  }

  // Stored to avoid doing includes multiple times later
  config.internal.allowAllOrigins = httpConfig.accessControlAllowOrigin.includes('*');

  // If Regular Expression is enabled for accessControlAllowOrigin header we convert every string to a RegExp
  if (httpConfig.accessControlAllowOriginUseRegExp) {
    httpConfig.accessControlAllowOrigin =
      httpConfig.accessControlAllowOrigin
        .map(pattern => new RegExp(pattern));
  }
}

function preprocessProtocolsOptions(config) {
  const protocols = config.server.protocols;

  config.internal.notifiableProtocols = [];

  for (const [protocolName, protocolConfig] of Object.entries(protocols)) {
    if (protocolConfig.enabled && protocolConfig.realtimeNotifications) {
      config.internal.notifiableProtocols.push(protocolName);
    }
  }
}

function preprocessRedisOptions (redisConfig) {
  // @deprecated Remove those lines for Kuzzle v3 then
  // remove also 'database' from .kuzzlerc.sample and default.config.js
  if (redisConfig.database) {
    redisConfig.options = { db: redisConfig.database, ...redisConfig.options };
  }
}

module.exports = { loadConfig };
