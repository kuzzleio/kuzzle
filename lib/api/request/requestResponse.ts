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

import '../../../lib/types/Global';
import * as assert from '../../util/assertType';
import { Deprecation } from '../../types';
import { KuzzleError } from '../../kerror/errors/kuzzleError';
import { KuzzleRequest } from './kuzzleRequest';

export class Headers {
  public headers: JSONObject;
  private namesMap: Map<string, string>;
  public proxy: any;

  constructor() {
    this.namesMap = new Map();
    this.headers = {};
    this.proxy = new Proxy(this.headers, {
      deleteProperty: (target, name) => this.removeHeader(name as string),
      get: (target, name) => this.getHeader(name as string),
      set: (target, name, value) => this.setHeader(name as string, value),
    });

    // eslint-disable-next-line dot-notation
    if (global['_kuzzle'] && global.kuzzle) {
      this.setHeader('X-Kuzzle-Node', global.kuzzle.id);
    }
  }

  /**
   * Gets a header value
   *
   * @param name Header name. Could be a string (case-insensitive) or a symbol
   */
  getHeader (name: any): string {
    if (typeof name === 'symbol') {
      return this.headers[name as unknown as string];
    }

    assert.assertString('header name', name);

    if (!name) {
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

    if (!_name) {
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
        if (!this.headers[_name]) {
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
  private request: KuzzleRequest;
  private _headers: Headers;

  /**
   * If sets to true, "result" content will not be wrapped in a Kuzzle response
   */
  public raw: boolean;

  constructor (request: KuzzleRequest) {
    this.raw = false;

    Reflect.defineProperty(this, 'request', {
      value: request,
    });

    this._headers = new Headers();

    Object.seal(this);
  }

  /**
   * Get the parent request deprecations
   */
  get deprecations (): Array<Deprecation> {
    return this.request.deprecations;
  }

  /**
   * Set the parent request deprecations
   * @param {Object[]} deprecations
   */
  set deprecations (deprecations: Array<Deprecation>) {
    this.request.deprecations = deprecations;
  }

  /**
   * Get the parent request status
   * @returns {number}
   */
  get status (): number {
    return this.request.status;
  }

  set status (s: number) {
    this.request.status = s;
  }

  /**
   * Request error
   */
  get error (): KuzzleError | null {
    return this.request.error;
  }

  set error (e: KuzzleError | null) {
    this.request.setError(e);
  }

  /**
   * Request external ID
   */
  get requestId (): string | null {
    return this.request.id;
  }

  /**
   * API controller name
   */
  get controller (): string | null {
    return this.request.input.controller;
  }

  /**
   * API action name
   */
  get action (): string | null {
    return this.request.input.action;
  }

  /**
   * Collection name
   */
  get collection (): string | null {
    return this.request.input.resource.collection;
  }

  /**
   * Index name
   */
  get index (): string | null {
    return this.request.input.resource.index;
  }

  /**
   * Volatile object
   */
  get volatile (): JSONObject | null {
    return this.request.input.volatile;
  }

  /**
   * Response headers
   */
  get headers (): JSONObject {
    return this._headers.proxy;
  }

  /**
   * Request result
   */
  get result (): any {
    return this.request.result;
  }

  set result (r: any) {
    this.request.setResult(r);
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
    }

    this.status = options.status || 200;

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
  getHeader (name: string): string {
    return this._headers.getHeader(name);
  }

  /**
   * Deletes a header (case-insensitive)
   */
  removeHeader (name: string) {
    return this._headers.removeHeader(name);
  }

  /**
   * Sets a new array. Behaves the same as Node.js' HTTP response.setHeader
   * method (@see https://nodejs.org/api/http.html#http_response_setheader_name_value)
   */
  setHeader (name: string, value: string) {
    return this._headers.setHeader(name, value);
  }

  /**
   * Adds new multiple headers.
   */
  setHeaders (headers: JSONObject, ifNotPresent = false) {
    assert.assertObject('headers', headers);

    if (headers) {
      for (const name of Object.keys(headers)) {
        // When ifNotPresent is set to true, only set the header if no value has been defined before
        if (!ifNotPresent || this.getHeader(name) === undefined) {
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
        headers: this._headers.headers,
        raw: true,
        requestId: this.requestId,
        status: this.status,
      };
    }

    return {
      content: {
        action: this.action,
        collection: this.collection,
        controller: this.controller,
        deprecations: this.deprecations,
        error: this.error,
        index: this.index,
        node: this.node,
        requestId: this.requestId,
        result: this.result,
        status: this.status,
        volatile: this.volatile,
      },
      headers: this._headers.headers,
      raw: false,
      requestId: this.requestId,
      status: this.status,
    };
  }
}
