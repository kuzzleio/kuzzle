var
  q = require('q');

module.exports = function WorkerListener (kuzzle, responseQueue) {
  this.waitingQueries = {};

  /**
   * Asks the listener to watch for a specific response coming from workers.
   * Only worker-eligible tasks are waited for, since other tasks transmit their response directly
   * Any response received without this function called beforehand will be discarded
   *
   * @param requestObject the query object that will generate a response from Kuzzle
   * @param promise The promise waited to be resolved by the router controller
   */
  this.add = function (requestObject) {
    var deferred = q.defer();

    this.waitingQueries[requestObject.requestId] = deferred;

    return deferred.promise;
  };

  startListener.call(this, kuzzle, responseQueue);
};

/**
 * Starts a listener dedicated to workers responses.
 * Discards keys added by the worker to sync with the server from the response.
 *
 * @param kuzzle
 * @param responseQueue name of the queue to listen to
 */
function startListener(kuzzle, responseQueue) {
  kuzzle.services.list.broker.listen(responseQueue, serializedResponseObject => {
    var
      requestId = serializedResponseObject.requestId;
    
    delete serializedResponseObject.requestId;

    if (requestId && this.waitingQueries[requestId]) {
      if (!serializedResponseObject.status || serializedResponseObject.status !== 200) {
        this.waitingQueries[requestId].reject(serializedResponseObject);
      }
      else {
        delete serializedResponseObject.status;
        this.waitingQueries[requestId].resolve(serializedResponseObject);
      }

      delete this.waitingQueries[requestId];
    }
    else {
      kuzzle.pluginsManager.trigger('log:verbose', 'Discarded response in queue ' + responseQueue + ': ' + serializedResponseObject);
    }
  });
}

