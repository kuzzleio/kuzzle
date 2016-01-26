var
  q = require('q'),
  ResponseObject = require('../api/core/models/responseObject'),
  BadRequestError = require('../api/core/errors/badRequestError');

module.exports = function (kuzzle) {
  this.init = function () {
    var deferred = q.defer();

    kuzzle.services.init({blacklist: ['perf', 'notificationCache', 'mqBroker', 'statsCache']});
    kuzzle.services.list.broker.listen(kuzzle.config.queues.workerWriteTaskQueue, onListenCB.bind(kuzzle));

    deferred.resolve({});
    return deferred.promise;
  };
};

function onListenCB (serializedRequestObject) {
  var
    response,
    errorMessage;

  if (typeof this.services.list.writeEngine[serializedRequestObject.action] !== 'function') {
    errorMessage = 'Write Worker: unknown action <' + serializedRequestObject.action + '>';
    response = new ResponseObject(serializedRequestObject, new BadRequestError(errorMessage));
    this.services.list.broker.add(this.config.queues.workerWriteResponseQueue, response.toJson());

    this.pluginsManager.trigger('log:error', errorMessage);

    return false;
  }

  this.services.list.writeEngine[serializedRequestObject.action](serializedRequestObject)
    .then(result => {
      var responseObject = new ResponseObject(serializedRequestObject, result);

      // send the write engine response back to the client
      this.services.list.broker.add(this.config.queues.workerWriteResponseQueue, responseObject);

      // notify rooms about the created/updated/deleted document
      this.services.list.broker.add(this.config.queues.coreNotifierTaskQueue, responseObject);
    })
    .catch(error => {
      var responseObject = new ResponseObject(serializedRequestObject, error);
      this.services.list.broker.add(this.config.queues.workerWriteResponseQueue, responseObject);
    });
}
