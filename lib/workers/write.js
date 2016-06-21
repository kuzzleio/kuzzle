var
  KuzzleError = require('kuzzle-common-objects').Errors.kuzzleError,
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError;

module.exports = function (kuzzle) {
  this.init = function (options) {
    var services = (options && options.dummy)
      ? []
      : ['broker', 'writeEngine'];

    return kuzzle.services.init({whitelist: services})
      .then(() => {
        kuzzle.services.list.broker.listen(kuzzle.config.queues.workerWriteTaskQueue, onListenCB.bind(kuzzle));
      });
  };
};

/**
 * @this Kuzzle
 * @param serializedRequestObject
 * @returns {boolean}
 */
function onListenCB (serializedRequestObject) {
  var
    errorMessage,
    error,
    requestId = serializedRequestObject.requestId;

  if (typeof this.services.list.writeEngine[serializedRequestObject.action] !== 'function') {
    errorMessage = 'Write Worker: unknown action <' + serializedRequestObject.action + '>';
    error = new BadRequestError(errorMessage).toJSON();
    error.requestId = requestId;

    this.services.list.broker.send(this.config.queues.workerWriteResponseQueue, error);
    this.pluginsManager.trigger('log:error', error);

    return false;
  }

  this.services.list.writeEngine[serializedRequestObject.action](serializedRequestObject)
    .then(result => {
      if (!(result instanceof Object)) {
        result = { response: result };
      }
      result.requestId = requestId;
      result.status = 200;
      this.services.list.broker.send(this.config.queues.workerWriteResponseQueue, result);
    })
    .catch(err => {
      error = (err instanceof KuzzleError) ? err.toJSON() : (new BadRequestError(err)).toJSON();
      error.requestId = requestId;
      this.services.list.broker.send(this.config.queues.workerWriteResponseQueue, error);
    });
}
