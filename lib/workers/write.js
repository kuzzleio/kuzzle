var
  q = require('q'),
  _ = require('lodash'),
  async = require('async'),
  captainsLog = require('captains-log'),
  ResponseObject = require('../api/core/models/responseObject'),
  util = require('util');

module.exports = function (kuzzleConfig) {
  var
    that = {
        kuzzleConfig: JSON.parse(kuzzleConfig),
        broker: require('../services/broker'),
        writeEngine: require('../services/elasticsearch'),
        log: captainsLog(),
        foo: undefined
    };

that.foo = 0;
  that.broker.init(that.kuzzleConfig);
  that.broker.listen(that.kuzzleConfig.queues.workerWriteTaskQueue, onListenCB.bind(that));
  that.writeEngine.init(that.kuzzleConfig);
};

function onListenCB (serializedRequestObject) {
  if (typeof this.writeEngine[serializedRequestObject.action] !== 'function') {
    this.log.error('Unknown action', serializedRequestObject.action, 'in writeEngine');
    return false;
  }

  this.writeEngine[serializedRequestObject.action](serializedRequestObject)
    .then(function (result) {
      /*
      this.foo++;
      if (!this.foo % 200) {
        console.log(this.foo, ' messages written');
      }*/
      console.log('write');

      var responseObject = new ResponseObject(serializedRequestObject, result);

      // when we have the response from writeEngine, add it to the broker
      this.broker.add(this.kuzzleConfig.queues.workerWriteResponseQueue, responseObject.toJson());

      // notify rooms for the created/updated/deleted document
      this.broker.add(this.kuzzleConfig.queues.coreNotifierTaskQueue, responseObject);

    }.bind(this))
    .catch(function (error) {
      var responseObject = new ResponseObject(serializedRequestObject, new Error(error));
      this.broker.add(this.kuzzleConfig.queues.workerWriteResponseQueue, responseObject.toJson());
    }.bind(this));
}
