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

import { InternalError } from '../../kerror/errors/internalError';

// any property not listed here will be copied into
// RequestInput.args
const resourceProperties = new Set([
  'jwt',
  'volatile',
  'body',
  'controller',
  'action',
]);

/**
 * @deprecated
 */
export class RequestResource {
  private args: JSONObject;

  constructor (args: JSONObject) {
    this.args = args;
  }

  /**
   * Document ID
   * @deprecated
   */
  get _id (): string | null {
    return this.args._id;
  }

  set _id (str: string) {
    this.args._id = str;
  }

  /**
   * Index name
   * @deprecated
   */
  get index (): string | null {
    return this.args.index;
  }

  set index (str: string) {
    this.args.index = str;
  }

  /**
   * Collection name
   * @deprecated
   */
  get collection (): string | null {
    return this.args.collection;
  }

  set collection (str: string) {
    this.args.collection = str;
  }
}

/**
 * API request arguments are accessible here.
 *
 * Common arguments are accessible at the root level:
 * "jwt", "volatile", "body", "controller", "action"
 *
 * Every other arguments are accessible under the "args" property. E.g:
 * "_id", "index", "collection", "refresh", "onExistingUser", "foobar", etc.
 */
export class RequestInput {
  /**
   * Request arguments (e.g: "refresh").
   * @example
   * // original JSON request sent to Kuzzle
   * {
   *   controller
   *   action,
   *   _id,         <== that
   *   index,       <== that
   *   collection,  <== that
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
   * @deprecated Use`request.getId()|getIndex()|getCollection()>` instead
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
  public jwt: string | null = null;

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
  public controller: string | null = null;

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
  public action: string | null = null;

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
  public body: JSONObject | null = {};

  /**
   * Request headers (Http only).
   */
  public headers: JSONObject | null = null;

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
  public volatile: JSONObject | null = null;

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

    this.jwt = null;
    this.volatile = null;
    this.body = null;
    this.controller = null;
    this.action = null;

    // default value to null for former "resources" to avoid breaking
    this.args = {};
    this.resource = new RequestResource(this.args);

    // copy into this.args only unrecognized properties
    for (const k of Object.keys(data)) {
      if (! resourceProperties.has(k)) {
        this.args[k] = data[k];
      }
    }

    Object.seal(this);


    if (data.jwt) {
      this.jwt = data.jwt;
    }
    if (data.volatile) {
      this.volatile = data.volatile;
    }
    if (data.body) {
      this.body = data.body;
    }
    if (data.controller) {
      this.controller = data.controller;
    }
    if (data.action) {
      this.action = data.action;
    }
  }
}
