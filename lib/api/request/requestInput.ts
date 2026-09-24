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

import type { JSONObject } from "kuzzle-sdk";

import { InternalError } from "../../kerror/errors/internalError";
import * as assert from "../../util/assertType";

// private properties
// \u200b is a zero width space, used to masquerade console.log output
const _jwt = "jwt\u200b";
const _volatile = "volatile\u200b";
const _body = "body\u200b";
const _headers = "headers\u200b";
const _controller = "controller\u200b";
const _action = "action\u200b";
const _triggerEvents = "triggerEvents\u200b";

// any property not listed here will be copied into
// RequestInput.args
const resourceProperties = new Set([
  "jwt",
  "volatile",
  "body",
  "controller",
  "action",
]);

/**
 * @deprecated
 */
export class RequestResource {
  private args: JSONObject;

  constructor(args: JSONObject) {
    this.args = args;
  }

  /**
   * Document ID
   */
  get _id(): string | null {
    return this.args._id;
  }

  set _id(str: string) {
    this.args._id = str;
  }

  /**
   * Index name
   */
  get index(): string | null {
    return this.args.index;
  }

  set index(str: string) {
    this.args.index = str;
  }

  /**
   * Collection name
   */
  get collection(): string | null {
    return this.args.collection;
  }

  set collection(str: string) {
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
   * @deprecated Use directly`request.input.args.<_id|index|collection>` instead
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

  /*
   * The backing fields behind the accessors below, declared so that the
   * compiler checks them. They keep the zero-width-space keys rather than
   * becoming `private` or `#` names, which is what keeps `console.log` output
   * as it has been for ten years — see the comment on those constants.
   * Declaring them changes nothing at runtime.
   */
  [_jwt]: string | null;
  [_volatile]: JSONObject | null;
  [_body]: JSONObject | null;
  [_headers]: JSONObject | null;
  [_controller]: string | null;
  [_action]: string | null;
  [_triggerEvents]: boolean | undefined;

  /**
   * Builds a Kuzzle normalized request input object
   *
   * The 'data' object accepts a request content using the same
   * format as the one used, for instance, for the Websocket protocol
   *
   * Any undefined option is set to null
   */
  constructor(data: JSONObject) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new InternalError("Input request data must be a non-null object");
    }

    this[_jwt] = null;
    this[_volatile] = null;
    this[_body] = null;
    this[_controller] = null;
    this[_action] = null;
    // `undefined`, not `null`: the setter already normalises "not asked for"
    // to undefined, and the getter has always declared `boolean | undefined`.
    // The only reader is a truthiness test in funnel.ts, so this is the same
    // value said honestly.
    this[_triggerEvents] = undefined;

    // default value to null for former "resources" to avoid breaking
    this.args = {};
    this.resource = new RequestResource(this.args);

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
    this.triggerEvents = data.triggerEvents;
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
  get jwt(): string | null {
    return this[_jwt];
  }

  // `| null` for the same reason as `body` below: `assertString` answers
  // `null` for `null` and `undefined` in its first branch, and the getter
  // above declares it. See docs/adr-001/steps/14-test-program-strict.md (M5).
  set jwt(str: string | null) {
    this[_jwt] = assert.assertString("jwt", str);
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
  get controller(): string | null {
    return this[_controller];
  }

  set controller(str: string) {
    // can only be set once
    if (!this[_controller]) {
      this[_controller] = assert.assertString("controller", str);
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
  get action(): string | null {
    return this[_action];
  }

  set action(str: string) {
    // can only be set once
    if (!this[_action]) {
      this[_action] = assert.assertString("action", str);
    }
  }
  get triggerEvents(): boolean | undefined {
    return this[_triggerEvents];
  }
  set triggerEvents(bool: boolean) {
    this[_triggerEvents] = bool === true ? true : undefined;
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
  get body(): JSONObject | null {
    return this[_body];
  }

  /**
   * `null` is accepted, and was already the only way to *clear* a body:
   * `assertArrayOrObject` answers `null` for both `null` and `undefined`, the
   * constructor initialises the field to `null`, and the getter above declares
   * it. The parameter type excluded the one value the implementation handles
   * first — the same asymmetry `headers` documents just below.
   */
  set body(obj: JSONObject | Array<any> | null) {
    this[_body] = assert.assertArrayOrObject("body", obj);
  }

  /**
   * Request headers (Http only).
   *
   * @deprecated Use RequestContext.connection.misc.headers instead
   */
  get headers(): JSONObject | null {
    return this[_headers];
  }

  /**
   * `undefined` is accepted because `KuzzleRequest`'s constructor assigns
   * `context.connection.misc.headers`, which a connection without headers does
   * not have. `assertObject` answers null for it, which is what the getter has
   * always reported.
   */
  set headers(obj: JSONObject | undefined) {
    this[_headers] = assert.assertObject("headers", obj);
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
  get volatile(): JSONObject | null {
    return this[_volatile];
  }

  // `| null`, as `assertObject` and the getter above both allow.
  set volatile(obj: JSONObject | null) {
    this[_volatile] = assert.assertObject("volatile", obj);
  }
}
