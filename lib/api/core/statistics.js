var
  q = require('q'),
  ResponseObject = require('./models/responseObject'),
  BadRequestError = require('./errors/badRequestError');

module.exports = function (kuzzle) {
  this.kuzzle = kuzzle;
  this.ttl = kuzzle.config.stats.ttl * 1000;
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
  this.startRequest = function (requestObject) {
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
  this.completedRequest = function (requestObject) {
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
  this.failedRequest = function (requestObject) {
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
  this.newConnection = function (connection) {
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
  this.dropConnection = function (connection) {
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
   * @param requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getLastStats = function (requestObject) {
    var
      deferred = q.defer(),
      response = {
        statistics: {}
      };

    if (!this.lastFrame) {
      response.statistics[(new Date()).toISOString()] = this.currentStats;
      deferred.resolve(new ResponseObject(requestObject, response));
    } else {
      this.kuzzle.services.list.statsCache.get(this.lastFrame)
        .then(value => {
          response.statistics[new Date(this.lastFrame).toISOString()] = JSON.parse(value);
          deferred.resolve(new ResponseObject(requestObject, response));
        })
        .catch(error => deferred.reject(new ResponseObject(requestObject, error)));
    }

    return deferred.promise;
  };

  /**
   * Gets the lasts saved statistics frame from a date
   *
   * @param requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getStats = function(requestObject) {
    var
      deferred = q.defer(),
      response = {
        statistics: {}
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
      deferred.reject(new ResponseObject(requestObject, new BadRequestError('Invalid time value')));
      return deferred.promise;
    }
    if (startTime >= currentDate) {
      deferred.resolve(new ResponseObject(requestObject, response));
      return deferred.promise;
    }
    if (!this.lastFrame) {
      if (!stopTime || stopTime >= currentDate) {
        response.statistics[currentDate] = this.currentStats;
      }
      deferred.resolve(new ResponseObject(requestObject, response));
      return deferred.promise;
    }

    this.kuzzle.services.list.statsCache.getAllKeys()
      .then(keys => {
        frames = keys;
        // Statistics keys are timestamp. Ordering them guarantees stats frames to be returned in the right order
        return this.kuzzle.services.list.statsCache.mget(keys.sort());
      })
      .then(values => {
        values.forEach((v, idx) => {
          var frameDate = new Date(Number(frames[idx]));
          var frameDateTime = frameDate.getTime();
          if ((!startTime || startTime <= frameDateTime) && (!stopTime || stopTime >= frameDateTime)) {
            response.statistics[frameDate.toISOString()] = JSON.parse(v);
          }
        });
        deferred.resolve(new ResponseObject(requestObject, response));
      })
      .catch(error => deferred.reject(new ResponseObject(requestObject, error)));

    return deferred.promise;
  };

  /**
   * Gets all the saved statistics
   *
   * @param requestObject
   * @returns {Promise}
   */
  this.getAllStats = function (requestObject) {
    return this.getStats(requestObject);
  };

  /*
   setTimeout is a bit less aggressive than setInterval, and we don't want writing
   statistics to disrupt the execution of Kuzzle
  */
  setTimeout(() => { writeStats.call(this); }, this.interval);
};

function writeStats () {
  this.lastFrame = Date.now();

  this.kuzzle.services.list.statsCache.volatileSet(this.lastFrame, JSON.stringify(this.currentStats), this.ttl);

  this.currentStats.completedRequests = {};
  this.currentStats.failedRequests = {};

  setTimeout(() => { writeStats.call(this); }, this.interval);
}
