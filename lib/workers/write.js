var
  q = require('q'),
  captainsLog = require('captains-log'),
  ResponseObject = require('../api/core/models/responseObject');

module.exports = function (kuzzle) {
  kuzzle.services.list.broker.listen(kuzzle.config.queues.workerWriteTaskQueue, onListenCB.bind(kuzzle));
};

function onListenCB (serializedRequestObject) {
  if (typeof this.services.list.writeEngine[serializedRequestObject.action] !== 'function') {
    this.log.error('Unknown action', serializedRequestObject.action, 'in writeEngine');
    return false;
  }

  this.services.list.writeEngine[serializedRequestObject.action](serializedRequestObject)
    .then(function (result) {
      var responseObject = new ResponseObject(serializedRequestObject, result);

      // when we have the response from writeEngine, add it to the internal broker
      this.services.list.broker.add(this.config.queues.workerWriteResponseQueue, responseObject.toJson());

      // notify rooms for the created/updated/deleted document
      this.services.list.broker.add(this.config.queues.coreNotifierTaskQueue, responseObject);

    }.bind(this))
    .catch(function (error) {
      var responseObject = new ResponseObject(serializedRequestObject, new Error(error));
      this.services.list.broker.add(this.config.queues.workerWriteResponseQueue, responseObject.toJson());
    }.bind(this));
}
