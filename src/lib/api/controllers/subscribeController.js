module.exports = function SubscribeController (kuzzle) {

  this.on = function (data, socket) {
    kuzzle.hotelClerk.addSubscriberRoom(socket, data.requestId, data.collection, data.content);
    console.log(kuzzle.hotelClerk.rooms);
  };

  this.off = function (data) {
    kuzzle.hotelClerk.removeSubscriberRoom(data.requestId);
    console.log(kuzzle.hotelClerk.rooms);
  };

};