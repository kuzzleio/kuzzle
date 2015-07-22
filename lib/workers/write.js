var
  q = require('q'),
  _ = require('lodash'),
  async = require('async'),
  ResponseObject = require('../api/core/models/responseObject');

module.exports = {

  kuzzle: null,
  taskQueue: 'worker-write-queue',

  init: function (kuzzle) {
    this.kuzzle = kuzzle;
    this.kuzzle.services.list.broker.listen(this.taskQueue, onListenCB.bind(this));
  }
};

function onListenCB (serializedRequestObject) {
  if (typeof this.kuzzle.services.list.writeEngine[serializedRequestObject.action] !== 'function') {
    this.kuzzle.log.error('Unknown action', serializedRequestObject.action, 'in writeEngine');
    return false;
  }

  this.kuzzle.services.list.writeEngine[serializedRequestObject.action](serializedRequestObject)
    .then(function (result) {
      var responseObject = new ResponseObject(serializedRequestObject, result);

      // when we have the response from writeEngine, add it to the broker
      this.kuzzle.services.list.broker.add(responseObject.writeResponseRoom, responseObject.toJson());

      // notify rooms for the created/updated/deleted document
      this.kuzzle.services.list.broker.add(this.kuzzle.notifier.taskQueue, responseObject);

    }.bind(this))
    .catch(function (error) {
      this.kuzzle.services.list.broker.add(serializedRequestObject.writeResponseRoom, error);
    }.bind(this));
}
