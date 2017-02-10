'use strict';

const
  rc = require('rc'),
  _ = require('lodash'),
  /*
   rc mutates the provided object, we need to duplicate it to keep
   default configuration available for value checks
   */
  defaultConfig = _.cloneDeep(require('../../default.config'));

/**
 * Loads, interprets and checks configuration files
 * @return {object}
 */
function loadConfig () {
  let config = unstringify(rc('kuzzle', require('../../default.config')));

  checkLimitsConfig(config);

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
  Object.keys(cfg).forEach(k => {
    // exception - *version entries need to be kept as string
    if (/version$/i.test(k)) {
      return;
    }
    
    if (typeof cfg[k] === 'string') {
      if (cfg[k] === 'true') {
        cfg[k] = true;
      }
      else if (cfg[k] === 'false') {
        cfg[k] = false;
      }
      else if (/^[0-9]+$/.test(cfg[k])) {
        cfg[k] = parseInt(cfg[k]);
      }
      else if (/^[0-9]+\.[0-9]+$/.test(cfg[k])) {
        cfg[k] = parseFloat(cfg[k]);
      }
    }
    else if (cfg[k] instanceof Object) {
      cfg[k] = unstringify(cfg[k]);
    }
  });
  
  return cfg;
}

/**
 * Checks the "server" section of the provided configuration object.
 * Throw warnings if invalid configuration are detected and auto-correct
 * them if necessary
 *
 * @param {object} cfg
 */
function checkLimitsConfig (cfg) {
  ['concurrentRequests', 'requestsBufferSize', 'requestsBufferWarningThreshold', 'documentsWriteCount', 'documentsFetchCount'].forEach(opt => {
    if (typeof cfg.limits[opt] !== 'number' || cfg.limits[opt] <= 0) {
      // eslint-disable-next-line no-console
      console.warn(`[WARNING] Invalid server.${opt} configuration:
  Its value can only be a positive, non-null number.
  => Reverting to default setting: limits.${opt} = ${defaultConfig.limits[opt]}`);

      cfg.limits[opt] = defaultConfig.limits[opt];
    }
  });

  if (cfg.limits.concurrentRequests >= cfg.limits.requestsBufferSize) {
    // eslint-disable-next-line no-console
    console.warn(`[WARNING] Invalid limits.concurrentRequests and limits.requestsBufferSize configuration:
  The former must be strictly inferior to the latter, and preferably by a large margin.
  => Reverting to default settings: concurrentRequests = ${defaultConfig.limits.concurrentRequests}, requestsBufferSize = ${defaultConfig.limits.requestsBufferSize}`);

    cfg.limits.concurrentRequests = defaultConfig.limits.concurrentRequests;
    cfg.limits.retainedRequests = defaultConfig.limits.requestsBufferSize;
  }

  if (!(cfg.limits.requestsBufferWarningThreshold >= cfg.limits.concurrentRequests && cfg.limits.requestsBufferWarningThreshold <= cfg.limits.requestsBufferSize)) {
    let autoCorrected = Math.max(cfg.limits.concurrentRequests, Math.round(cfg.limits.requestsBufferSize * .1));

    // eslint-disable-next-line no-console
    console.warn(`[WARNING] Invalid limits.requestsBufferWarningThreshold configuration:
  Its value should be between limits.concurrentRequests and limits.requestsBufferSize.
  => Defaulting requestsBufferWarningThreshold to ${autoCorrected}`);

    cfg.limits.requestsBufferWarningThreshold = autoCorrected;
  }

  /*
   Number of documents fetched or written by a single API request
   Cannot exceed 9999 or 80% of requestsBufferSize
   */
  ['documentsWriteCount', 'documentsFetchCount'].forEach(prop => {
    if (cfg.limits[prop] > 9999 || cfg.limits[prop] > .8 * cfg.limits.requestsBufferSize) {
      let autoCorrected = Math.min(9999, Math.round(.8 * cfg.limits.requestsBufferSize));

      // eslint-disable-next-line no-console
      console.warn(`[WARNING] Invalid limits.${prop} configuration:
  Its value should not be more than 80% of limits.requestsBufferSize and cannot exceed 9999.
  => Defaulting ${prop} to ${autoCorrected}`);

      cfg.limits[prop] = autoCorrected;
    }
  });
}

module.exports = loadConfig();
