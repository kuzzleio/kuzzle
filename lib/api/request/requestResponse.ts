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

import { JSONObject } from 'kuzzle-sdk';
import * as assert from '../../util/assertType';
import { Deprecation } from '../../types';
import { KuzzleError } from '../../kerror/errors/kuzzleError';

// private properties
// \u200b is a zero width space, used to masquerade console.log output
const _request = 'request\u200b';
const _headers = 'headers\u200b';
const _userHeaders = 'userHeaders\u200b'; // List of headers to be sent in the response

// List of headers that should not be present in the body of the response
const restrictedHeaders = [
  'set-cookie',
];

export class Headers {
  public headers: JSONObject;
  private namesMap: Map<string, string>;
  private proxy: any;

  constructor () {
    this.namesMap = new Map();
    this.headers = {};
    this.proxy = new Proxy(this.headers, {
      deleteProperty: (target, name) => this.removeHeader(name as string),
      get: (target, name) => this.getHeader(name as string),
      set: (target, name, value) => this.setHeader(name as string, value),
    });

    this.setHeader('X-Kuzzle-Node', (global as any).kuzzle.id);
  }

  /**
   * Gets a header value
   *
   * @param name Header name. Could be a string (case-insensitive) or a symbol
   */
  getHeader (name: any): string | void {
    if (typeof name === 'symbol') {
      return this.headers[name as unknown as string];
    }

    assert.assertString('header name', name);

    if (! name) {
      return;
    }

    return this.headers[this.namesMap.get(name.toLowerCase())];
  }

  removeHeader (name: string): boolean {
    assert.assertString('header name', name);

    if (! name) {
      return true;
    }

    const lowerCased = name.toLowerCase();
    const storedName = this.namesMap.get(lowerCased);

    if (storedName) {
      delete this.headers[storedName];
      this.namesMap.delete(lowerCased);
    }

    return true;
  }

  setHeader (name: string, value: string): boolean {
    assert.assertString('header name', name);

    if (! name) {
      return true;
    }

    const lowerCased = name.toLowerCase();
    const _value = String(value);

    let _name = this.namesMap.get(lowerCased);

    if (! _name) {
      this.namesMap.set(lowerCased, name);
      _name = name;
    }

    // Common HTTP headers are overwritten when set, instead of being
    // concatenated
    switch (lowerCased) {
      case 'age':
      case 'authorization':
      case 'content-length':
      case 'content-type':
      case 'etag':
      case 'expires':
      case 'from':
      case 'host':
      case 'if-modified-since':
      case 'if-unmodified-since':
      case 'last-modified, location':
      case 'max-forwards':
      case 'proxy-authorization':
      case 'referer':
      case 'retry-after':
      case 'user-agent':
        this.headers[_name] = _value;
        break;
      case 'set-cookie':
        if (! this.headers[_name]) {
          this.headers[_name] = [_value];
        }
        else {
          this.headers[_name].push(_value);
        }
        break;
      default: {
        if (this.headers[_name]) {
          this.headers[_name] += ', ' + _value;
        }
        else {
          this.headers[_name] = _value;
        }
      }
    }

    return true;
  }
}

/**
 * Kuzzle normalized API response
 */
export class RequestResponse {
  /**
   * If sets to true, "result" content will not be wrapped in a Kuzzle response
   */
  public raw: boolean;

  constructor (request) {
    this.raw = false;
    this[_request] = request;
    this[_headers] = new Headers();
    this[_userHeaders] = new Set();

    Object.seal(this);
  }

  /**
   * Get the parent request deprecations
   */
  get deprecations (): Array<Deprecation> | void {
    return this[_request].deprecations;
  }

  /**
   * Set the parent request deprecations
   * @param {Object[]} deprecations
   */
  set deprecations (deprecations: Array<Deprecation> | void) {
    this[_request].deprecations = deprecations;
  }

  /**
   * Get the parent request status
   * @returns {number}
   */
  get status (): number {
    return this[_request].status;
  }

  set status (s: number) {
    this[_request].status = s;
  }

  /**
   * Request error
   */
  get error (): KuzzleError | null {
    return this[_request].error;
  }

