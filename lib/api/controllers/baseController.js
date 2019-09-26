/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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

const
  _ = require('lodash'),
  Bluebird = require('bluebird'),
  errorsManager = require('../../util/errors');

const assertionError = errorsManager.wrap('api', 'assert');

// Base class for all API controllers
class BaseController {
  constructor(kuzzle, actions = []) {
    this._kuzzle = kuzzle;

    this._actions = new Set(actions);
  }

  get actions() {
    return this._actions;
  }

  get publicStorage () {
    return this._kuzzle.storageEngine.public;
  }

  get kuzzle () {
    return this._kuzzle;
  }

  /**
   * Check if the provided action name exists within that controller.
   * This check's purpose is to prevent actions leak by making actions exposure
   * explicit.
   *
   * @param  {string} name
   * @return {boolean}
   */
  isAction (name) {
    return this.actions.has(name);
  }

  /**
   * Controller optional initialization method.
   * Used to perform asynchronous initialization safely: the funnel will wait
   * for all controllers to be initialized before accepting requests.
   *
   * @return {Promise}
   */
  init () {
    return Bluebird.resolve();
  }


  /**
   * Get a boolean param from request input
   * For HTTP, flag presence mean true value
   *
   * @param {Request} request
   * @param {string} flagPath
   */
  tryGetBoolean (request, flagPath) {
    const flagValue = _.get(request, `input.${flagPath}`);

    // In HTTP, booleans are flags: if it's in the querystring, it's set,
    // whatever its value.
    // If a user needs to unset the option, they need to remove it from the
    // querystring.
    if ( request.context.connection.protocol !== 'http'
      && !_.isNil(flagValue)
      && typeof flagValue !== 'boolean'
    ) {
      const flagName = flagPath.split('.').slice(-1);
      assertionError.throw('invalid_type', flagName, 'boolean');
    }
    else if (request.context.connection.protocol === 'http') {
      const booleanValue = flagValue !== undefined ? true : false;

      _.set(request, flagPath, booleanValue);

      return booleanValue;
    }

    return Boolean(flagValue);
  }

  /**
   * Gets a body argument and checks that its of the right type
   * @param  {Request} request
   * @param  {string} name
   * @param  {string} type
   * @param  {*} default
   * @return {*}
   */
  getBodyArg (request, name, type, def = null) {
    let body;

    try {
      body = this.getBody(request);
    }
    catch (e) {
      if (def !== null) {
        return def;
      }

      throw e;
    }

    const value = body[name];

    if (value === undefined || value === null) {
      if (def !== null) {
        return def;
      }

      assertionError.throw('missing_argument', `body.${name}`);
    }

    return this._cast(`body.${name}`, value, type);
  }

  /**
   * Gets an argument and checks that its of the right type
   * @param  {Request} request
   * @param  {string} name
   * @param  {string} type
   * @param  {*} default
   * @return {*}
   */
  getArg (request, name, type, def = null) {
    const value = request.input.args[name];

    if (value === undefined || value === null) {
      if (def !== null) {
        return def;
      }

      assertionError.throw('missing_argument', name);
    }

    return this._cast(name, value, type);
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
    const index = request.input.resource.index;

    if (! index) {
      assertionError.throw('missing_argument', 'index');
    }

    return index;
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
    if (! request.input.resource.index) {
      assertionError.throw('missing_argument', 'index');
    }

    if (! request.input.resource.collection) {
      assertionError.throw('missing_argument', 'collection');
    }

    return request.input.resource;
  }

  /**
   * Returns the provided request's body
   * @param {Request} request
   * @returns {object}
   */
  getBody (request, def = null) {
    if (request.input.body === null) {
      if (def !== null) {
        return def;
      }

      assertionError.throw('body_required');
    }

    return request.input.body;
  }

  /**
   * Returns the id specified in the request
   *
   * @param {Request} request
   *
   * @throws
   * @returns {String}
   */
  getId (request) {
    const id = request.input.resource._id;

    if (! id) {
      assertionError.throw('missing_argument', '_id');
    }

    if (typeof id !== 'string') {
      assertionError.throw('invalid_type', '_id', 'string');
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

  getSearchParams (request) {
    const
      from = this.getArg(request, 'from', 'integer', 0),
      size = this.getArg(request, 'size', 'integer', 10),
      scrollTTL = this.getScrollTTLParam(request),
      query = this.getBodyArg(request, 'query', 'object', {}),
      searchBody = this.getBody(request, {});

    return { from, size, scrollTTL, query, searchBody };
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
      assertionError.throw('invalid_type', 'scroll', 'string');
    }

    return scrollTTLParam;
  }

  /**
   * Throws if the body contain one of the specified attribute
   *
   * @param {Request} request
   * @param  {...any} paths
   */
  assertBodyHasNotAttributes (request, ...paths) {
    for (const path of paths) {
      if (_.get(request.input.body, path)) {
        assertionError.throw('forbidden_argument', `body.${path}`);
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
    if (! this._kuzzle.pluginsManager.listStrategies().includes(strategy)) {
      errorsManager.throw('security', 'credentials', 'unknown_strategy', strategy);
    }
  }

  /**
   * Throws if page size exceeed Kuzzle limits
   *
   * @param {String} index
   * @param {String} collection
   */
  assertNotExceedMaxFetch (asked) {
    const limit = this._kuzzle.config.limits.documentsFetchCount;

    if (asked > limit) {
      errorsManager.throw('services', 'storage', 'get_limit_exceeded');
    }
  }

  // SonarQube complains that this function returns incoherent value types...
  // While this is true, this function is named "cast" for a reason.
  // And it takes a type name, because returning different value types is its
  // very purpose.
  // NOSONAR
  _cast (name, value, type) {
    const throwErr = () => assertionError.throw('invalid_type', name, type);
    let _value = value;

    switch (type) {
      case 'object':
        if (!_.isPlainObject(_value)) {
          throwErr();
        }
        break;
      case 'array':
        if (!Array.isArray(_value)) {
          throwErr();
        }
        break;
      case 'number':
        _value = Number.parseFloat(_value);
        if (Number.isNaN(_value)) {
          throwErr();
        }
        break;
      case 'integer':
        _value = Number.parseFloat(_value);
        if (Number.isNaN(_value) || !Number.isSafeInteger(_value)) {
          throwErr();
        }
        break;
      case 'string':
      case 'boolean':
        if (typeof _value !== type) {
          throwErr();
        }
        break;
      default:
        errorsManager.throw('core', 'fatal', 'unexpected_error', `Cannot cast from type ${type}`);
    }

    return _value;
  }
}

module.exports = BaseController;
