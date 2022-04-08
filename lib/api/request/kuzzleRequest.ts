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

import * as uuid from 'uuid';
import { nanoid } from 'nanoid';
import { JSONObject } from 'kuzzle-sdk';

import { RequestInput } from './requestInput';
import { RequestResponse } from './requestResponse';
import { RequestContext } from './requestContext';
import { KuzzleError, InternalError } from '../../kerror/errors';
import * as kerror from '../../kerror';
import { Deprecation, User, HttpStream } from '../../types';
import * as assert from '../../util/assertType';
import { isPlainObject } from '../../util/safeObject';
import { get } from 'lodash';

const assertionError = kerror.wrap('api', 'assert');

// private properties
// \u200b is a zero width space, used to masquerade console.log output
const _internalId = 'internalId\u200b';
const _status = 'status\u200b';
const _input = 'input\u200b';
const _error = 'error\u200b';
const _result = 'result\u200b';
const _context = 'context\u200b';
const _timestamp = 'timestamp\u200b';
const _response = 'response\u200b';
const _deprecations = 'deprecations\u200b';

/**
 * The `KuzzleRequest` class represents a request being processed by Kuzzle.
 *
 * It contains every information used internally by Kuzzle to process the request
 * like the client inputs, but also the response that will be sent back to the client.
 *
 */
export class KuzzleRequest {
  /**
   * Request external ID (specified by "requestId" or random uuid)
   */
  public id: string;

  constructor (data: any, options: any) {
    this[_internalId] = nanoid();
    this[_status] = 102;
    this[_input] = new RequestInput(data);
    this[_context] = new RequestContext(options);
    this[_error] = null;
    this[_result] = null;
    this[_response] = null;
    this[_deprecations] = undefined;

    // @deprecated - Backward compatibility with the RequestInput.headers
    // property
    this[_input].headers = this[_context].connection.misc.headers;

    this.id = data.requestId
      ? assert.assertString('requestId', data.requestId)
      : nanoid();

    this[_timestamp] = data.timestamp || Date.now();

    // handling provided options
    if (options !== undefined && options !== null) {
      if (typeof options !== 'object' || Array.isArray(options)) {
        throw new InternalError('Request options must be an object');
      }

      /*
       * Beware of the order of setXxx methods: if there is an
       * error object in the options, it's very probable that
       * the user wants its status to be the request's final
       * status.
       *
       * Likewise, we should initialize the request status last,
       * as it should override any automated status if it has
       * been specified.
       */
      if (options.result) {
        this.setResult(options.result, options);
      }

      if (options.error) {
        if (options.error instanceof Error) {
          this.setError(options.error);
        }
        else {
          const error = new KuzzleError(options.error.message, options.error.status || 500);

          for (const prop of Object.keys(options.error).filter(key => key !== 'message' && key !== 'status')) {
            error[prop] = options.error[prop];
          }

          this.setError(error);
        }
      }

      if (options.status) {
        this.status = options.status;
      }
    }

    Object.seal(this);
  }

  /**
   * Request internal ID
   */
  get internalId (): string {
    return this[_internalId];
  }

  /**
   * Deprecation warnings for the API action
   */
  get deprecations (): Deprecation[] | void {
    return this[_deprecations];
  }

  /**
   * Request timestamp (in Epoch-micro)
   */
  get timestamp (): number {
    return this[_timestamp];
  }

  /**
   * Request HTTP status
   */
  get status (): number {
    return this[_status];
  }

  set status (i: number) {
    this[_status] = assert.assertInteger('status', i);
  }

  /**
   * Request input
   */
  get input (): RequestInput {
    return this[_input];
  }

  /**
   * Request context
   */
  get context (): RequestContext {
    return this[_context];
  }

  /**
   * Request error
   */
  get error (): KuzzleError | null {
    return this[_error];
  }

  /**
   * Request result
   */
  get result (): any | null {
    return this[_result];
  }

  /**
   * Request response
   */
  get response (): RequestResponse {
    if (this[_response] === null) {
      this[_response] = new RequestResponse(this);
    }

    return this[_response];
  }

  /**
   * Adds an error to the request, and sets the request's status to the error one.
   */
  setError (error: Error) {
    if (! error || ! (error instanceof Error)) {
      throw new InternalError('Cannot set non-error object as a request\'s error');
    }

    this[_error] = error instanceof KuzzleError ? error : new InternalError(error);
    this.status = this[_error].status;
  }

