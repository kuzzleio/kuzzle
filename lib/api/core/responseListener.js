var ResponseObject = require('./models/responseObject');

module.exports = function ResponseListener (kuzzle, responseQueue) {
  this.waitingQueries = {};

  /**
   * Asks the listener to watch for a specific response coming from workers.
   * Only worker-eligible tasks are waited for, since other tasks transmit their response directly
   * Any response received without this function called beforehand will be discarded
   *
   * @param requestObject the query object that will generate a response from Kuzzle
   * @param promise The promise waited to be resolved by the router controller
   */
  this.add = function (requestObject, promise) {
    this.waitingQueries[requestObject.requestId] = promise;
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
  kuzzle.services.list.broker.listen(responseQueue, serializedResponseObject => {
    var
      responseObject = ResponseObject.prototype.unserialize(serializedResponseObject),
      requestId = responseObject.requestId;

    if (requestId && this.waitingQueries[requestId]) {
      this.waitingQueries[requestId].resolve(responseObject);
      delete this.waitingQueries[requestId];
    }
    else {
      kuzzle.pluginsManager.trigger('log:verbose', 'Discarded response in queue ' + responseQueue + ': ' + responseObject);
    }
  });
}

