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

const Bluebird = require('bluebird');
const { v4: uuidv4 } = require('uuid');

const kerror = require('../../kerror');
const { get, isPlainObject } = require('../../util/safeObject');

const assertionError = kerror.wrap('api', 'assert');

// Base class for all controllers
class BaseController {
  constructor() {
    this.__actions = new Set();
  }

  get _actions() {
    return this.__actions;
  }

  _addAction (name, fn) {
    this.__actions.add(name);
    this[name] = fn;
  }

  /**
   * Check if the provided action name exists within that controller.
   * This check's purpose is to prevent actions leak by making actions exposure
   * explicit.
   *
   * @param  {string} name
   * @returns {boolean}
   */
  _isAction (name) {
    return this.__actions.has(name);
  }
}

class NativeController extends BaseController {
  constructor(actions = []) {
    super();

    this.ask = global.kuzzle.ask.bind(global.kuzzle);
    this.pipe = global.kuzzle.pipe.bind(global.kuzzle);
    this.__actions = new Set(actions);
  }

  /**
   * Controller optional initialization method.
   * Used to perform asynchronous initialization safely: the funnel will wait
   * for all controllers to be initialized before accepting requests.
   *
   * @returns {Promise}
   */
  init () {
    return Bluebird.resolve();
  }

  async translateKoncorde (koncordeFilters) {
    if (Object.keys(koncordeFilters).length === 0) {
      return {};
    }

    // @todo throw "koncorde_unknown_keyword" when Koncorde will throw
    // just the keyword name
    await global.kuzzle.koncorde.validate(koncordeFilters);

    if (typeof koncordeFilters !== 'object') {
      throw kerror.get(
        'api',
        'assert',
        'invalid_type',
        'body.query',
        'object');
    }

    try {
      return await this.ask('core:storage:public:translate', koncordeFilters);
    }
    catch (error) {
      if (! error.keyword) {
        throw error;
      }

      throw kerror.get(
        'api',
        'assert',
        'koncorde_restricted_keyword',
        error.keyword.type,
        error.keyword.name);
    }
  }