  /**
   * Sets the request error to null and status to 200
   */
  clearError () {
    this[_error] = null;
    this.status = 200;
  }

  /**
   * Sets the request result and status
   *
   * @deprecated Use request.response.configure instead
   *
   * @param result Request result. Will be converted to JSON unless `raw` option is set to `true`
   * @param options Additional options
   *    - `status` (number): HTTP status code (default: 200)
   *    - `headers` (JSONObject): additional response protocol headers (default: null)
   *    - `raw` (boolean): instead of a Kuzzle response, forward the result directly (default: false)
   */
  setResult (
    result: any,
    options: {
      /**
       * HTTP status code
       */
      status?: number;
      /**
       * additional response protocol headers
       */
      headers?: JSONObject | null;
      /**
       * Returns directly the result instead of wrapping it in a Kuzzle response
       */
      raw?: boolean;
    } = {}
  ) {
    if (result instanceof Error) {
      throw new InternalError('cannot set an error as a request\'s response');
    }

    if (this.context.connection.protocol !== 'http' && result instanceof HttpStream) {
      throw kerror.get('api', 'assert', 'forbidden_stream');
    }

    this.status = options.status || 200;

    if (options.headers) {
      this.response.setHeaders(options.headers);
    }

    if (options.raw !== undefined) {
      this.response.raw = options.raw;
    }

    this[_result] = result;
  }

  /**
   * Add a deprecation for a used component, this can be action/controller/parameters...
   *
   * @param version version where the used component has been deprecated
   * @param message message displayed in the warning
   */
  addDeprecation (version: string, message: string) {
    if (global.NODE_ENV !== 'development') {
      return;
    }

    const deprecation = {
      message,
      version,
    };

    if (! this.deprecations) {
      this[_deprecations] = [deprecation];
    }
    else {
      this.deprecations.push(deprecation);
    }
  }

  /**
   * Serialize this object into a pair of POJOs that can be send
   * across the network and then used to instantiate a new Request
   * object
   */
  serialize (): { data: JSONObject; options: JSONObject } {
    const serialized = {
      data: {
        _id: this[_input].args._id,
        action: this[_input].action,
        body: this[_input].body,
        collection: this[_input].args.collection,
        controller: this[_input].controller,
        index: this[_input].args.index,
        jwt: this[_input].jwt,
        requestId: this.id,
        timestamp: this[_timestamp],
        volatile: this[_input].volatile,
      },
      // @deprecated - duplicate of options.connection.misc.headers
      headers: this[_input].headers,
      options: {
        error: this[_error],
        result: this[_result],
        status: this[_status],
      },
    };

    Object.assign(serialized.data, this[_input].args);
    Object.assign(serialized.options, this[_context].toJSON());

    return serialized;
  }

  /**
   * Return a POJO representing the request.
   *
   * This can be used to match Koncorde filter rather than the Request object
   * because it has properties defined with invisible unicode characters.
   */
  pojo () {
    return {
      context: {
        connection: this.context.connection,
        token: this.context.token,
        user: this.context.user,
      },
      deprecations: this.deprecations,
      error: this.error,
      id: this.id,
      input: {
        action: this.input.action,
        args: this.input.args,
        body: this.input.body,
        controller: this.input.controller,
        jwt: this.input.jwt,
        volatile: this.input.volatile,
      },
      internalId: this.internalId,
      response: {
        headers: this.response.headers,
        raw: this.response.raw,
      },
      result: this.result,
      status: this.status,
      timestamp: this.timestamp,
    };
  }

  /**
   * Returns the `lang` param of the request.
   *
   * It can only be 'elasticsearch' or 'koncorde'
   */
  getLangParam (): 'elasticsearch' | 'koncorde' {
    const lang = this.getString('lang', 'elasticsearch');

    if (lang !== 'elasticsearch' && lang !== 'koncorde') {
      throw kerror.get(
        'api',
        'assert',
        'invalid_argument',
        'lang',
        '"elasticsearch" or "koncorde"');
    }

    return lang;
  }

