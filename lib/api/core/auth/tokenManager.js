var
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  NotificationObject = require('../models/notificationObject');

/**
 * Authentication token white-list.
 *
 * Maintains a list of valid tokens.
 * When a token is invalidated, it cleans up the corresponding connection's subscriptions, and notify the
 * user that the token has expired
 *
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function TokenManager (kuzzle) {
  this.tokenizedConnections = {};
  this.timer = null;

  this.runTimer = () => {
    var firstExpiryDate = Math.min.apply(null, Object.keys(this.tokenizedConnections).map(key => {
      return this.tokenizedConnections[key].expiresAt;
    }));

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(this.checkTokensValidity, Date.now() - firstExpiryDate);
  };

  this.add = (token, context) => {
    if (context.connection && context.connection.id) {
      this.tokenizedConnections[token._id] = {
        expiresAt: token.expiresAt,
        connection: context.connection
      };

      this.runTimer();
    }
  };

  this.expire = (token) => {
    if (this.tokenizedConnections[token._id] !== undefined) {
      this.tokenizedConnections[token._id].expiresAt = Date.now() - 1;
    }

    this.runTimer();
  };

  this.checkTokensValidity = () => {
    var now = Date.now();

    Object.keys(this.tokenizedConnections).forEach(key => {
      var
        rooms,
        requestObject,
        connectionId;

      if (this.tokenizedConnections[key].expiresAt < now) {
        connectionId = this.tokenizedConnections[key].connection.id;
        // Send a token expiration notfication to the user
        if (kuzzle.hotelClerk.customers[connectionId]) {
          rooms = Object.keys(kuzzle.hotelClerk.customers[connectionId]);
          requestObject = new RequestObject({
            controller: 'auth',
            action: 'jwtTokenExpired',
            requestId: 'server notification'
          });

          kuzzle.notifier.notify(rooms, new NotificationObject(rooms, requestObject), connectionId);
          kuzzle.hotelClerk.removeCustomerFromAllRooms(connectionId);
        }

        delete this.tokenizedConnections[key];
      }
    });

    this.runTimer();
  };
}

module.exports = TokenManager;
