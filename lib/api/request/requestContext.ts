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

import { JSONObject } from 'kuzzle-sdk';

import * as assert from '../../util/assertType';
import { User, Token } from '../../types';

// private properties
// \u200b is a zero width space, used to masquerade console.log output
const _token = 'token\u200b';
const _user = 'user\u200b';
const _connection = 'connection\u200b';

// Connection class properties
const _c_id = 'id\u200b';
const _c_protocol = 'protocol\u200b';
const _c_ips = 'ips\u200b';
const _c_misc = 'misc\u200b';

export type ContextMisc = {
  /**
   * HTTP url
   * @deprecated use "path" instead
   */
  url?: string;
  /**
   * HTTP path
   */
  path?: string;
  /**
   * HTTP headers
   */
  verb?: string;
  /**
   * HTTP headers
   */
  headers?: JSONObject;

  [key: string]: any
};

/**
 * Information about the connection at the origin of the request.
 */
export class Connection {
  constructor (connection: any) {
    this[_c_id] = null;
    this[_c_protocol] = null;
    this[_c_ips] = [];
    this[_c_misc] = {};

    Object.seal(this);

    if (typeof connection !== 'object' || connection === null) {
      return;
    }

    for (const prop of Object.keys(connection)) {
      if (['id', 'protocol', 'ips'].includes(prop)) {
        this[prop] = connection[prop];
      }
      else {
        this.misc[prop] = connection[prop];
      }
    }
  }

  /**
   * Unique identifier of the user connection
   */
  set id (str: string) {
    this[_c_id] = assert.assertString('connection.id', str);
  }

  get id (): string | null {
    return this[_c_id];
  }

  /**
   * Network protocol name
   */
  set protocol (str: string) {
    this[_c_protocol] = assert.assertString('connection.protocol', str);
  }

  get protocol (): string | null {
    return this[_c_protocol];
  }

  /**
   * Chain of IP addresses, starting from the client
   */
  set ips (arr: string[]) {
    this[_c_ips] = assert.assertArray('connection.ips', arr, 'string');
  }

  get ips(): string[] {
    return this[_c_ips];
  }

  /**
   * Additional informations about the connection
   */
  get misc (): ContextMisc {
    return this[_c_misc];
  }

  /**
   * Serializes the Connection object
   */
  toJSON (): JSONObject {
    return {
      id: this[_c_id],
      ips: this[_c_ips],
      protocol: this[_c_protocol],
      ...this[_c_misc]
    };
  }
}

/**
 * Kuzzle execution context for the request.
 *
 * Contains informations about identity (token, user)
 * and origin (connection, protocol).
 */
export class RequestContext {
  constructor(options: any = {}) {

    this[_token] = null;
    this[_user] = null;
    this[_connection] = new Connection(options.connection);

    Object.seal(this);

    this.token = options.token;
    this.user = options.user;

    // @deprecated - backward compatibility only
    if (options.connectionId) {
      this.connectionId = options.connectionId;
    }

    if (options.protocol) {
      this.protocol = options.protocol;
    }
  }

  /**
   * Serializes the RequestContext object
   */
  toJSON (): JSONObject {
    return {
      connection: this[_connection].toJSON(),
      token: this[_token],
      user: this[_user],
    };
  }

  /**
   * @deprecated use connection.id instead
   * Internal connection ID
   */
  get connectionId (): string | null {
    return this[_connection].id;
  }

  set connectionId (str: string) {
    this[_connection].id = assert.assertString('connectionId', str);
  }

  /**
   * @deprecated use connection.protocol instead
   */
  get protocol (): string | null {
    return this[_connection].protocol;
  }

  set protocol (str: string) {
    this[_connection].protocol = assert.assertString('protocol', str);
  }

  /**
   * Connection that initiated the request
   */
  get connection (): Connection {
    return this[_connection];
  }

  /**
   * Authentication token
   */
  get token (): Token | null {
    return this[_token];
  }

  set token (obj: Token | null) {
    this[_token] = assert.assertObject('token', obj);
  }

  /**
   * Associated user
   */
  get user (): User | null {
    return this[_user];
  }

  set user (obj: User) {
    this[_user] = assert.assertObject('user', obj);
  }
}
