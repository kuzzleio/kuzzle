var
  q = require('q'),
  captainsLog = require('captains-log'),
  KuzzleServices = require('../services'),
  ResponseObject = require('../api/core/models/responseObject'),
  util = require('util');

module.exports = function (kuzzleConfig) {
  var
    that = {
        kuzzleConfig: JSON.parse(kuzzleConfig),
        services: null,
        log: captainsLog()
    };

  that.services = new KuzzleServices(that.kuzzleConfig);
  that.services.init();
  that.services.list.broker.listen(that.kuzzleConfig.queues.workerWriteTaskQueue, onListenCB.bind(that));
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
      this.services.list.broker.add(this.kuzzleConfig.queues.workerWriteResponseQueue, responseObject.toJson());

      // notify rooms for the created/updated/deleted document
      this.services.list.broker.add(this.kuzzleConfig.queues.coreNotifierTaskQueue, responseObject);

    }.bind(this))
    .catch(function (error) {
      var responseObject = new ResponseObject(serializedRequestObject, new Error(error));
      this.services.list.broker.add(this.kuzzleConfig.queues.workerWriteResponseQueue, responseObject.toJson());
    }.bind(this));
}
