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

import { InternalError } from '../../kerror/errors/internalError';
import * as assert from '../../util/assertType';
import { JSONObject } from 'kuzzle-sdk';

// private properties
// \u200b is a zero width space, used to masquerade console.log output
const __id = '_id\u200b';
const _index = 'index\u200b';
const _collection = 'collection\u200b';
const _jwt = 'jwt\u200b';
const _volatile = 'volatile\u200b';
const _body = 'body\u200b';
const _headers = 'headers\u200b';
const _controller = 'controller\u200b';
const _action = 'action\u200b';

// any property not listed here will be copied into
// RequestInput.args
const resourceProperties = new Set([
  'jwt',
  'volatile',
  'body',
  'controller',
  'action',
  'index',
  'collection',
  '_id'
]);

export class RequestResource {
  constructor() {
    this[__id] = null;
    this[_index] = null;
    this[_collection] = null;

    Object.seal(this);
  }

  /**
   * Document ID
   */
  get _id (): string | null {
    return this[__id];
  }

  set _id (str: string) {
    this[__id] = assert.assertString('_id', str);
  }

  /**
   * Index name
   */
  get index (): string | null {
    return this[_index];
  }

  set index (str: string) {
    this[_index] = assert.assertString('index', str);
  }

  /**
   * Collection name
   */
  get collection (): string | null {
    return this[_collection];
  }

  set collection (str: string) {
    this[_collection] = assert.assertString('collection', str);
  }
}

/**
 * API request arguments are accessible here.
 *
 * Common arguments are accessible at the root level:
 * "jwt", "volatile", "body", "controller", "action"
 *
 * Resource arguments are accessible under the "resource" property:
 * "_id", "index", "collection"
 *
 * Every other arguments are accessible under the "args" property. E.g:
 * "refresh", "onExistingUser", "foobar", etc.
 */
export class RequestInput {
  /**
   * Others arguments (e.g: "refresh").
   * @example
   * // original JSON request sent to Kuzzle
   * {
   *   controller
   *   action,
   *   _id,
   *   index,
   *   collection,
   *   jwt,
   *   refresh,     <== that
   *   foobar,      <== that
   *   volatile,
   *   body
   *  }
   */
  public args: JSONObject;

  /**
   * Common arguments that identify Kuzzle resources.
   * (e.g: "_id", "index", "collection")
   * @example
   * // original JSON request sent to Kuzzle
   * {
   *   controller
   *   action,
   *   _id,         <== that
   *   index,       <== that
   *   collection,  <== that
   *   jwt,
   *   refresh,
   *   foobar,
   *   volatile,
   *   body
   *  }
   */
  public resource: RequestResource;

  /**
   * Builds a Kuzzle normalized request input object
   *
   * The 'data' object accepts a request content using the same
   * format as the one used, for instance, for the Websocket protocol
   *
   * Any undefined option is set to null
   */
  constructor (data) {
    if (! data || typeof data !== 'object' || Array.isArray(data)) {
      throw new InternalError('Input request data must be a non-null object');
    }

    this[_jwt] = null;
    this[_volatile] = null;
    this[_body] = null;
    this[_controller] = null;
    this[_action] = null;

    this.args = {};
    this.resource = new RequestResource();

    // copy into this.args only unrecognized properties
    for (const k of Object.keys(data)) {
      if (!resourceProperties.has(k)) {
        this.args[k] = data[k];
      }
    }

    // @deprecated - RequestContext.connection.misc.headers should be used instead
    // initialize `_headers` property after the population of `this.args` attribute
    // `this.headers` can contain protocol specific headers and should be
    // set after the Request construction
    // `args.headers` can be an attribute coming from data itself.
    this[_headers] = null;

    Object.seal(this);

    this.jwt = data.jwt;
    this.volatile = data.volatile;
    this.body = data.body;
    this.controller = data.controller;
    this.action = data.action;
    this.resource.index = data.index;
    this.resource.collection = data.collection;
    this.resource._id = data._id;
  }

  /**
   * Authentication token.
   * @example
   * // original JSON request sent to Kuzzle
   * {
   *   controller
   *   action,
   *   _id,
   *   index,
   *   collection,
   *   jwt,        <== that
   *   refresh,
   *   foobar,
   *   volatile,
   *   body
   *  }
   */
  get jwt (): string | null {
    return this[_jwt];
  }

  set jwt (str: string) {
    this[_jwt] = assert.assertString('jwt', str);
  }

  /**
   * API controller name.
   * @example
   * // original JSON request sent to Kuzzle
   * {
   *   controller  <== that
   *   action,
   *   _id,
   *   index,
   *   collection,
   *   jwt,
   *   refresh,
   *   foobar,
   *   volatile,
   *   body
   *  }
   */
  get controller (): string | null {
    return this[_controller];
  }

  set controller (str: string) {
    // can only be set once
    if (!this[_controller]) {
      this[_controller] = assert.assertString('controller', str);
    }
  }

  /**
   * API action name.
   * @example
   * // original JSON request sent to Kuzzle
   * {
   *   controller
   *   action,      <== that
   *   _id,
   *   index,
   *   collection,
   *   jwt,
   *   refresh,
   *   foobar,
   *   volatile,
   *   body
   *  }
   */
  get action (): string | null {
    return this[_action];
  }

  set action (str: string) {
    // can only be set once
    if (!this[_action]) {
      this[_action] = assert.assertString('action', str);
    }
  }

  /**
   * Request body.
   * In Http it's the request body parsed.
   * @example
   * // original JSON request sent to Kuzzle
   * {
   *   controller
   *   action,
   *   _id,
   *   index,
   *   collection,
   *   jwt,
   *   refresh,
   *   foobar,
   *   volatile,
   *   body         <== that
   *  }
   */
  get body (): JSONObject | null {
    return this[_body];
  }

  set body (obj: JSONObject) {
    this[_body] = assert.assertObject('body', obj);
  }

  /**
   * Request headers (Http only).
   */
  get headers (): JSONObject | null {
    return this[_headers];
  }

  set headers (obj: JSONObject) {
    this[_headers] = assert.assertObject('headers', obj);
  }

  /**
   * Volatile object.
   * @example
   * // original JSON request sent to Kuzzle
   * {
   *   controller
   *   action,
   *   _id,
   *   index,
   *   collection,
   *   jwt,
   *   refresh,
   *   foobar,
   *   volatile,    <== that
   *   body
   *  }
   */
  get volatile (): JSONObject | null {
    return this[_volatile];
  }

  set volatile (obj: JSONObject) {
    this[_volatile] = assert.assertObject('volatile', obj);
  }
}
