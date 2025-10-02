/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

import SortedArray from "sorted-array";

import "../../types/Global";
import { Token } from "../../model/security/token";

interface ISortedArray<T> {
  array: T[];

  search(item: any): number;

  insert(item: T): void;
}

/**
 * Extends the Token model with a set of linked connection IDs.
 */
class ManagedToken extends Token {
  /**
   * Unique string to identify the token and sort it by expiration date
   */
  idx: string;

  /**
   * Set of connection ID that use this token.
   */
  connectionIds: Set<string>;

  constructor(token: Token, connectionIds: Set<string>) {
    super(token);

    this.connectionIds = connectionIds;
  }

  /**
   * Returns an unique string that identify a token and allows to sort them by expiration date.
   */
  static indexFor(token: Token) {
    return `${token.expiresAt};${token._id}`;
  }
}

/*
 Maximum delay of a setTimeout call. If larger than this value,
 it's replaced by 1 (see setTimeout documentation)
 Since this behavior is harmful to this garbage collector,
 TIMEOUT_MAX is used as an upper limit to the calculated GC delay.

 Until this constant is exposed in NodeJS' API, we have to manually set it.
 */
const TIMEOUT_MAX = Math.pow(2, 31) - 1;

/**
 * Maintains a list of valid tokens used by connected protocols.
 *
 * When a token expires, this module cleans up the corresponding connection's
 * subscriptions if any, and notify the user
 */
export class TokenManager {
  private tokens: ISortedArray<ManagedToken>;
  private anonymousUserId: string = null;
  /**
   * Map<connectionId, ManagedToken>
   */
  private tokensByConnection = new Map<string, ManagedToken>();
  private timer: NodeJS.Timeout = null;

  private readonly logger = global.kuzzle.log.child("auth:tokenManager");