  /**
   * Gets a parameter from a request body and checks that it is a boolean.
   * Contrary to other parameter types, an unset boolean does not trigger an
   * error, instead it's considered as 'false'
   *
   * @param name parameter name
   */
  getBodyBoolean (name: string): boolean {
    const body = this.input.body;

    if (body === null) {
      return false;
    }

    return this._getBoolean(body, name, `body.${name}`);
  }

  /**
   * Gets a parameter from a request body and checks that it is a number
   *
   * @param name parameter name
   * @param def default value to return if the parameter is not set
   *
   * @throws {api.assert.body_required} If no default value provided and no
   *                                    request body set
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not a number
   */
  getBodyNumber (name: string, def: number | undefined = undefined): number {
    const body = this.input.body;

    if (body === null) {
      if (def !== undefined) {
        return def;
      }

      throw assertionError.get('body_required');
    }

    return this._getNumber(body, name, `body.${name}`, def);
  }

  /**
   * Gets a parameter from a request body and checks that it is a integer
   *
   * @param name parameter name
   * @param def default value to return if the parameter is not set
   *
   * @throws {api.assert.body_required} If no default value provided and no
   *                                    request body set
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not an integer
   */
  getBodyInteger (name: string, def: number | undefined = undefined): number {
    const body = this.input.body;

    if (body === null) {
      if (def !== undefined) {
        return def;
      }

      throw assertionError.get('body_required');
    }

    return this._getInteger(body, name, `body.${name}`, def);
  }

  /**
   * Gets a parameter from a request body and checks that it is a string
   *
   * @param name parameter name
   * @param def default value to return if the parameter is not set
   *
   * @throws {api.assert.body_required} If no default value provided and no
   *                                    request body set
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not a string
   */
  getBodyString (name: string, def: string | undefined = undefined): string {
    const body = this.input.body;

    if (body === null) {
      if (def !== undefined) {
        return def;
      }

      throw assertionError.get('body_required');
    }

    return this._getString(body, name, `body.${name}`, def);
  }

  /**
   * Gets a parameter from a request body and checks that it is an array
   *
   * @param name parameter name
   * @param def default value to return if the parameter is not set
   *
   * @throws {api.assert.body_required} If no default value provided and no
   *                                    request body set
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not an array
   */
  getBodyArray (name: string, def: [] | undefined = undefined) {
    const body = this.input.body;

    if (body === null) {
      if (def !== undefined) {
        return def;
      }

      throw assertionError.get('body_required');
    }

    return this._getArray(body, name, `body.${name}`, def);
  }

  /**
   * Gets a parameter from a request body and checks that it is an object
   *
   * @param name parameter name
   * @param def default value to return if the parameter is not set
   *
   * @throws {api.assert.body_required} If no default value provided and no
   *                                    request body set
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not an object
   */
  getBodyObject (name: string, def: JSONObject | undefined = undefined): JSONObject {
    const body = this.input.body;

    if (body === null) {
      if (def !== undefined) {
        return def;
      }

      throw assertionError.get('body_required');
    }

    return this._getObject(body, name, `body.${name}`, def);
  }

  /**
   * Gets a parameter from a request arguments and checks that it is a boolean
   * Contrary to other parameter types, an unset boolean does not trigger an
   * error, instead it's considered as 'false'
   *
   * @param name parameter name
   */
  getBoolean (name: string): boolean {
    return this._getBoolean(this.input.args, name, name);
  }

  /**
   * Gets a parameter from a request arguments and checks that it is a number
   *
   * @param name parameter name
   * @param def default value to return if the parameter is not set
   *
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not a number
   */
  getNumber (name: string, def: number | undefined = undefined): number {
    return this._getNumber(this.input.args, name, name, def);
  }

  /**
   * Gets a parameter from a request arguments and checks that it is an integer
   *
   * @param name parameter name
   * @param def default value to return if the parameter is not set
   *
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not an integer
   */
  getInteger (name: string, def: number | undefined = undefined): number {
    return this._getInteger(this.input.args, name, name, def);
  }

  /**
   * Gets a parameter from a request arguments and checks that it is a string
   *
   * @param name parameter name
   * @param def default value to return if the parameter is not set
   *
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not a string
   */
  getString (name: string, def: string | undefined = undefined) {
    return this._getString(this.input.args, name, name, def);
  }

  /**
   * Gets a parameter from a request arguments and checks that it is an array
   *
   * @param name parameter name
   * @param def default value to return if the parameter is not set
   *
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not an array
   */
  getArray (name: string, def: [] | undefined = undefined): any[] {
    return this._getArray(this.input.args, name, name, def);
  }

