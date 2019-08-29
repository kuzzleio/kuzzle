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
  _ = require('lodash'),
  Bluebird = require('bluebird'),
  errorsManager = require('../../config/error-codes/throw');

/**
 * @class StatisticsController
 * @param {Kuzzle} kuzzle
 */
class StatisticsController {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;

    // uses '{' and '}' to force all statistics frames to be stored on 1 redis node
    // (see https://redis.io/topics/cluster-spec#keys-distribution-model)
    this.cacheKeyPrefix = '{stats/}';

    this.ttl = kuzzle.config.stats.ttl;
    this.interval = kuzzle.config.stats.statsInterval * 1000;
    this.lastFrame = null;
    this.timer = null;

    this.currentStats = {
      connections: {},
      ongoingRequests: {},
      completedRequests: {},
      failedRequests: {}
    };
  }

  /**
   * Start recording a new request
   *
   * @param {Request} request
   */
  startRequest(request) {
    const protocol = request && request.context.connection.protocol;

    if (!protocol) {
      return false;
    }

    if (!this.currentStats.ongoingRequests[protocol]) {
      this.currentStats.ongoingRequests[protocol] = 1;
    } else {
      this.currentStats.ongoingRequests[protocol]++;
    }
  }

  /**
   * Mark an ongoing request as 'completed'
   *
   * @param {Request} request
   */
  completedRequest(request) {
    const protocol = request && request.context.connection.protocol;

    if (!protocol) {
      return false;
    }

    this.currentStats.ongoingRequests[protocol]--;

    if (!this.currentStats.completedRequests[protocol]) {
      this.currentStats.completedRequests[protocol] = 1;
    } else {
      this.currentStats.completedRequests[protocol]++;
    }
  }

  /**
   * Mark an ongoing request as 'completed'
   *
   * @param {Request} request
   */
  failedRequest(request) {
    const protocol = request && request.context.connection.protocol;

    if (!protocol) {
      return false;
    }

    this.currentStats.ongoingRequests[protocol]--;

    if (!this.currentStats.failedRequests[protocol]) {
      this.currentStats.failedRequests[protocol] = 1;
    } else {
      this.currentStats.failedRequests[protocol]++;
    }
  }

  /**
   * Register a newly created connection
   *
   * @param {RequestContext} requestContext
   */
  newConnection(requestContext) {
    if (!requestContext.connection.protocol) {
      return false;
    }

    if (!this.currentStats.connections[requestContext.connection.protocol]) {
      this.currentStats.connections[requestContext.connection.protocol] = 1;
    } else {
      this.currentStats.connections[requestContext.connection.protocol]++;
    }
  }

  /**
   * Removes a connection from the statistics
   *
   * @param {RequestContext} requestContext
   */
  dropConnection(requestContext) {
    if (!requestContext.connection.protocol) {
      return false;
    }

    if (this.currentStats.connections[requestContext.connection.protocol] === 1) {
      delete this.currentStats.connections[requestContext.connection.protocol];
    } else {
      this.currentStats.connections[requestContext.connection.protocol]--;
    }
  }

  /**
   * Gets stored statistics frames from a date
   *
   * @returns {Promise}
   */
  getLastStats() {
    if (!this.lastFrame) {
      return Bluebird.resolve(_.extend(this.currentStats, {timestamp: (new Date()).getTime()}));
    }

    return this.kuzzle.services.internalCache.get(this.cacheKeyPrefix + this.lastFrame)
      .then(value => Bluebird.resolve(_.extend(JSON.parse(value), {timestamp: (new Date(this.lastFrame)).getTime()})));
  }

  /**
   * Gets the lasts saved statistics frame from a date
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  getStats(request) {
    const
      response = {
        hits: [],
        total: null
      },
      currentDate = new Date().getTime();
    let
      frames,
      startTime,
      stopTime;


    if (request && request.input.args && request.input.args.startTime) {
      startTime = isNaN(request.input.args.startTime) ? new Date(request.input.args.startTime).getTime() : request.input.args.startTime;
    }

    if (request && request.input.args && request.input.args.stopTime) {
      stopTime = isNaN(request.input.args.stopTime) ? new Date(request.input.args.stopTime).getTime() : request.input.args.stopTime;
    }

    if ((startTime !== undefined && isNaN(startTime)) || (stopTime !== undefined && isNaN(stopTime))) {
      return Bluebird.reject(errorsManager.getError('internal', 'statistics', 'invalid_time_value'));
    }

    if (startTime !== undefined && startTime >= currentDate) {
      response.total = response.hits.length;
      return Bluebird.resolve(response);
    }

    if (!this.lastFrame) {
      if (!stopTime || stopTime >= currentDate) {
        response.hits.push(_.extend(this.currentStats, {timestamp: (new Date(currentDate)).getTime()}));
      }

      response.total = response.hits.length;

      return Bluebird.resolve(response);
    }

    return this.kuzzle.services.internalCache.searchKeys(this.cacheKeyPrefix + '*')
      .then(keys => {
        frames = keys;
        // Statistics keys are timestamp.
        // Ordering them guarantees stats frames to be returned in the right order
        return this.kuzzle.services.internalCache.mget(keys.sort());
      })
      .then(values => {
        values.forEach((v, idx) => {
          const
            regex = new RegExp('^' + this.cacheKeyPrefix),
            frameDate = new Date(Number(frames[idx].replace(regex, ''))),
            frameDateTime = frameDate.getTime();

          if ((!startTime || startTime <= frameDateTime) && (!stopTime || stopTime >= frameDateTime)) {
            response.hits.push(_.extend(JSON.parse(v), {timestamp: (new Date(frameDateTime)).getTime()}));
          }
        });

        response.total = response.hits.length;
        return Bluebird.resolve(response);
      });
  }

  /**
   * Gets all the saved statistics
   *
   * @returns {Promise<Object>}
   */
  getAllStats() {
    return this.getStats();
  }

  /**
   * Init statistics component
   */
  init() {
    /*
     setTimeout is a bit less aggressive than setInterval, and we don't want writing
     statistics to disrupt the execution of Kuzzle
    */
    this.timer = setTimeout(() => writeStats.call(this), this.interval);
  }
}

/**
 * @this StatisticsController
 */
function writeStats () {
  this.lastFrame = Date.now();

  this.kuzzle.services.internalCache.setex(
    this.cacheKeyPrefix + this.lastFrame,
    this.ttl,
    JSON.stringify(this.currentStats));

  this.currentStats.completedRequests = {};
  this.currentStats.failedRequests = {};

  this.timer = setTimeout(() => writeStats.call(this), this.interval);
}

module.exports = StatisticsController;
