'use strict';

var
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  SortedArray = require('sorted-array');

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
  /*
   * Tokens are sorted by their expiration date
   *
   * The token id is added to the key to handle
   * equality between different tokens sharing
   * the exact same expiration date
   */
  this.tokens = new SortedArray([], (a, b) => {
    if (a.idx === b.idx) {
      return 0;
    }

    return a.idx < b.idx ? -1 : 1;
  });

  this.timer = null;

  this.runTimer = () => {
    if (this.tokens.array.length > 0) {
      if (this.timer) {
        clearTimeout(this.timer);
      }

      this.timer = setTimeout(this.checkTokensValidity, Date.now() - this.tokens.array[0].expiresAt);
    }
  };

  /**
   * Adds a token to the repository
   *
   * @param {Object} token
   * @param {Object} userContext
   * @return {boolean}
   */
  this.add = (token, userContext) => {
    if (userContext.connection && userContext.connection.id && token._id) {
      let idx = getTokenIndex(token);

      this.tokens.insert({
        _id: token._id,
        expiresAt: token.expiresAt,
        idx,
        connection: userContext.connection
      });

      if (this.tokens.array[0].idx === idx) {
        this.runTimer();
      }

      return true;
    }

    return false;
  };

  /**
   * Force a token to expire before its expected time
   * @param token
   * @return {boolean}
   */
  this.expire = (token) => {
    if (token._id && token.expiresAt) {
      let
        idx = getTokenIndex(token),
        searchResult = this.tokens.search({idx});

      if (searchResult > -1) {
        this.tokens.remove({idx});
        return true;
      }
    }

    return false;
  };

  this.checkTokensValidity = () => {
    let
      now = Date.now();

    while (this.tokens.array.length > 0 && this.tokens.array[0].expiresAt < now) {
      let connectionId = this.tokens.array[0].connection.id;

      // Send a token expiration notification to the user
      if (kuzzle.hotelClerk.customers[connectionId]) {
        let
          rooms = Object.keys(kuzzle.hotelClerk.customers[connectionId]),
          requestObject = new RequestObject({
            controller: 'auth',
            action: 'jwtTokenExpired',
            requestId: 'server notification'
          });

        kuzzle.notifier.notify(rooms, requestObject, {}, connectionId);
        kuzzle.hotelClerk.removeCustomerFromAllRooms(connectionId);
      }

      this.tokens.array.shift();
    }

    if (this.tokens.array.length > 0) {
      this.runTimer();
    }
  };
}

/**
 * Calculate a simple sortable token index
 * @param token
 * @return {string}
 */
function getTokenIndex(token) {
  return `${token.expiresAt};${token._id}`;
}

module.exports = TokenManager;
