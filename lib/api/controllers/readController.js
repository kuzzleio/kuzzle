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

  this.listCollections = function (requestObject, context) {
    var
      type = requestObject.data.body.type || 'all',
      realtimeCollections;
    var filterCollections = (response, collectionType) => {
      var rightsRequest = {
          action: 'listCollections',
          controller: 'read',
          index: requestObject.index
        },
        allowedCollections = [];

      response.data.collections[collectionType].forEach(collection => {
        rightsRequest.collection = collection;

        if (context.user.profile.isActionAllowed(rightsRequest, context) === true) {
          allowedCollections.push(collection);
        }
      });

      response.data.collections[collectionType] = allowedCollections;

      return response;
    };

    if (['all', 'stored', 'realtime'].indexOf(type) === -1) {
      return q.reject(new BadRequestError('listCollections: unrecognized type argument: "' + type + '"'));
    }

    kuzzle.pluginsManager.trigger('data:listCollections', requestObject);

    if (type === 'stored') {
      return kuzzle.services.list.readEngine.listCollections(requestObject).then(response => {
        response.data.type = type;
        return q(filterCollections(response, 'stored'));
      });
    }

    realtimeCollections = kuzzle.hotelClerk.getRealtimeCollections();

    if (type === 'realtime') {
      return q(filterCollections(new ResponseObject(requestObject, {type, collections: {realtime: realtimeCollections}}), 'realtime'));
    }

    return kuzzle.services.list.readEngine.listCollections(requestObject)
      .then(response => {
        response.data.type = type;
        response.data.collections.realtime = realtimeCollections;
        filterCollections(response, 'realtime');
        filterCollections(response, 'stored');
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