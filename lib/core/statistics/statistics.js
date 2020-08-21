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

const kerror = require('../../kerror').wrap('api', 'assert');

/**
 * @class Statistics
 * @param {Kuzzle} kuzzle
 */
class Statistics {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;

    // uses '{' and '}' to force all statistics frames to be stored on 1 redis
    // node
    // (see https://redis.io/topics/cluster-spec#keys-distribution-model)
    this.cacheKeyPrefix = '{stats/}';

    this.ttl = kuzzle.config.stats.ttl;
    this.interval = kuzzle.config.stats.statsInterval * 1000;
    this.lastFrame = null;
    this.timer = null;

    this.currentStats = {
      completedRequests: new Map(),
      connections: new Map(),
      failedRequests: new Map(),
      ongoingRequests: new Map()
    };
  }

  /**
   * Start recording a new request
   *
   * @param {Request} request
   */
  startRequest (request) {
    const protocol = request && request.context.connection.protocol;

    if (!protocol) {
      return;
    }

    if (!this.currentStats.ongoingRequests.has(protocol)) {
      this.currentStats.ongoingRequests.set(protocol, 1);
    }
    else {
      this.currentStats.ongoingRequests.set(
        protocol,
        this.currentStats.ongoingRequests.get(protocol) + 1);
    }
  }

  /**
   * Mark an ongoing request as 'completed'
   *
   * @param {Request} request
   */
  completedRequest (request) {
    const protocol = request && request.context.connection.protocol;

    if (!protocol) {
      return;
    }

    this.currentStats.ongoingRequests.set(
      protocol,
      this.currentStats.ongoingRequests.get(protocol) - 1);

    if (!this.currentStats.completedRequests.has(protocol)) {
      this.currentStats.completedRequests.set(protocol, 1);
    }
    else {
      this.currentStats.completedRequests.set(
        protocol,
        this.currentStats.completedRequests.get(protocol) + 1);
    }
  }

  /**
   * Mark an ongoing request as 'completed'
   *
   * @param {Request} request
   */
  failedRequest (request) {
    const protocol = request && request.context.connection.protocol;

    if (!protocol) {
      return;
    }

    this.currentStats.ongoingRequests.set(
      protocol,
      this.currentStats.ongoingRequests.get(protocol) - 1);

    if (!this.currentStats.failedRequests.has(protocol)) {
      this.currentStats.failedRequests.set(protocol, 1);
    }
    else {
      this.currentStats.failedRequests.set(
        protocol,
        this.currentStats.failedRequests.get(protocol) + 1);
    }
  }

  /**
   * Register a newly created connection
   *
   * @param {RequestContext} requestContext
   */
  newConnection (requestContext) {
    if (!requestContext.connection.protocol) {
      return;
    }

    if (!this.currentStats.connections.has(requestContext.connection.protocol)) {
      this.currentStats.connections.set(requestContext.connection.protocol, 1);
    }
    else {
      this.currentStats.connections.set(
        requestContext.connection.protocol,
        this.currentStats.connections.get(requestContext.connection.protocol) + 1);
    }
  }

  /**
   * Removes a connection from the statistics
   *
   * @param {RequestContext} requestContext
   */
  dropConnection (requestContext) {
    if (!requestContext.connection.protocol) {
      return;
    }

    if (this.currentStats.connections.get(requestContext.connection.protocol) === 1) {
      this.currentStats.connections.delete(requestContext.connection.protocol);
    }
    else {
      this.currentStats.connections.set(
        requestContext.connection.protocol,
        this.currentStats.connections.get(requestContext.connection.protocol) - 1);
    }
  }

  /**
   * Gets stored statistics frames from a date
   *
   * @returns {Promise}
   */
  async getLastStats() {
    const frame = Object.assign(
      {timestamp: (new Date()).getTime()},
      this.currentStats);

    if (!this.lastFrame) {
      return frame;
    }

    const last = await this.kuzzle.ask(
      'core:cache:internal:get',
      this.cacheKeyPrefix + this.lastFrame);

    return Object.assign(frame, JSON.parse(last));
  }

  /**
   * Gets the last saved statistics frame from a date
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async getStats (request) {
    const response = {
      hits: [],
      total: null
    };
    const currentDate = new Date().getTime();
    let startTime;
    let stopTime;


    if (request && request.input.args && request.input.args.startTime) {
      startTime = isNaN(request.input.args.startTime)
        ? new Date(request.input.args.startTime).getTime()
        : request.input.args.startTime;
    }

    if (request && request.input.args && request.input.args.stopTime) {
      stopTime = isNaN(request.input.args.stopTime)
        ? new Date(request.input.args.stopTime).getTime()
        : request.input.args.stopTime;
    }

    if (startTime !== undefined && isNaN(startTime)) {
      throw kerror.get('invalid_argument', 'startTime', 'number');
    }

    if (stopTime !== undefined && isNaN(stopTime)) {
      throw kerror.get('invalid_argument', 'stopTime', 'number');
    }

    if (startTime !== undefined && startTime >= currentDate) {
      response.total = response.hits.length;
      return response;
    }

    const stats = {
      completedRequests: Object.fromEntries(this.currentStats.completedRequests),
      connections: Object.fromEntries(this.currentStats.connections),
      failedRequests: Object.fromEntries(this.currentStats.failedRequests),
      ongoingRequests: Object.fromEntries(this.currentStats.ongoingRequests),
    };

    if (!this.lastFrame) {
      if (!stopTime || stopTime >= currentDate) {
        response.hits.push(
          Object.assign(
            {timestamp: (new Date(currentDate)).getTime()},
            stats));
      }

      response.total = response.hits.length;

      return response;
    }

    const frames = await this.kuzzle.ask(
      'core:cache:internal:searchKeys',
      `${this.cacheKeyPrefix}*`);

    // Statistics keys are timestamp.
    // Ordering them guarantees stats frames to be returned in the right order
    const values = await this.kuzzle.ask(
      'core:cache:internal:mget',
      frames.sort());

    values.forEach((v, idx) => {
      const regex = new RegExp(`^${this.cacheKeyPrefix}`);
      const frameDate = new Date(Number(frames[idx].replace(regex, '')));
      const frameDateTime = frameDate.getTime();

      if ( (!startTime || startTime <= frameDateTime)
        && (!stopTime || stopTime >= frameDateTime)
      ) {
        response.hits.push(
          Object.assign(
            JSON.parse(v),
            {timestamp: (new Date(frameDateTime)).getTime()}));
      }
    });

    response.total = response.hits.length;

    return response;
  }

  /**
   * Gets all the saved statistics
   *
   * @returns {Promise<Object>}
   */
  getAllStats () {
    return this.getStats();
  }

  /**
   * Init statistics component
   */
  init () {
    this.timer = setInterval(() => writeStats.call(this), this.interval);
  }
}

/**
 * @this StatisticsController
 */
async function writeStats () {
  this.lastFrame = Date.now();

  await this.kuzzle.ask(
    'core:cache:internal:store',
    this.cacheKeyPrefix + this.lastFrame,
    JSON.stringify(this.currentStats),
    { ttl: this.ttl });

  this.currentStats.completedRequests = new Map();
  this.currentStats.failedRequests = new Map();
}

module.exports = Statistics;
