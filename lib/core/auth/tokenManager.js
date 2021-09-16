/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

const SortedArray = require('sorted-array');

const Token = require('../../model/security/token');

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
 */
class TokenManager {
  constructor () {
    this.anonymousUserId = null;

    /*
     * Tokens are sorted by their expiration date
     *
     * The token id is added to the key to handle
     * equality between different tokens sharing
     * the exact same expiration date
     *
     * We should always put infinite duration token at the end of the array
     * because the loop that checks if a token is expired is always verifiying the first element of the array.
     * Since an infinite token cannot be expired, if there is an infinite duration token at the first element
     * the loop will verify the same token over and over again because the token cannot be removed from the queue
     * and the other tokens will never be verifier.
     */
    this.tokens = new SortedArray([], (a, b) => {
      if (a.idx === b.idx) {
        return 0;
      }

      if (a.idx && a.idx[0] === '-') {
        return 1;
      }

      if (b.idx && b.idx[0] === '-') {
        return -1;
      }

      return a.idx < b.idx ? -1 : 1;
    });
    this.tokensByConnection = new Map();

    this.timer = null;
  }

  async init () {
    const anonymous = await global.kuzzle.ask('core:security:user:anonymous:get');
    this.anonymousUserId = anonymous._id;
  }

  runTimer () {
    if (this.tokens.array.length > 0) {
      const delay = Math.min(this.tokens.array[0].expiresAt - Date.now(), TIMEOUT_MAX);

      if (this.timer) {
        clearTimeout(this.timer);
      }

      this.timer = setTimeout(this.checkTokensValidity.bind(this), delay);
    }
  }

  /**
   * Link a connection and a token.
   * If one or another expires, associated subscriptions are cleaned up
   * @param {Token} token
   * @param {String} connectionId
   */
  link (token, connectionId) {
    // Embedded SDK does not use tokens
    if (! token || token._id === this.anonymousUserId) {
      return;
    }

    const idx = getTokenIndex(token);
    const currentToken = this.tokensByConnection.get(connectionId);

    if (currentToken) {
      if (currentToken._id === token._id) {
        return; // Connection and Token already linked
      }
      this._removeConnectionLinkedToToken(connectionId, currentToken);
    }
    const pos = this.tokens.search({idx});

    if (pos === -1) {
      this._add(token, [connectionId]);
    }
    else {
      const data = this.tokens.array[pos];
      data.connectionIds.add(connectionId);
      this.tokensByConnection.set(connectionId, data);
    }
  }

  /**
   * Unlink a connection from its associated token
   *
   * @param  {Token} token
   * @param  {String} connectionId
   */
  unlink (token, connectionId) {
    // Embedded SDK does not use tokens
    if (! token || token._id === this.anonymousUserId) {
      return;
    }

    const idx = getTokenIndex(token);
    const pos = this.tokens.search({ idx });

    if (pos === -1) {
      return;
    }

    this._removeConnectionLinkedToToken(connectionId, this.tokens.array[pos]);

    const currentToken = this.tokensByConnection.get(connectionId);
    if (currentToken && currentToken._id === token._id) {
      this.tokensByConnection.delete(connectionId);
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
  async expire (token) {
    if (token._id === this.anonymousUserId) {
      return;
    }

    const idx = getTokenIndex(token);
    const searchResult = this.tokens.search({idx});

    if (searchResult > -1) {
      const data = this.tokens.array[searchResult];

      for (const connectionId of data.connectionIds) {
        this.tokensByConnection.delete(connectionId);
        await global.kuzzle.ask('core:realtime:user:remove', connectionId);
      }

      this._deleteByIndex(searchResult);
    }
  }

  /**
   * Refresh an existing token with a new one
   *
   * @param  {Token} oldToken
   * @param  {Token} newToken
   */
  refresh (oldToken, newToken) {
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
      const connectionIds = this.tokens.array[pos].connectionIds;

      this._add(newToken, connectionIds);

      // Delete old token
      this._deleteByIndex(pos);
    }
  }

  async checkTokensValidity() {
    const arr = this.tokens.array;

    // API key can never expire (-1)
    if (arr.length > 0 && (arr[0].expiresAt > 0 && arr[0].expiresAt < Date.now())) {
      const connectionIds = arr[0].connectionIds;

      arr.shift();

      for (const connectionId of connectionIds) {
        await global.kuzzle.ask('core:realtime:tokenExpired:notify', connectionId);
      }
      setImmediate(() => this.checkTokensValidity());
      return;
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
    const data = this.tokensByConnection.get(connectionId);

    return data && data.userId === userId
      ? new Token({...data, connectionId})
      : null;
  }

  /**
   * Returns the token associated to a connection
   */
  getToken (connectionId) {
    return this.tokensByConnection.get(connectionId);
  }

  /**
   * Adds token to internal collections
   *
   * @param {Token} token
   * @param {string} connectionId
   * @private
   */
  _add(token, connectionIds) {
    const data = Object.assign({}, token, {
      connectionIds: new Set(connectionIds),
      idx: getTokenIndex(token)
    });

    for (const connectionId of connectionIds) {
      this.tokensByConnection.set(connectionId, data);
    }
    this.tokens.insert(data);

    if (this.tokens.array[0].idx === data.idx) {
      this.runTimer();
    }
  }

  _removeConnectionLinkedToToken(connectionId, token) {
    token.connectionIds.delete(connectionId);

    if (token.connectionIds.size === 0) {
      const pos = this.tokens.search({ idx: token.idx });
      this._deleteByIndex(pos);
    }
  }

  _deleteByIndex(index) {
    const data = this.tokens.array[index];

    if (!data) {
      return;
    }

    this.tokens.array.splice(index, 1);
  }
}

/**
 * Calculate a simple sortable token index
 * @param token
 * @returns {string}
 */
function getTokenIndex(token) {
  return `${token.expiresAt};${token._id}`;
}

module.exports = TokenManager;
