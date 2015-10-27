module.exports = function SubscribeController (kuzzle) {

  this.on = function (requestObject) {
    kuzzle.pluginsManager.trigger('subscription:on', requestObject);

    return kuzzle.hotelClerk.addSubscription(requestObject);
  };

  this.off = function (requestObject) {
    kuzzle.pluginsManager.trigger('subscription:off', requestObject);

    return kuzzle.hotelClerk.removeSubscription(requestObject);
  };

  this.count = function (requestObject) {
    kuzzle.pluginsManager.trigger('subscription:count', requestObject);

    return kuzzle.hotelClerk.countSubscription(requestObject);
  };

};