  /**
   * Gets a parameter from a request arguments and checks that it is an object
   *
   * @param name parameter name
   * @param def default value to return if the parameter is not set
   *
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not an object
   */
  getObject (name: string, def: JSONObject | undefined = undefined): JSONObject {
    return this._getObject(this.input.args, name, name, def);
  }

  /**
   * Returns the index specified in the request
   */
  getIndex (): string {
    const index = this.input.args.index;

    if (! index) {
      throw assertionError.get('missing_argument', 'index');
    }

    return index;
  }

  /**
   * Returns the collection specified in the request
   */
  getCollection (): string {
    const collection = this.input.args.collection;

    if (! collection) {
      throw assertionError.get('missing_argument', 'collection');
    }

    return collection;
  }

  /**
   * Returns the index and collection specified in the request
   */
  getIndexAndCollection (): { index: string; collection: string } {
    if (! this.input.args.index) {
      throw assertionError.get('missing_argument', 'index');
    }

    if (! this.input.args.collection) {
      throw assertionError.get('missing_argument', 'collection');
    }

    return {
      collection: this.input.args.collection,
      index: this.input.args.index,
    };
  }

  /**
   * Returns the provided request's body
   *
   * @param def default value to return if the body is not set
   *
   * @throws {api.assert.body_required} If the body is not set and if no default
   *                                    value is provided
   */
  getBody (def: JSONObject | undefined = undefined): JSONObject {
    if (this.input.body === null) {
      if (def !== undefined) {
        return def;
      }

      throw assertionError.get('body_required');
    }

    return this.input.body;
  }

  /**
   * Returns the `_id` specified in the request.
   *
   * @param options Additional options
   *    - `ifMissing`: method behavior if the ID is missing (default: 'error')
   *    - `generator`: function used to generate an ID (default: 'uuid.v4')
   *
   */
  getId (
    options: {
      ifMissing?: 'error' | 'generate' | 'ignore';
      generator?: () => string;
    } = { generator: uuid.v4, ifMissing: 'error' }
  ): string {
    const id = this.input.args._id;

    options.generator = options.generator || uuid.v4; // Default to uuid v4

    if (! id) {
      if (options.ifMissing === 'generate') {
        return options.generator();
      }

      if (options.ifMissing === 'ignore') {
        return null;
      }

      throw assertionError.get('missing_argument', '_id');
    }

    if (typeof id !== 'string') {
      throw assertionError.get('invalid_type', '_id', 'string');
    }

    return id;
  }

  /**
   * Returns the current user kuid
   */
  getKuid (): string | null {
    if (this.context && this.context.user && this.context.user._id) {
      return this.context.user._id;
    }

    return null;
  }

  /**
   * Returns the current user
   */
  getUser (): User | null {
    if (this.context && this.context.user) {
      return this.context.user;
    }

    return null;
  }

  /**
  * Returns the search body query according to the http method
  */
  getSearchBody (): JSONObject {
    if ( this.context.connection.protocol !== 'http'
      || this.context.connection.misc.verb !== 'GET'
    ) {
      return this.getBody({});
    }

    const searchBody = this.getString('searchBody', '{}');

    try {
      return JSON.parse(searchBody);
    }
    catch (err) {
      throw assertionError.get('invalid_argument', err.message);
    }
  }

  /**
   * Returns the search params.
   */
  getSearchParams (): {
    from: number;
    query: JSONObject;
    scrollTTL: string;
    searchBody: JSONObject;
    size: number;
    } {
    const from = this.getInteger('from', 0);
    const size = this.getInteger('size', 10);
    const scrollTTL = this.getScrollTTLParam();
    const query = this.getBodyObject('query', {});
    const searchBody = this.getSearchBody();

    return { from, query, scrollTTL, searchBody, size };
  }

  /**
   * Extract string scroll ttl param from the request or returns undefined
   */
  getScrollTTLParam (): string {
    const scrollTTLParam = this.input.args.scroll;

    if (scrollTTLParam && typeof scrollTTLParam !== 'string') {
      throw assertionError.get('invalid_type', 'scroll', 'string');
    }

    return scrollTTLParam;
  }

