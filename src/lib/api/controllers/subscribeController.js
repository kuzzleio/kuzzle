module.exports = function SubscribeController (kuzzle) {

  this.on = function (data) {
    kuzzle.hotelClerk.addSubscriberRoom(data.requestId, data.collection, data.content);
    console.log(kuzzle.hotelClerk.rooms);
  };

  this.off = function (data) {
    kuzzle.hotelClerk.removeSubscriberRoom(data.requestId);
    console.log(kuzzle.hotelClerk.rooms);
  };

};