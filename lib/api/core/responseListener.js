var ResponseObject = require('./models/responseObject');

module.exports = function ResponseListener (kuzzle, responseQueue) {
  var
    whitelist = {
      admin: ['deleteCollection', 'putMapping', 'truncateCollection'],
      bulk: ['import'],
      write: ['create', 'createOrUpdate', 'update', 'delete', 'deleteByQuery', 'createCollection']
    };

  this.waitingQueries = {};

  /**
   * Asks the listener to watch for a specific response coming from workers.
   * Only worker-eligible tasks are waited for, since other tasks transmit their response directly
   * Any response received without this function called beforehand will be discarded
   *
   * @param requestObject the query object that will generate a response from Kuzzle
   * @param connection The user's connection information, used to forward the response to them
   */
  this.add = function (requestObject, connection) {
    if (whitelist[requestObject.controller] && whitelist[requestObject.controller].indexOf(requestObject.action) !== -1) {
      connection.startTime = new Date();
      this.waitingQueries[requestObject.requestId] = connection;
      kuzzle.emit(requestObject.controller + ':' + requestObject.protocol + ':start', requestObject);
    }
  };

  startListener.call(this, kuzzle, responseQueue);
};

/**
 * Starts a listener dedicated to workers responses.
 * Emit a <controller>:stop hook. Currently known hooks:
 *    write:stop
 *    admin:stop
 *    bulk:stop
 *
 * @param kuzzle
 * @param responseQueue name of the queue to listen to
 */
function startListener(kuzzle, responseQueue) {
  kuzzle.services.list.broker.listen(responseQueue, function (serializedResponseObject) {
    var
      responseObject = ResponseObject.prototype.unserialize(serializedResponseObject),
      logObject = {},
      requestId = responseObject.requestId;

    if (requestId && this.waitingQueries[requestId]) {
      logObject.testingParam = responseObject.data.body.testingParam;
      logObject.duration = new Date() - this.waitingQueries[requestId].startTime;

      kuzzle.emit(responseObject.controller + ':' + responseObject.protocol + ':stop', logObject);
      kuzzle.notifier.notify(requestId, responseObject.toJson(), this.waitingQueries[requestId]);
      delete this.waitingQueries[requestId];
    }
    else {
      kuzzle.pluginsManager.trigger('log:verbose', 'Discarded response in queue ' + responseQueue + ': ' + responseObject);
    }
  }.bind(this));
}

