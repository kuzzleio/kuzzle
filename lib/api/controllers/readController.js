var
  q = require('q'),
  ResponseObject = require('../core/models/responseObject');

module.exports = function ReadController (kuzzle) {

  this.search = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:search', requestObject);

    return kuzzle.services.list.readEngine.search(requestObject);
  };

  this.get = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:get', requestObject);

    return kuzzle.services.list.readEngine.get(requestObject);
  };

  this.count = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:count', requestObject);

    return kuzzle.services.list.readEngine.count(requestObject);
  };

  this.listCollections = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:listCollections', requestObject);

    return kuzzle.services.list.readEngine.listCollections(requestObject);
  };

  this.now = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:now', requestObject);

    return q(new ResponseObject(requestObject, {now: Date.now()}));
  };

  this.listIndexes = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:listIndexes', requestObject);

    return kuzzle.services.list.readEngine.listIndexes(requestObject);
  };
};