  set error (e: KuzzleError | null) {
    this[_request].setError(e);
  }

  /**
   * Request external ID
   */
  get requestId (): string | null {
    return this[_request].id;
  }

  /**
   * API controller name
   */
  get controller (): string | null {
    return this[_request].input.controller;
  }

  /**
   * API action name
   */
  get action (): string | null {
    return this[_request].input.action;
  }

  /**
   * Collection name
   */
  get collection (): string | null {
    return this[_request].input.resource.collection;
  }

  /**
   * Index name
   */
  get index (): string | null {
    return this[_request].input.resource.index;
  }

  /**
   * Volatile object
   */
  get volatile (): JSONObject | null {
    return this[_request].input.volatile;
  }

  /**
   * Response headers
   */
  get headers (): JSONObject {
    return this[_headers].proxy;
  }

  /**
   * Request result
   */
  get result (): any {
    return this[_request].result;
  }

  set result (r: any) {
    this[_request].setResult(r);
  }

  /**
   * Node identifier
   */
  get node (): string {
    return (global as any).kuzzle.id;
  }

  /**
   * Configure the response
   *
   * @param [options]
   * @param [options.headers] - Additional protocol headers
   * @param [options.status=200] - HTTP status code
   * @param [options.format] - Response format, standard or raw
   *
   * @returns void
   */
  configure (
    options: {
      headers?: JSONObject;
      status?: number;
      format?: 'standard' | 'raw';
    } = {}
  ): void {
    if (options.headers) {
      this.setHeaders(options.headers);

      for (const key of Object.keys(options.headers)) {
        this[_userHeaders].add(key.toLowerCase());
      }
    }

    if (options.status) {
      this.status = options.status;
    }
    else if (this.status === 102) {
      this.status = 200;
    }

    switch (options.format) {
      case 'raw':
        this.raw = true;
        break;
      case 'standard':
        this.raw = false;
        break;
    }
  }

  /**
   * Gets a header value (case-insensitive)
   */
  getHeader (name: string): string | null {
    return this[_headers].getHeader(name);
  }

  /**
   * Deletes a header (case-insensitive)
   */
  removeHeader (name: string) {
    return this[_headers].removeHeader(name);
  }

  /**
   * Sets a new array. Behaves the same as Node.js' HTTP response.setHeader
   * method (@see https://nodejs.org/api/http.html#http_response_setheader_name_value)
   */
  setHeader (name: string, value: string) {
    return this[_headers].setHeader(name, value);
  }

  /**
   * Adds new multiple headers.
   */
  setHeaders (headers: JSONObject, ifNotPresent = false) {
    assert.assertObject('headers', headers);

    if (headers) {
      for (const name of Object.keys(headers)) {
        // When ifNotPresent is set to true, only set the header if no value has been defined before
        if (! ifNotPresent || this.getHeader(name) === undefined) {
          this.setHeader(name, headers[name]);
        }
      }
    }
  }

  /**
   * Serializes the response.
   */
  toJSON (): JSONObject {
    if (this.raw === true) {
      return {
        content: this.result,
        headers: this.headers,
        raw: true,
        requestId: this.requestId,
        status: this.status,
      };
    }

    const filteredHeaders = {};
    for (const name of this[_userHeaders]) {
      filteredHeaders[name] = this.getHeader(name);
    }

    /**
     * Remove headers that are not allowed to be sent to the client in the response's body
     * For example "set-cookie" headers should only be visible by the browser,
     * otherwise they may leak information about the server's cookies, since the browser will
     * not be able to restrict them to the domain of the request.
    */
    for (const header of restrictedHeaders) {
      if (filteredHeaders[header] !== undefined) {
        filteredHeaders[header] = undefined;
      }
    }

    return {
      content: {
        action: this.action,
        collection: this.collection,
        controller: this.controller,
        deprecations: this.deprecations,
        error: this.error,
        headers: filteredHeaders,
        index: this.index,
        node: this.node,
        requestId: this.requestId,
        result: this.result,
        status: this.status,
        volatile: this.volatile,
      },
      headers: this.headers,
      raw: false,
      requestId: this.requestId,
      status: this.status,
    };
  }
}
