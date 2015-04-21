var
  q = require('q');

module.exports = function SubscribeController (kuzzle) {

  this.on = function (data, connectionId) {
    return kuzzle.hotelClerk.addSubscription(connectionId, data.requestId, data.collection, data.content);
  };

  this.off = function (data, connectionId) {
    return kuzzle.hotelClerk.removeSubscription(connectionId, data.requestId);
  };

};