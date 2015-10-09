module.exports = function SubscribeController (kuzzle) {

  this.on = function (requestObject, connection) {
    kuzzle.pluginsManager.trigger('subscription:on', requestObject);

    return kuzzle.hotelClerk.addSubscription(requestObject, connection);
  };

  this.off = function (requestObject, connection) {
    kuzzle.pluginsManager.trigger('subscription:off', requestObject);

    return kuzzle.hotelClerk.removeSubscription(requestObject, connection);
  };

  this.count = function (requestObject) {
    kuzzle.pluginsManager.trigger('subscription:count', requestObject);

    return kuzzle.hotelClerk.countSubscription(requestObject);
  };

};