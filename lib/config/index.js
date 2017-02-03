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

  checkServerConfig(config);

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
function checkServerConfig (cfg) {
  ['maxConcurrentRequests', 'maxRetainedRequests', 'warningRetainedRequestsLimit', 'maxMultiActionsCount'].forEach(opt => {
    if (typeof cfg.server[opt] !== 'number' || cfg.server[opt] <= 0) {
      console.warn(`[WARNING] Invalid server.${opt} configuration:
  Its value can only be a non-negative, non-null number.
  => Reverting to default setting: server.${opt} = ${defaultConfig.server[opt]}`);

      cfg.server[opt] = defaultConfig.server[opt];
    }
  });

  if (cfg.server.maxConcurrentRequests >= cfg.server.maxRetainedRequests) {
    console.warn(`[WARNING] Invalid server.maxConcurrentRequests and server.maxRetainedRequests configuration:
  The former must be strictly inferior to the latter, and preferably by a large margin.
  => Reverting to default settings: maxConcurrentRequests = ${defaultConfig.server.maxConcurrentRequests}, maxRetainedRequests = ${defaultConfig.server.maxRetainedRequests}`);

    cfg.server.maxConcurrentRequests = defaultConfig.server.maxConcurrentRequests;
    cfg.server.maxRetainedRequests = defaultConfig.server.maxRetainedRequests;
  }

  if (!(cfg.server.warningRetainedRequestsLimit >= cfg.server.maxConcurrentRequests && cfg.server.warningRetainedRequestsLimit <= cfg.server.maxRetainedRequests)) {
    let autoCorrected = Math.max(cfg.server.maxConcurrentRequests, Math.round(cfg.server.maxRetainedRequests * .1));

    console.warn(`[WARNING] Invalid server.warningRetainedRequestsLimit configuration:
  Its value should be between server.maxConcurrentRequests and server.maxRetainedRequests.
  => Defaulting warningRetainedRequestsLimit to ${autoCorrected}`);

    cfg.server.warningRetainedRequestsLimit = autoCorrected;
  }

  /*
   Multi-actions count shouldn't be more than 80% of the maximum retained requests count,
   to keep reasonable chances to pass the overload check
   */
  if (cfg.server.maxMultiActionsCount > cfg.server.maxRetainedRequests * .8) {
    let autoCorrected = Math.round(cfg.server.maxRetainedRequests * .8);

    console.warn(`[WARNING] Invalid server.maxMultiActionsCount configuration:
  Its value should not be more than 80% of server.maxRetainedRequests, to make
  sure multi-actions request can pass the overload-protection check.
  => Defaulting maxMultiActionsCount to ${autoCorrected}`);

    cfg.server.maxMultiActionsCount = autoCorrected;
  }
}

module.exports = loadConfig();
