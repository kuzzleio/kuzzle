module.exports = function SubscribeController (kuzzle) {

  this.on = function (requestObject, connection) {
    return kuzzle.hotelClerk.addSubscription(requestObject, connection);
  };

  this.off = function (requestObject, connection) {
    return kuzzle.hotelClerk.removeSubscription(requestObject, connection);
  };

  this.count = function (requestObject) {
    return kuzzle.hotelClerk.countSubscription(requestObject);
  };

};