  /**
   * Gets the refresh value.
   */
  getRefresh (defaultValue: 'false' | 'wait_for' = 'false'): 'false' | 'wait_for' {
    if (this.input.args.refresh === undefined) {
      return defaultValue;
    }

    if ( this.input.args.refresh === false
      || this.input.args.refresh === 'false'
      || this.input.args.refresh === null
    ) {
      return 'false';
    }

    return 'wait_for';
  }

  /**
   * Returns true if the current user have `admin` profile
   */
  userIsAdmin (): boolean {
    const user = this.getUser();

    if (! user) {
      return false;
    }

    return user.profileIds.includes('admin');
  }

  /**
   * Generic object getter: boolean value
   *
   * @param obj container object
   * @param name parameter name
   * @param errorName name to use in error messages
   */
  private _getBoolean (obj: JSONObject, name: string, errorName: string): boolean {
    let value = get(obj, name);

    // In HTTP, booleans are flags: if it's in the querystring, it's set,
    // whatever its value.
    // If a user needs to unset the option, they need to remove it from the
    // querystring.
    if (this.context.connection.protocol === 'http') {
      value = value !== undefined;
      obj[name] = value;
    }
    else if (value === undefined || value === null) {
      value = false;
    }
    else if (typeof value !== 'boolean') {
      throw assertionError.get('invalid_type', errorName, 'boolean');
    }
    else {
      value = Boolean(value);
    }

    return value;
  }

  /**
   * Generic object getter: number value
   *
   * @param obj container object
   * @param name parameter name
   * @param errorName - name to use in error messages
   * @param def default value
   */
  private _getNumber (
    obj: JSONObject,
    name: string,
    errorName: string,
    def: number | undefined = undefined
  ): number {
    let value = get(obj, name, def);

    if (value === undefined) {
      throw assertionError.get('missing_argument', errorName);
    }

    value = Number.parseFloat(value);

    if (Number.isNaN(value)) {
      throw assertionError.get('invalid_type', errorName, 'number');
    }

    return value;
  }

  /**
   * Generic object getter: integer value
   *
   * @param obj container object
   * @param name parameter name
   * @param errorName name to use in error messages
   * @param def default value
   */
  private _getInteger (
    obj: JSONObject,
    name: string,
    errorName: string,
    def: number | undefined = undefined
  ): number {
    let value = get(obj, name, def);

    if (value === undefined) {
      throw assertionError.get('missing_argument', errorName);
    }

    value = Number.parseFloat(value);

    if (Number.isNaN(value) || ! Number.isSafeInteger(value)) {
      throw assertionError.get('invalid_type', errorName, 'integer');
    }

    return value;
  }

  /**
   * Generic object getter: string value
   *
   * @param obj container object
   * @param name parameter name
   * @param errorName name to use in error messages
   * @param def default value
   */
  private _getString (
    obj: JSONObject,
    name: string,
    errorName: string,
    def: string | undefined = undefined
  ): string {
    const value = get(obj, name, def);

    if (value === undefined) {
      throw assertionError.get('missing_argument', errorName);
    }

    if (typeof value !== 'string') {
      throw assertionError.get('invalid_type', errorName, 'string');
    }

    return value;
  }

  /**
   * Generic object getter: array value
   *
   * @param obj container object
   * @param name parameter name
   * @param errorName name to use in error messages
   * @param def default value
   */
  private _getArray (
    obj: JSONObject,
    name: string,
    errorName: string,
    def: [] | undefined = undefined
  ): any[] {
    const value = get(obj, name, def);

    if (value === undefined) {
      throw assertionError.get('missing_argument', errorName);
    }

    if (! Array.isArray(value)) {
      throw assertionError.get('invalid_type', errorName, 'array');
    }

    return value;
  }

  /**
   * Generic object getter: object value
   *
   * @param obj container object
   * @param name parameter name
   * @param errorName name to use in error messages
   * @param def default value
   */
  private _getObject (
    obj: JSONObject,
    name: string,
    errorName: string,
    def: JSONObject | undefined = undefined
  ): JSONObject {
    const value = get(obj, name, def);

    if (value === undefined) {
      throw assertionError.get('missing_argument', errorName);
    }

    if (! isPlainObject(value)) {
      throw assertionError.get('invalid_type', errorName, 'object');
    }

    return value;
  }
}

export class Request extends KuzzleRequest {}
