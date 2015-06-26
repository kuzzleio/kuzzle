var async = require('async');

var myHooks = function () {

  this.After('@needCleanDb', function (callback) {
    var filters = {};

    this.api.deleteByQuery(filters)
      .then(function () {
        callback();
      })
      .catch(function (error) {
        callback(new Error(error));
      });
  });

  this.After('@removeSchema', function (callback) {
    this.api.deleteCollection()
      .then(function () {
        setTimeout(callback, 1000);
      })
      .catch(function (error) {
        callback(new Error(error));
      });
  });

  this.After('@unsubscribe', function (callback) {
    async.each(this.api.subscribedRooms, function (room, callbackAsync) {
      this.api.unsubscribe.call(this.api, room.id)
        .then(function () {
          this.api.socket.off(room.roomId);
          callbackAsync();
        }.bind(this))
        .catch(function (error) {
          callbackAsync(error);
        });
    }.bind(this),
    function (error) {
      this.api.subscribedRooms = [];

      if (error) {
        callback(new Error(error));
      }

      callback();
    }.bind(this));
  });

  this.Before('@withWebsocket', function (callback) {
    // change the API
    this.api = this.apiTypes.websocket;

    callback();
  });
};

module.exports = myHooks;