  getLangParam (request) {
    const lang = this.getString(request, 'lang', 'elasticsearch');

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
   * Gets a parameter from a request body and checks that it is a boolean
   * Contrary to other parameter types, an unset boolean does not trigger an
   * error, instead it's considered as 'false'
   *
   * @param  {Request} request
   * @param  {string} name - parameter name
   * @returns {boolean}
   */
  getBodyBoolean (request, name) {
    const body = request.input.body;

    if (body === null) {
      return false;
    }

    return this._getBoolean(
      body,
      request.context.connection.protocol,
      name,
      `body.${name}`);
  }

  /**
   * Gets a parameter from a request body and checks that it is a number
   *
   * @param  {Request} request
   * @param  {string} name - parameter name
   * @param  {number} def - default value to return if the parameter is not set
   * @returns {number}
   * @throws {api.assert.body_required} If no default value provided and no
   *                                    request body set
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not a number
   */
  getBodyNumber (request, name, def = null) {
    const body = request.input.body;

    if (body === null) {
      if (def !== null) {
        return def;
      }

      throw assertionError.get('body_required');
    }

    return this._getNumber(body, name, `body.${name}`, def);
  }

  /**
   * Gets a parameter from a request body and checks that it is a integer
   *
   * @param  {Request} request
   * @param  {string} name - parameter name
   * @param  {number} def - default value to return if the parameter is not set
   * @returns {number}
   * @throws {api.assert.body_required} If no default value provided and no
   *                                    request body set
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not an integer
   */
  getBodyInteger (request, name, def = null) {
    const body = request.input.body;

    if (body === null) {
      if (def !== null) {
        return def;
      }

      throw assertionError.get('body_required');
    }

    return this._getInteger(body, name, `body.${name}`, def);
  }

  /**
   * Gets a parameter from a request body and checks that it is a string
   *
   * @param  {Request} request
   * @param  {string} name - parameter name
   * @param  {string} def - default value to return if the parameter is not set
   * @returns {string}
   * @throws {api.assert.body_required} If no default value provided and no
   *                                    request body set
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not a string
   */
  getBodyString (request, name, def = null) {
    const body = request.input.body;

    if (body === null) {
      if (def !== null) {
        return def;
      }

      throw assertionError.get('body_required');
    }

    return this._getString(body, name, `body.${name}`, def);
  }

  /**
   * Gets a parameter from a request body and checks that it is an array
   *
   * @param  {Request} request
   * @param  {string} name - parameter name
   * @param  {array} def - default value to return if the parameter is not set
   * @returns {array}
   * @throws {api.assert.body_required} If no default value provided and no
   *                                    request body set
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not an array
   */
  getBodyArray (request, name, def = null) {
    const body = request.input.body;

    if (body === null) {
      if (def !== null) {
        return def;
      }

      throw assertionError.get('body_required');
    }

    return this._getArray(body, name, `body.${name}`, def);
  }

  /**
   * Gets a parameter from a request body and checks that it is an object
   *
   * @param  {Request} request
   * @param  {string} name - parameter name
   * @param  {object} def - default value to return if the parameter is not set
   * @returns {object}
   * @throws {api.assert.body_required} If no default value provided and no
   *                                    request body set
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not an object
   */
  getBodyObject (request, name, def = null) {
    const body = request.input.body;

    if (body === null) {
      if (def !== null) {
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
   * @param  {Request} request
   * @param  {string} name - parameter name
   * @returns {boolean}
   */
  getBoolean (request, name) {
    return this._getBoolean(
      request.input.args,
      request.context.connection.protocol,
      name,
      name);
  }

  /**
   * Gets a parameter from a request arguments and checks that it is a number
   *
   * @param  {Request} request
   * @param  {string} name - parameter name
   * @param  {number} def - default value to return if the parameter is not set
   * @returns {number}
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not a number
   */
  getNumber (request, name, def = null) {
    return this._getNumber(request.input.args, name, name, def);
  }

  /**
   * Gets a parameter from a request arguments and checks that it is an integer
   *
   * @param  {Request} request
   * @param  {string} name - parameter name
   * @param  {number} def - default value to return if the parameter is not set
   * @returns {number}
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not an integer
   */
  getInteger (request, name, def = null) {
    return this._getInteger(request.input.args, name, name, def);
  }

  /**
   * Gets a parameter from a request arguments and checks that it is a string
   *
   * @param  {Request} request
   * @param  {string} name - parameter name
   * @param  {string} def - default value to return if the parameter is not set
   * @returns {string}
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not a string
   */
  getString (request, name, def = null) {
    return this._getString(request.input.args, name, name, def);
  }

  /**
   * Gets a parameter from a request arguments and checks that it is an array
   *
   * @param  {Request} request
   * @param  {string} name - parameter name
   * @param  {array} def - default value to return if the parameter is not set
   * @returns {array}
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not an array
   */
  getArray (request, name, def = null) {
    return this._getArray(request.input.args, name, name, def);
  }

  /**
   * Gets a parameter from a request arguments and checks that it is an object
   *
   * @param  {Request} request
   * @param  {string} name - parameter name
   * @param  {object} def - default value to return if the parameter is not set
   * @returns {object}
   * @throws {api.assert.missing_argument} If parameter not found and no default
   *                                       value provided
   * @throws {api.assert.invalid_type} If the fetched parameter is not an object
   */
  getObject (request, name, def = null) {
    return this._getObject(request.input.args, name, name, def);
  }

  /**
   * Generic object getter: boolean value
   *
   * @param {object} obj - container object
   * @param {string} protocol - network protocol name
   * @param {string} name - parameter name
   * @param {string} errorName - name to use in error messages
   * @returns {boolean}
   */
  _getBoolean (obj, protocol, name, errorName) {
    let value = get(obj, name);

    // In HTTP, booleans are flags: if it's in the querystring, it's set,
    // whatever its value.
    // If a user needs to unset the option, they need to remove it from the
    // querystring.
    if (protocol === 'http') {
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
   * @param {object} obj - container object
   * @param {string} name - parameter name
   * @param {string} errorName - name to use in error messages
   * @param {number} def - default value
   * @returns {number}
   */
  _getNumber (obj, name, errorName, def = null) {
    let value = get(obj, name);

    if (value === undefined || value === null) {
      if (def !== null) {
        return def;
      }

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
   * @param {object} obj - container object
   * @param {string} name - parameter name
   * @param {string} errorName - name to use in error messages
   * @param {integer} def - default value
   * @returns {integer}
   */
  _getInteger (obj, name, errorName, def = null) {
    let value = get(obj, name);

    if (value === undefined || value === null) {
      if (def !== null) {
        return def;
      }

      throw assertionError.get('missing_argument', errorName);
    }

    value = Number.parseFloat(value);

    if (Number.isNaN(value) || !Number.isSafeInteger(value)) {
      throw assertionError.get('invalid_type', errorName, 'integer');
    }

    return value;
  }

  /**
   * Generic object getter: string value
   *
   * @param {object} obj - container object
   * @param {string} name - parameter name
   * @param {string} errorName - name to use in error messages
   * @param {string} def - default value
   * @returns {string}
   */
  _getString (obj, name, errorName, def = null) {
    const value = get(obj, name);

    if (value === undefined || value === null) {
      if (def !== null) {
        return def;
      }

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
   * @param {object} obj - container object
   * @param {string} name - parameter name
   * @param {string} errorName - name to use in error messages
   * @param {array} def - default value
   * @returns {array}
   */
  _getArray (obj, name, errorName, def = null) {
    const value = get(obj, name);

    if (value === undefined || value === null) {
      if (def !== null) {
        return def;
      }

      throw assertionError.get('missing_argument', errorName);
    }

    if (!Array.isArray(value)) {
      throw assertionError.get('invalid_type', errorName, 'array');
    }

    return value;
  }

  /**
   * Generic object getter: object value
   *
   * @param {object} obj - container object
   * @param {string} name - parameter name
   * @param {string} errorName - name to use in error messages
   * @param {object} def - default value
   * @returns {object}
   */
  _getObject (obj, name, errorName, def = null) {
    const value = get(obj, name);

    if (value === undefined || value === null) {
      if (def !== null) {
        return def;
      }

      throw assertionError.get('missing_argument', errorName);
    }

    if (!isPlainObject(value)) {
      throw assertionError.get('invalid_type', errorName, 'object');
    }

    return value;
  }

  /**
   * Returns the index specified in the request
   *
   * @param {Request} request
   *
   * @throws
   * @returns {String}
   */
  getIndex (request) {
    const index = request.input.args.index;

    if (! index) {
      throw assertionError.get('missing_argument', 'index');
    }

    return index;
  }

  /**
   * Returns the collection specified in the request
   *
   * @param {Request} request
   *
   * @throws
   * @returns {String}
   */
  getCollection (request) {
    const collection = request.input.args.collection;

    if (! collection) {
      throw assertionError.get('missing_argument', 'collection');
    }

    return collection;
  }

  /**
   * Returns the index and collection specified in the request
   *
   * @param {Request} request
   *
   * @throws
   * @returns {Object} { index, collection }
   */
  getIndexAndCollection (request) {
    if (! request.input.args.index) {
      throw assertionError.get('missing_argument', 'index');
    }

    if (! request.input.args.collection) {
      throw assertionError.get('missing_argument', 'collection');
    }

    return request.input.args;
  }

  /**
   * Returns the provided request's body
   *
   * @param {Request} request
   * @param {object} def - default value to return if the body is not set
   * @returns {object}
   * @throws {api.assert.body_required} If the body is not set and if no default
   *                                    value is provided
   */
  getBody (request, def = null) {
    if (request.input.body === null) {
      if (def !== null) {
        return def;
      }

      throw assertionError.get('body_required');
    }

    return request.input.body;
  }

  /**
   * Returns the id specified in the request
   *
   * @param {Request} request
   * @param {ifMissingEnum} ifMissing - what to do if the id cannot be found
   *
   * @throws
   * @returns {String}
   */
  getId (request, ifMissing = ifMissingEnum.ERROR, generator = uuidv4) {
    const id = request.input.args._id;

    if (! id) {
      if (ifMissing === ifMissingEnum.GENERATE) {
        return generator();
      }

      if (ifMissing === ifMissingEnum.IGNORE) {
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
   * Returns the current user id
   *
   * @param {Request} request
   *
   * @returns {String}
   */
  getUserId (request) {
    if (request.context && request.context.user && request.context.user._id) {
      return request.context.user._id;
    }

    return null;
  }

  /**
   * Returns the current user
   *
   * @param {Request} request
   *
   * @returns {Object}
   */
  getUser (request) {
    if (request.context && request.context.user) {
      return request.context.user;
    }

    return null;
  }

  /**
  * Returns the search body query according to the http method
  *
  * @param {Request} request
  *
  * @returns {Object}
  */
  getSearchBody (request) {
    if ( request.context.connection.protocol === 'http'
      && request.context.connection.misc.verb === 'GET'
    ) {
      const searchBody = this.getString(request, 'searchBody', '{}');
      try {
        return JSON.parse(searchBody);
      }
      catch (err) {
        throw assertionError.get('invalid_argument', err.message);
      }
    }
    return this.getBody(request, {});
  }

  getSearchParams (request) {
    const from = this.getInteger(request, 'from', 0);
    const size = this.getInteger(request, 'size', 10);
    const scrollTTL = this.getScrollTTLParam(request);
    const query = this.getBodyObject(request, 'query', {});
    const searchBody = this.getSearchBody(request);

    return { from, query, scrollTTL, searchBody, size };
  }

  /**
   * Extract string scroll ttl param from the request or returns undefined
   *
   * @param {Request} request
   *
   * @returns {String|undefined}
   */
  getScrollTTLParam (request) {
    const scrollTTLParam = request.input.args.scroll;

    if (scrollTTLParam && typeof scrollTTLParam !== 'string') {
      throw assertionError.get('invalid_type', 'scroll', 'string');
    }

    return scrollTTLParam;
  }

  /**
   * Gets the refresh value.
   *
   * @param {Request} request
   *
   * @returns {String}
   */
  getRefresh (request, defaultValue = 'false') {
    if (request.input.args.refresh === undefined) {
      return defaultValue.toString();
    }

    if ( request.input.args.refresh === false
      || request.input.args.refresh === 'false'
      || request.input.args.refresh === null
    ) {
      return 'false';
    }

    return 'wait_for';
  }

  /**
   * Throws if the body contain one of the specified attribute
   *
   * @param {Request} request
   * @param  {...any} paths
   */
  assertBodyHasNotAttributes (request, ...paths) {
    if (request.input.body !== null) {
      for (const path of paths) {
        if (get(request.input.body, path)) {
          throw assertionError.get('forbidden_argument', `body.${path}`);
        }
      }
    }
  }

  /**
   * Throws if the strategy does not exists
   *
   * @todo move this method in some kind of "Security" class
   * @param {String} strategy
   */
  assertIsStrategyRegistered (strategy) {
    if (! global.kuzzle.pluginsManager.listStrategies().includes(strategy)) {
      throw kerror.get('security', 'credentials', 'unknown_strategy', strategy);
    }
  }

  /**
   * Throws if page size exceeed Kuzzle limits
   *
   * @param {String} index
   * @param {String} collection
   */
  assertNotExceedMaxFetch (asked) {
    const limit = global.kuzzle.config.limits.documentsFetchCount;

    if (asked > limit) {
      throw kerror.get('services', 'storage', 'get_limit_exceeded');
    }
  }

  /**
   * Throws if number of documents exceeed Kuzzle limits
   *
   * @param {Number} asked
   * @throws
   */
  assertNotExceedMaxWrite (asked) {
    const limit = global.kuzzle.config.limits.documentsWriteCount;

    if (asked > limit) {
      throw kerror.get('services', 'storage', 'write_limit_exceeded');
    }
  }
}

/**
 * @typedef {number} ifMissingEnum
 **/

/**
 * Enum for the getId's "ifMissing" option
 * @readOnly
 * @enum {ifMissingEnum}
 */
const ifMissingEnum = Object.freeze({
  ERROR: 1,
  GENERATE: 2,
  IGNORE: 3,
});

module.exports = { BaseController, NativeController, ifMissingEnum };
