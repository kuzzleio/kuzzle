var async = require('async');

var myHooks = function () {
  /**
   * Clean up the database after each test case
   */
  this.After(function (callback) {
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
    async.each(Object.keys(this.api.subscribedRooms), function (room, callbackAsync) {
      this.api.unsubscribe.call(this.api, room)
        .then(function () {
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

  this.Before('@usingWebsocket', function (callback) {
    // change the API
    this.api = this.apiTypes.websocket;

    callback();
  });

  this.Before('@usingMQTT', function (callback) {
    this.api = this.apiTypes.mqtt;
    callback();
  });
};

module.exports = myHooks;