var
  q = require('q'),
  ResponseObject = require('./models/responseObject');

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
   * Gets the last saved statistics frame
   *
   * @param requestObject
   * @returns {Promise} promise resolved as a ResponseObject
   */
  this.getStats = function (requestObject) {
    var deferred = q.defer();

    if (!this.lastFrame) {
      deferred.resolve(new ResponseObject(requestObject, {statistics: this.currentStats}));
    } else {
      this.kuzzle.services.list.statsCache.get(this.lastFrame)
        .then(value => deferred.resolve(new ResponseObject(requestObject, {statistics: JSON.parse(value)})))
        .catch(error => deferred.reject(new ResponseObject(requestObject, error)));
    }

    return deferred.promise;
  };

  /**
   * Gets all the saved statistics
   *
   * @param requestObject
   * @returns {Promise}
   */
  this.getAllStats = function (requestObject) {
    var
      deferred = q.defer(),
      response = {
        statistics: {}
      },
      frames;

    if (!this.lastFrame) {
      // We return at least the current statistics frame
      response.statistics[(new Date()).toISOString()] = this.currentStats;

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
        values.forEach((v, idx) => response.statistics[(new Date(Number(frames[idx]))).toISOString()] = JSON.parse(v));
        deferred.resolve(new ResponseObject(requestObject, response));
      })
      .catch(error => deferred.reject(new ResponseObject(requestObject, error)));

    return deferred.promise;
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
