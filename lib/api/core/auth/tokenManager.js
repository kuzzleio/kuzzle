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

  this.add = (token, context) => {
    if (context.connection && context.connection.id && token._id) {
      let idx = getTokenIndex(token);

      this.tokens.insert({
        _id: token._id,
        expiresAt: token.expiresAt,
        idx,
        connection: context.connection
      });

      if (this.tokens.array[0].idx === idx) {
        this.runTimer();
      }
    }
  };

  this.expire = (token) => {
    if (token._id) {
      let
        idx = getTokenIndex(token),
        searchResult = this.tokens.search(idx);

      if (searchResult > -1) {
        let t = this.tokens.array[searchResult];

        t.expiresAt = 0;
        this.tokens.remove(idx);
        this.tokens.insert(t);

        if (this.tokens.array[0].idx === idx) {
          this.runTimer();
        }
      }
    }
  };

  this.checkTokensValidity = () => {
    let
      now = Date.now();

    while (this.tokens.array[0].expiresAt < now) {
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
