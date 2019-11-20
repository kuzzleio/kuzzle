/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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
  { models: { RequestContext } } = require('kuzzle-common-objects'),
  SortedArray = require('sorted-array'),
  Token = require('../models/security/token');

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
    this.tokensByConnectedUser = new Map();

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
    if (token._id === this.kuzzle.repositories.token.anonymous()._id) {
      return;
    }

    const
      idx = getTokenIndex(token),
      pos = this.tokens.search({idx});

    if (pos === -1) {
      this._add(token, connectionId, [roomId]);
    }
    else {
      this.tokens.array[pos].rooms.add(roomId);
    }
  }

  /**
   * Unlink a real-time identifier from its associated token
   *
   * @param  {Token} token
   * @param  {String} roomId
   */
  unlink(token, roomId) {
    if (token._id === this.kuzzle.repositories.token.anonymous()._id) {
      return;
    }

    const
      idx = getTokenIndex(token),
      pos = this.tokens.search({idx});

    if (pos > -1) {
      this.tokens.array[pos].rooms.delete(roomId);

      if (this.tokens.array[pos].rooms.size === 0) {
        this._deleteByIndex(pos);
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
    if (token._id === this.kuzzle.repositories.token.anonymous()._id) {
      return;
    }

    const
      idx = getTokenIndex(token),
      searchResult = this.tokens.search({idx});

    if (searchResult > -1) {
      const connectionId = this.tokens.array[searchResult].connectionId;
      this.kuzzle.hotelClerk.removeCustomerFromAllRooms(new RequestContext({
        connection: {
          id: connectionId
        }
      }));
      this._deleteByIndex(searchResult);
    }
  }

  /**
   * Refresh an existing token with a new one
   *
   * @param  {Token} oldToken
   * @param  {Token} newToken
   */
  refresh(oldToken, newToken) {
    const
      oldIndex = getTokenIndex(oldToken),
      pos = this.tokens.search({idx: oldIndex});

    // If the old token has been created and then refreshed within the same
    // second, then it has the exact same characteristics than the new one.
    // This should never happen, though, especially if we add at least 1
    // real-time subscribe in the middle of the login+refresh sequence (all
    // within the same second) but, oh, well... it costs nothing to fix a
    // potentially very, very, very hard to debug random problem before it
    // occurs
    if (pos > -1 && oldToken._id !== newToken._id) {
      this._add(
        newToken,
        this.tokens.array[pos].connectionId,
        [...this.tokens.array[pos].rooms]);

      this._deleteByIndex(pos);
    }
  }

  checkTokensValidity() {
    const arr = this.tokens.array;

    if (arr.length > 0 && arr[0].expiresAt < Date.now()) {
      const connectionId = arr[0].connectionId;

      arr.shift();

      // Send a token expiration notification to the user
      const customer = this.kuzzle.hotelClerk.customers.get(connectionId);
      if (customer) {
        const rooms = Array.from(customer.keys());

        return this.kuzzle.notifier
          .notifyServer(
            rooms,
            connectionId,
            'TokenExpired',
            'Authentication Token Expired')
          .then(() => this.kuzzle.hotelClerk.removeCustomerFromAllRooms(
            new RequestContext({ connection: { id: connectionId } })))
          .then(() => this.checkTokensValidity());
      }

      return this.checkTokensValidity();
    }

    if (arr.length > 0) {
      this.runTimer();
    }
  }

  /**
   * Gets the token matching user & connection if any
   *
   * @param {string} userId
   * @param {string} connectionId
   * @returns {Token}
   */
  getConnectedUserToken(userId, connectionId) {
    const data = this.tokensByConnectedUser.get(`${userId}#${connectionId}`);

    if (data) {
      return new Token(data);
    }
  }

  /**
   * Adds token to internal collections
   *
   * @param {Token} token
   * @param {string} connectionId
   * @param {Array<string>} roomIds
   * @private
   */
  _add(token, connectionId, roomIds = []) {
    const data = Object.assign({}, token, {
      connectionId,
      idx: getTokenIndex(token),
      rooms: new Set(roomIds)
    });

    this.tokens.insert(data);
    this.tokensByConnectedUser.set(`${data.userId}#${data.connectionId}`, data);

    if (this.tokens.array[0].idx === data.idx) {
      this.runTimer();
    }
  }

  _deleteByIndex(index) {
    const data = this.tokens.array[index];

    if (!data) {
      return;
    }

    this.tokensByConnectedUser.delete(`${data.userId}#${data.connectionId}`);
    this.tokens.array.splice(index, 1);
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