  constructor() {
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

      if (a.idx && a.idx[0] === "-") {
        return 1;
      }

      if (b.idx && b.idx[0] === "-") {
        return -1;
      }

      return a.idx < b.idx ? -1 : 1;
    });
  }

  async init() {
    const anonymous = await global.kuzzle.ask(
      "core:security:user:anonymous:get",
    );
    this.anonymousUserId = anonymous._id;

    global.kuzzle.on("connection:remove", (connection) => {
      this.removeConnection(connection.id).catch((err) =>
        this.logger.info(err),
      );
    });
  }

  runTimer() {
    if (this.tokens.array.length > 0) {
      const delay = Math.min(
        this.tokens.array[0].expiresAt - Date.now(),
        TIMEOUT_MAX,
      );

      if (this.timer) {
        clearTimeout(this.timer);
      }

      this.timer = setTimeout(this.checkTokensValidity.bind(this), delay);
    }
  }

  /**
   * Link a connection and a token.
   * If one or another expires, associated subscriptions are cleaned up
   * @param token
   * @param connectionId
   */
  link(token: Token, connectionId: string) {
    if (!token || token.userId === this.anonymousUserId) {
      return;
    }

    const idx = ManagedToken.indexFor(token);
    const currentToken = this.tokensByConnection.get(connectionId);
    if (currentToken) {
      if (currentToken._id === token._id) {
        this.logger.trace(
          `connection "${connectionId}" from user "${token.userId}" already linked to token`,
        );

        return; // Connection and Token already linked
      }
      this.removeConnectionLinkedToToken(connectionId, currentToken);
    }

    const pos = this.tokens.search({ idx });
    if (pos === -1) {
      this.add(token, new Set([connectionId]));

      this.logger.trace(
        `connection "${connectionId}" from user "${token.userId}" linked to a new token`,
      );
    } else {
      const managedToken = this.tokens.array[pos];
      managedToken.connectionIds.add(connectionId);

      this.tokensByConnection.set(connectionId, managedToken);

      this.logger.trace(
        `connection "${connectionId}" from user "${token.userId}" linked to existing token`,
      );
    }
  }

  /**
   * Unlink a connection from its associated token
   *
   * @param token
   * @param connectionId
   */
  unlink(token: Token, connectionId: string) {
    if (!token) {
      this.logger.trace(
        `tried to unlink connection "${connectionId}" with no token`,
      );
      return;
    }

    if (token.userId === this.anonymousUserId) {
      this.logger.trace(
        `tried to unlink connection "${connectionId}" from anonymous user`,
      );
      return;
    }

    const idx = ManagedToken.indexFor(token);
    const pos = this.tokens.search({ idx });

    if (pos === -1) {
      this.logger.trace(
        `tried to unlink connection "${connectionId}" with no token associated`,
      );
      return;
    }

    this.removeConnectionLinkedToToken(connectionId, this.tokens.array[pos]);

    const currentToken = this.tokensByConnection.get(connectionId);
    if (currentToken && currentToken._id === token._id) {
      this.tokensByConnection.delete(connectionId);
    }

    this.logger.trace(
      `connection "${connectionId}" from user "${token.userId}" unlinked from token`,
    );
  }

  /**
   * Remove token associated with a connection.
   */
  async removeConnection(connectionId: string) {
    const managedToken = this.tokensByConnection.get(connectionId);

    if (!managedToken) {
      this.logger.trace(
        `tried to remove connection "${connectionId}" with no token associated`,
      );
      return;
    }

    this.unlink(managedToken, connectionId);

    this.logger.trace(
      `connection "${connectionId}" from user "${managedToken.userId}" removed and unlinked from token`,
    );
  }

  /**
   * Called when a token expires before its time (e.g. following a
   * auth:logout action)
   * This method removes all maintained links and cleans up the
   * hotel clerk
   *
   * @param token
   */
  async expire(token: Token) {
    if (token.userId === this.anonymousUserId) {
      this.logger.trace(`tried to expire an anonymous token`);
      return;
    }

    const idx = ManagedToken.indexFor(token);
    const searchResult = this.tokens.search({ idx });

    if (searchResult > -1) {
      const managedToken = this.tokens.array[searchResult];

      for (const connectionId of managedToken.connectionIds) {
        this.tokensByConnection.delete(connectionId);
        await global.kuzzle.ask(
          "core:realtime:connection:remove",
          connectionId,
        );
      }

      this.deleteByIndex(searchResult);

      this.logger.trace(
        `token from user "${token.userId}" expired and removed from list`,
      );
    }
  }

  /**
   * Refresh an existing token with a new one
   *
   * @param oldToken
   * @param newToken
   */
  refresh(oldToken: Token, newToken: Token) {
    const oldIndex = ManagedToken.indexFor(oldToken);
    const pos = this.tokens.search({ idx: oldIndex });

    // If the old token has been created and then refreshed within the same
    // second, then it has the exact same characteristics than the new one.
    // This should never happen, though, especially if we add at least 1
    // real-time subscribe in the middle of the login+refresh sequence (all
    // within the same second) but, oh, well... it costs nothing to fix a
    // potentially very, very, very hard to debug random problem before it
    // occurs
    if (pos > -1 && oldToken._id !== newToken._id) {
      const connectionIds = this.tokens.array[pos].connectionIds;

      this.add(newToken, connectionIds);

      // Delete old token
      this.deleteByIndex(pos);

      this.logger.trace(`token from user ${oldToken.userId} refreshed`);
    }
  }

  async checkTokensValidity() {
    const arr = this.tokens.array;

    // API key can never expire (-1)
    if (
      arr.length > 0 &&
      arr[0].expiresAt > 0 &&
      arr[0].expiresAt < Date.now()
    ) {
      const managedToken = arr[0];

      arr.shift();

      for (const connectionId of managedToken.connectionIds) {
        await global.kuzzle.ask(
          "core:realtime:tokenExpired:notify",
          connectionId,
        );
        this.tokensByConnection.delete(connectionId);
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
   */
  getConnectedUserToken(userId: string, connectionId: string): Token | null {
    const token = this.tokensByConnection.get(connectionId);

    return token && token.userId === userId ? token : null;
  }

  /**
   * Returns the kuid associated to a connection
   */
  getKuidFromConnection(connectionId: string): string | null {
    const token = this.tokensByConnection.get(connectionId);

    if (!token) {
      return null;
    }

    return token.userId;
  }

  /**
   * Adds token to internal collections
   *
   * @param token
   * @param connectionId
   */
  private add(token: Token, connectionIds: Set<string>) {
    const orderedToken = Object.assign({}, token, {
      connectionIds: new Set(connectionIds),
      idx: ManagedToken.indexFor(token),
    });

    for (const connectionId of connectionIds) {
      this.tokensByConnection.set(connectionId, orderedToken);
    }
    this.tokens.insert(orderedToken);

    if (this.tokens.array[0].idx === orderedToken.idx) {
      this.runTimer();
    }

    this.logger.trace(
      `token from user ${token.userId} linked to connections ${Array.from(
        connectionIds,
      )}`,
    );
  }

  private removeConnectionLinkedToToken(
    connectionId: string,
    managedToken: ManagedToken,
  ) {
    managedToken.connectionIds.delete(connectionId);

    if (managedToken.connectionIds.size === 0) {
      const pos = this.tokens.search({ idx: managedToken.idx });
      this.deleteByIndex(pos);
    }
  }

  private deleteByIndex(index: number) {
    const orderedToken = this.tokens.array[index];

    if (!orderedToken) {
      return;
    }

    this.tokens.array.splice(index, 1);
  }
}
