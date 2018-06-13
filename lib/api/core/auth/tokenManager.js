/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  RequestContext = require('kuzzle-common-objects').models.RequestContext,
  SortedArray = require('sorted-array');

/*
 Maximum delay of a setTimeout call. If larger than this value,
 it's replaced by 1 (see setTimeout documentation)
 Since this behavior is harmful to this garbage collector,
 TIMEOUT_MAX is used as an upper limit to the calculated GC delay.

 Until this constant is exposed in NodeJS' API, we have to manually set it.
 */
const TIMEOUT_MAX = Math.pow(2, 31) - 1;

/**
 * Maintains a list of valid tokens used by real-time subscriptions
 * When a token expires, this module cleans up the corresponding connection's
 * subscriptions, and notify the user
 *
 * @class TokenManager
 * @param {Kuzzle} kuzzle
 */
class TokenManager {
  constructor(kuzzle) {
    /** @type Kuzzle */
    this.kuzzle = kuzzle;

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
  }

  runTimer() {
    if (this.tokens.array.length > 0) {
      const delay = Math.min(this.tokens.array[0].expiresAt - Date.now(), TIMEOUT_MAX);

      if (this.timer) {
        clearTimeout(this.timer);
      }

      this.timer = setTimeout(this.checkTokensValidity.bind(this), delay);
    }
  }

  /**
   * Link a real-time room identifier with a connection and its associated
   * token. If one or another expires, associated subscriptions are cleaned up
   *
   * @param {Token} token
   * @param {String} connectionId
   * @param {String} roomId
   */
  link(token, connectionId, roomId) {
    if (token._id !== this.kuzzle.repositories.token.anonymous()._id) {
      const
        idx = getTokenIndex(token),
        pos = this.tokens.search({idx});

      if (pos === -1) {
        this.tokens.insert({
          idx,
          connectionId,
          _id: token._id,
          expiresAt: token.expiresAt,
          userId: token.userId,
          rooms: new Set([roomId])
        });

        if (this.tokens.array[0].idx === idx) {
          this.runTimer();
        }
      }
      else {
        this.tokens.array[pos].rooms.add(roomId);
      }
    }
  }

  /**
   * Unlink a real-time identifier from its associated token
   *
   * @param  {Token} token
   * @param  {String} roomId
   */
  unlink(token, roomId) {
    if (token._id !== this.kuzzle.repositories.token.anonymous()._id) {
      const
        idx = getTokenIndex(token),
        pos = this.tokens.search({idx});

      if (pos > -1) {
        this.tokens.array[pos].rooms.delete(roomId);

        if (this.tokens.array[pos].rooms.size === 0) {
          this.tokens.remove({idx});
        }
      }
    }
  }

  /**
   * Called when a token expires before its time (e.g. following a
   * auth:logout action)
   * This method removes all maintained links and cleans up the
   * hotel clerk
   *
   * @param token
   */
  expire(token) {
    if (token._id !== this.kuzzle.repositories.token.anonymous()._id) {
      const
        idx = getTokenIndex(token),
        searchResult = this.tokens.search({idx});

      if (searchResult > -1) {
        const connectionId = this.tokens.array[searchResult].connectionId;
        this.kuzzle.hotelClerk.removeCustomerFromAllRooms(new RequestContext({connectionId}));
        this.tokens.remove({idx});
      }
    }
  }

  checkTokensValidity() {
    const now = Date.now();

    while (this.tokens.array.length > 0 && this.tokens.array[0].expiresAt < now) {
      const connectionId = this.tokens.array[0].connectionId;

      // Send a token expiration notification to the user
      if (this.kuzzle.hotelClerk.customers[connectionId]) {
        const rooms = Object.keys(this.kuzzle.hotelClerk.customers[connectionId]);
        this.kuzzle.notifier.notifyServer(rooms, connectionId, 'TokenExpired', 'Authentication Token Expired');
        this.kuzzle.hotelClerk.removeCustomerFromAllRooms(new RequestContext({connectionId}));
      }

      this.tokens.array.shift();
    }

    if (this.tokens.array.length > 0) {
      this.runTimer();
    }
  }
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
