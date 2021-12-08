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

import { User, Token } from '../../types';

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
  /**
   * Unique identifier of the user connection
   */
  public id: string = null;

  /**
   * Network protocol name
   */
  public protocol: string = null;

  /**
   * Chain of IP addresses, starting from the client
   */
  public ips: string[] = [];

  /**
   * Additional informations about the connection
   */
  public misc: ContextMisc = {};

  constructor (connection: any) {
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
   * Serializes the Connection object
   */
  toJSON (): JSONObject {
    return {
      id: this.id,
      ips: this.ips,
      protocol: this.protocol,
      ...this.misc
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
  /**
   * Connection that initiated the request
   */
  public connection: Connection;

  /**
   * Authentication token
   */
  public token: Token | null = null;

  /**
   * Associated user
   */
  public user: User | null = null;

  constructor(options: any = {}) {
    this.token = null;
    this.user = null;
    this.connection = new Connection(options.connection);

    if (options.token) {
      this.token = options.token;
    }
    if (options.user) {
      this.user = options.user;
    }

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
      connection: this.connection.toJSON(),
      token: this.token,
      user: this.user,
    };
  }

  /**
   * @deprecated use connection.id instead
   * Internal connection ID
   */
  get connectionId (): string | null {
    return this.connection.id;
  }

  set connectionId (str: string) {
    this.connection.id = str;
  }

  /**
   * @deprecated use connection.protocol instead
   */
  get protocol (): string | null {
    return this.connection.protocol;
  }

  set protocol (str: string) {
    this.connection.protocol = str;
  }
}
