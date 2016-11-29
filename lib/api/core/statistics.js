var
  _ = require('lodash'),
  Promise = require('bluebird'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function StatisticsController (kuzzle) {
  this.kuzzle = kuzzle;
  this.cacheKeyPrefix = 'stats/';
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

  /**
   * Start recording a new request
   *
   * @param {Request} request
   */
  this.startRequest = function statisticsStartRequest (request) {
    var protocol = request && request.context.protocol;

    if (!protocol) {
      return false;
    }

    if (!this.currentStats.ongoingRequests[protocol]) {
      this.currentStats.ongoingRequests[protocol] = 1;
    } else {
      this.currentStats.ongoingRequests[protocol]++;
    }
  };

  /**
   * Mark an ongoing request as 'completed'
   *
   * @param {Request} request
   */
  this.completedRequest = function statisticsCompletedRequest (request) {
    var protocol = request && request.context.protocol;

    if (!protocol) {
      return false;
    }

    this.currentStats.ongoingRequests[protocol]--;


    if (!this.currentStats.completedRequests[protocol]) {
      this.currentStats.completedRequests[protocol] = 1;
    } else {
      this.currentStats.completedRequests[protocol]++;
    }
  };

  /**
   * Mark an ongoing request as 'completed'
   *
   * @param {Request} request
   */
  this.failedRequest = function statisticsFailedRequest (request) {
    var protocol = request && request.context.protocol;

    if (!protocol) {
      return false;
    }

    this.currentStats.ongoingRequests[protocol]--;


    if (!this.currentStats.failedRequests[protocol]) {
      this.currentStats.failedRequests[protocol] = 1;
    } else {
      this.currentStats.failedRequests[protocol]++;
    }
  };

  /**
   * Register a newly created connection
   *
   * @param {RequestContext} requestContext
   */
  this.newConnection = function statisticsNewConnection (requestContext) {
    if (!requestContext.protocol) {
      return false;
    }

    if (!this.currentStats.connections[requestContext.protocol]) {
      this.currentStats.connections[requestContext.protocol] = 1;
    } else {
      this.currentStats.connections[requestContext.protocol]++;
    }
  };

  /**
   * Removes a connection from the statistics
   *
   * @param {RequestContext} requestContext
   */
  this.dropConnection = function statisticsDropConnection (requestContext) {
    if (!requestContext.protocol) {
      return false;
    }

    if (this.currentStats.connections[requestContext.protocol] === 1) {
      delete this.currentStats.connections[requestContext.protocol];
    } else {
      this.currentStats.connections[requestContext.protocol]--;
    }
  };

  /**
   * Gets stored statistics frames from a date
   *
   * @returns {Promise}
   */
  this.getLastStats = function statisticsGetLastStats () {
    if (!this.lastFrame) {
      return Promise.resolve(_.extend(this.currentStats, {timestamp: (new Date()).getTime()}));
    }

    return this.kuzzle.services.list.internalCache.get(this.cacheKeyPrefix + this.lastFrame)
      .then(value => Promise.resolve(_.extend(JSON.parse(value), {timestamp: (new Date(this.lastFrame)).getTime()})));
  };

  /**
   * Gets the lasts saved statistics frame from a date
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getStats = function statisticsGetStats (request) {
    var
      response = {
        hits: [],
        total: null
      },
      frames,
      currentDate,
      startTime,
      stopTime;

    currentDate = new Date().getTime();

    if (request.input.args.startTime !== undefined) {
      startTime = new Date(request.input.args.startTime).getTime();
    }

    if (request.input.args.stopTime !== undefined) {
      stopTime = new Date(request.input.args.stopTime).getTime();
    }

    if ((startTime !== undefined && isNaN(startTime)) || (stopTime !== undefined && isNaN(stopTime))) {
      return Promise.reject(new BadRequestError('Invalid time value'));
    }

    if (startTime >= currentDate) {
      response.total = response.hits.length;
      return Promise.resolve(response);
    }

    if (!this.lastFrame) {
      if (!stopTime || stopTime >= currentDate) {
        response.hits.push(_.extend(this.currentStats, {timestamp: (new Date(currentDate)).getTime()}));
      }

      response.total = response.hits.length;

      return Promise.resolve(response);
    }

    return this.kuzzle.services.list.internalCache.searchKeys(this.cacheKeyPrefix + '*')
      .then(keys => {
        frames = keys;
        // Statistics keys are timestamp. Ordering them guarantees stats frames to be returned in the right order
        return this.kuzzle.services.list.internalCache.mget(keys.sort());
      })
      .then(values => {
        values.forEach((v, idx) => {
          var
            regex = new RegExp('^' + this.cacheKeyPrefix),
            frameDate = new Date(Number(frames[idx].replace(regex, ''))),
            frameDateTime = frameDate.getTime();

          if ((!startTime || startTime <= frameDateTime) && (!stopTime || stopTime >= frameDateTime)) {
            response.hits.push(_.extend(JSON.parse(v), {timestamp: (new Date(frameDateTime)).getTime()}));
          }
        });

        response.total = response.hits.length;
        return Promise.resolve(response);
      });
  };

  /**
   * Gets all the saved statistics
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getAllStats = function statisticsGetAllStats (request) {
    return this.getStats(request);
  };

  /**
   * Init statistics component
   */
  this.init = function statisticsInit() {
    /*
     setTimeout is a bit less aggressive than setInterval, and we don't want writing
     statistics to disrupt the execution of Kuzzle
    */
    this.timer = setTimeout(() => { writeStats.call(this); }, this.interval);
  };
}

/**
 * @this StatisticsController
 */
function writeStats () {
  this.lastFrame = Date.now();

  this.kuzzle.services.list.internalCache.volatileSet(this.cacheKeyPrefix + this.lastFrame, JSON.stringify(this.currentStats), this.ttl);

  this.currentStats.completedRequests = {};
  this.currentStats.failedRequests = {};

  this.timer = setTimeout(() => { writeStats.call(this); }, this.interval);
}

module.exports = StatisticsController;
