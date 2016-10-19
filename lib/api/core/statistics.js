var
  _ = require('lodash'),
  Promise = require('bluebird'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError;

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

  this.currentStats = {
    connections: {},
    ongoingRequests: {},
    completedRequests: {},
    failedRequests: {}
  };

  /**
   * Start recording a new request
   *
   * @param requestObject
   */
  this.startRequest = function statisticsStartRequest (requestObject) {
    var protocol = requestObject && requestObject.protocol;

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
   * @param requestObject
   */
  this.completedRequest = function statisticsCompletedRequest (requestObject) {
    var protocol = requestObject && requestObject.protocol;

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
   * @param requestObject
   */
  this.failedRequest = function statisticsFailedRequest (requestObject) {
    var protocol = requestObject && requestObject.protocol;

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
   * @param connection
   */
  this.newConnection = function statisticsNewConnection (connection) {
    var protocol = connection && connection.type;

    if (!protocol) {
      return false;
    }

    if (!this.currentStats.connections[protocol]) {
      this.currentStats.connections[protocol] = 1;
    } else {
      this.currentStats.connections[protocol]++;
    }
  };

  /**
   * Removes a connection from the statistics
   *
   * @param connection
   */
  this.dropConnection = function statisticsDropConnection (connection) {
    var protocol = connection && connection.type;

    if (!protocol) {
      return false;
    }

    if (this.currentStats.connections[protocol] === 1) {
      delete this.currentStats.connections[protocol];
    } else {
      this.currentStats.connections[protocol]--;
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
      .then(value => Promise.resolve(_.extend(JSON.parse(value), { timestamp: (new Date(this.lastFrame)).getTime() })));
  };

  /**
   * Gets the lasts saved statistics frame from a date
   *
   * @param requestObject
   * @returns {Promise}
   */
  this.getStats = function statisticsGetStats (requestObject) {
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

    if (requestObject.data.body.startTime !== undefined) {
      startTime = new Date(requestObject.data.body.startTime).getTime();
    }

    if (requestObject.data.body.stopTime !== undefined) {
      stopTime = new Date(requestObject.data.body.stopTime).getTime();
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
        return response;
      });
  };

  /**
   * Gets all the saved statistics
   *
   * @param requestObject
   * @returns {Promise}
   */
  this.getAllStats = function statisticsGetAllStats (requestObject) {
    return this.getStats(requestObject);
  };

  /**
   * Init statistics component
   */
  this.init = function statisticsInit() {
    /*
     setTimeout is a bit less aggressive than setInterval, and we don't want writing
     statistics to disrupt the execution of Kuzzle
    */
    setTimeout(() => { writeStats.call(this); }, this.interval);
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

  setTimeout(() => { writeStats.call(this); }, this.interval);
}

module.exports = StatisticsController;
