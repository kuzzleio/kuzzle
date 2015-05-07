var
  q = require('q');

module.exports = function SubscribeController (kuzzle) {

  this.on = function (data, connection) {
    return kuzzle.hotelClerk.addSubscription(connection, data.requestId, data.collection, data.content);
  };

  this.off = function (data, connection) {
    return kuzzle.hotelClerk.removeSubscription(connection, data.requestId);
  };

};