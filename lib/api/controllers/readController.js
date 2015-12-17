var
  q = require('q'),
  BadRequestError = require('../core/errors/badRequestError'),
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
    var
      type = requestObject.data.body.type || 'all',
      realtimeCollections;

    if (['all', 'stored', 'realtime'].indexOf(type) === -1) {
      return q.reject(new BadRequestError('listCollections: unrecognized type argument: "' + type + '"'));
    }

    kuzzle.pluginsManager.trigger('data:listCollections', requestObject);

    if (type === 'stored') {
      return kuzzle.services.list.readEngine.listCollections(requestObject).then(response => {
        response.data.type = type;
        return q(response);
      });
    }

    realtimeCollections = kuzzle.hotelClerk.getRealtimeCollections();

    if (type === 'realtime') {
      return q(new ResponseObject(requestObject, {type, collections: {realtime: realtimeCollections}}));
    }

    return kuzzle.services.list.readEngine.listCollections(requestObject)
      .then(response => {
        response.data.type = type;
        response.data.collections.realtime = realtimeCollections;
        return q(response);
      });
  };

  this.now = function (requestObject) {
    var deferred = q.defer();

    kuzzle.pluginsManager.trigger('data:now', requestObject);

    deferred.resolve(new ResponseObject(requestObject, {now: Date.now()}));

    return deferred.promise;
  };
};