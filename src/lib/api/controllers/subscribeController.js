module.exports = function SubscribeController (kuzzle) {

  this.on = function (data, connectionId) {
    kuzzle.hotelClerk.addSubscription(connectionId, data.requestId, data.collection, data.content);
    console.log(kuzzle.hotelClerk.rooms);
  };

  this.off = function (data, connectionId) {
    kuzzle.hotelClerk.removeSubscription(connectionId, data.requestId);
    console.log(kuzzle.hotelClerk.rooms);
  };

};