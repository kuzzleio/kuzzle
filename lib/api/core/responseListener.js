module.exports = function ResponseListener (kuzzle, responseQueue) {
  this.waitingQueries = {};

  /**
   * Asks the listener to watch for a specific response.
   * Any response received without this function called beforehand will be discarded
   *
   * @param requestObject the query object that will generate a response from Kuzzle
   * @param connection The user's connection information, used to forward the response to them
   */
  this.add = function (requestObject, connection) {
    if (['write', 'admin', 'bulk'].indexOf(requestObject.controller) !== -1 && requestObject.isPersistent()) {
      this.waitingQueries[requestObject.requestId] = connection;
    }
  };

  startListener.call(this, kuzzle, responseQueue);
};

function startListener(kuzzle, responseQueue) {
  kuzzle.services.list.broker.listen(responseQueue, function (response) {
    var requestId = response.result.requestId;
    console.log('response');
    if (requestId && this.waitingQueries[requestId]) {
      //emit write:stop, admin:stop and bulk:stop event
      kuzzle.emit(response.result.controller + ':stop', response);

      kuzzle.notifier.notify(requestId, response, this.waitingQueries[requestId]);
      delete this.waitingQueries[requestId];
    }
    else {
      kuzzle.log.verbose('Discarded response in queue ', responseQueue, ': ', response);
    }
  }.bind(this));
}
