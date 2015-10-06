var
  q = require('q'),
  ResponseObject = require('../api/core/models/responseObject');

module.exports = function (kuzzle) {
  this.init = function () {
    var deferred = q.defer();

    kuzzle.services.init({blacklist: ['notificationCache', 'mqBroker']});
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
    response = new ResponseObject(serializedRequestObject, new Error(errorMessage));
    this.services.list.broker.add(this.config.queues.workerWriteResponseQueue, response.toJson());

    this.pluginsManager.trigger('log:error', errorMessage);

    return false;
  }

  this.emit('worker:write:' + serializedRequestObject.protocol + ':start', serializedRequestObject);

  this.services.list.writeEngine[serializedRequestObject.action](serializedRequestObject)
    .then(function (result) {
      var responseObject = new ResponseObject(serializedRequestObject, result);

      this.emit('worker:write:' + serializedRequestObject.protocol + ':stop', responseObject);

      // send the write engine response back to the client
      this.services.list.broker.add(this.config.queues.workerWriteResponseQueue, responseObject);

      // notify rooms about the created/updated/deleted document
      this.services.list.broker.add(this.config.queues.coreNotifierTaskQueue, responseObject);
    }.bind(this))
    .catch(function (error) {
      var responseObject = new ResponseObject(serializedRequestObject, new Error(error));
      this.services.list.broker.add(this.config.queues.workerWriteResponseQueue, responseObject.toJson());
    }.bind(this));
}
