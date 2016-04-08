var
  q = require('q'),
  ResponseObject = require('../core/models/responseObject');

module.exports = function SubscribeController (kuzzle) {
  this.on = function (requestObject, context) {
    kuzzle.pluginsManager.trigger('subscription:on', requestObject);

    return kuzzle.hotelClerk.addSubscription(requestObject, context)
      .then(response => new ResponseObject(requestObject, response))
      .catch(err => q.reject(new ResponseObject(requestObject, err)));
  };

  this.join = function (requestObject, context) {
    kuzzle.pluginsManager.trigger('subscription:join', requestObject);

    return kuzzle.hotelClerk.join(requestObject, context)
      .then(response => new ResponseObject(requestObject, response))
      .catch(err => q.reject(new ResponseObject(requestObject, err)));
  };

  this.off = function (requestObject, context) {
    kuzzle.pluginsManager.trigger('subscription:off', requestObject);

    return kuzzle.hotelClerk.removeSubscription(requestObject, context)
      .then(response => new ResponseObject(requestObject, response))
      .catch(err => q.reject(new ResponseObject(requestObject, err)));
  };

  this.count = function (requestObject) {
    kuzzle.pluginsManager.trigger('subscription:count', requestObject);

    return kuzzle.hotelClerk.countSubscription(requestObject)
      .then(response => new ResponseObject(requestObject, response))
      .catch(err => q.reject(new ResponseObject(requestObject, err)));
  };

  this.list = function (requestObject, context) {
    kuzzle.pluginsManager.trigger('subscription:list', requestObject);

    return kuzzle.hotelClerk.listSubscriptions(requestObject, context)
      .then(response => new ResponseObject(requestObject, response))
      .catch(err => q.reject(new ResponseObject(requestObject, err)));
  };
};
