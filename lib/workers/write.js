var
  KuzzleError = require('../api/core/errors/kuzzleError'),
  BadRequestError = require('../api/core/errors/badRequestError');

module.exports = function (kuzzle) {
  this.init = function (options) {
    var params = options.dummy ? {whitelist: []} : {whitelist: ['broker', 'writeEngine']};
    return kuzzle.services.init(params)
      .then(() => {
        kuzzle.services.list.broker.listen(kuzzle.config.queues.workerWriteTaskQueue, onListenCB.bind(kuzzle));
      });
  };
};

function onListenCB (serializedRequestObject) {
  var
    errorMessage,
    error,
    requestId = serializedRequestObject.requestId;

  if (typeof this.services.list.writeEngine[serializedRequestObject.action] !== 'function') {
    errorMessage = 'Write Worker: unknown action <' + serializedRequestObject.action + '>';
    error = new BadRequestError(errorMessage).toJSON();
    error.requestId = requestId;

    this.services.list.broker.add(this.config.queues.workerWriteResponseQueue, error);
    this.pluginsManager.trigger('log:error', errorMessage);

    return false;
  }

  this.services.list.writeEngine[serializedRequestObject.action](serializedRequestObject)
    .then(result => {
      if (!(result instanceof Object)) {
        result = { response: result };
      }
      result.requestId = requestId;
      result.status = 200;
      this.services.list.broker.add(this.config.queues.workerWriteResponseQueue, result);
    })
    .catch(err => {
      error = (err instanceof KuzzleError) ? err.toJSON() : (new BadRequestError(err)).toJSON();
      error.requestId = requestId;
      this.services.list.broker.add(this.config.queues.workerWriteResponseQueue, error);
    });
}
