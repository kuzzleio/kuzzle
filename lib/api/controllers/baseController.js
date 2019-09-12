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
  errorsManager = require('../../config/error-codes/throw').wrap('api', 'base');

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
    const
      flagName = flagPath.split('.').slice(-1),
      flagValue = _.get(request, `input.${flagPath}`);

    // In HTTP, booleans are flags: if it's in the querystring, it's set, whatever
    // its value.
    // If a user needs to unset the option, they need to remove it from the querystring.
    if ( request.context.connection.protocol !== 'http'
      && !_.isNil(flagValue)
      && typeof flagValue !== 'boolean'
    ) {
      errorsManager.throw('invalid_value_type', flagName, flagValue);
    }
    else if (request.context.connection.protocol === 'http') {
      const booleanValue = flagValue !== undefined ? true : false;

      _.set(request, flagPath, booleanValue);

      return booleanValue;
    }

    return Boolean(flagValue);
  }

  /**
   * Extracts an array parameter from the request input
   *
   * @param {Request} request - Request object
   * @param {String} paramPath - Path of the parameter to extract (eg: 'body.foo')
   * @param {?String[]} defaultValue
   *
   * @throws
   * @returns {String[]}
   */
  getArrayParam (request, paramPath, defaultValue = null) {
    const arrayParam = _.get(request.input, paramPath, defaultValue);

    if (arrayParam === null) {
      errorsManager.throw('missing_param', paramPath);
    }

    if (! Array.isArray(arrayParam)) {
      errorsManager.throw('invalid_param_type', paramPath, arrayParam, 'Array');
    }

    return arrayParam;
  }

  /**
   * Extracts a string parameter from the request input
   *
   * @param {Request} request - Request object
   * @param {String} paramPath - Path of the parameter to extract (eg: 'body.foo')
   * @param {?String[]} defaultValue
   *
   * @throws
   * @returns {String[]}
   */
  getStringParam (request, paramPath, defaultValue = null) {
    const stringParam = _.get(request.input, paramPath, defaultValue);

    if (stringParam === null) {
      errorsManager.throw('missing_param', paramPath);
    }

    if (typeof stringParam !== 'string') {
      errorsManager.throw('invalid_param_type', paramPath, stringParam, 'String');
    }

    return stringParam;
  }

  /**
   * Extracts an object parameter from the request input
   *
   * @param {Request} request - Request object
   * @param {String} paramPath - Path of the parameter to extract (eg: 'body.foo')
   * @param {?String[]} defaultValue
   *
   * @throws
   * @returns {String[]}
   */
  getObjectParam (request, paramPath, defaultValue = null) {
    const objectParam = _.get(request.input, paramPath) || defaultValue;

    if (objectParam === null) {
      errorsManager.throw('missing_param', paramPath);
    }

    if (! _.isPlainObject(objectParam)) {
      errorsManager.throw('invalid_param_type', paramPath, objectParam, 'Object');
    }

    return objectParam;
  }

  /**
   * Extracts a number parameter from the request input
   *
   * @param {Request} request - Request object
   * @param {String} paramPath - Path of the parameter to extract (eg: 'body.foo')
   * @param {?String[]} defaultValue
   *
   * @throws
   * @returns {Number}
   */
  getNumberParam (request, paramPath, defaultValue = null) {
    const rawNumberParam = _.get(request.input, paramPath, defaultValue);

    if (rawNumberParam === null) {
      errorsManager.throw('missing_param', paramPath);
    }

    const numberParam = parseInt(rawNumberParam);

    if (isNaN(numberParam)) {
      errorsManager.throw('invalid_param_type', paramPath, rawNumberParam, 'Number');
    }

    return numberParam;
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
      errorsManager.throw('missing_index');
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
    const
      index = this.getIndex(request),
      collection = request.input.resource.collection;

    if (! collection) {
      errorsManager.throw('missing_collection');
    }

    return { index, collection };
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
      errorsManager.throw('missing_id');
    }

    if (typeof id !== 'string') {
      errorsManager.throw('wrong_id_type');
    }

    if (id.charAt(0) === '_') {
      errorsManager.throw('wrong_id_format');
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
    return _.get(request, 'context.user._id', null);
  }

  getSearchParams (request) {
    const
      from = this.getNumberParam(request, 'args.from', 0),
      size = this.getNumberParam(request, 'args.size', 10),
      scroll = this.getScrollParam(request),
      query = this.getObjectParam(request, 'body.query', {}),
      searchBody = this.getObjectParam(request, 'body', {});

    return { from, size, scroll, query, searchBody };
  }

  /**
   * Extract string scroll param from the request or returns undefined
   *
   * @param {Request} request
   *
   * @returns {String|undefined}
   */
  getScrollParam (request) {
    const scrollParam = request.input.args.scroll;

    if (scrollParam && typeof scrollParam !== 'string') {
      errorsManager.throw(
        'invalid_param_type',
        'args.scroll',
        scrollParam,
        'String');
    }

    return scrollParam;
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
        errorsManager.throw('must_not_specify_body_attribute', path);
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
      errorsManager.throw('unknown_strategy', strategy);
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
      errorsManager.throw('search_page_size', limit);
    }
  }
}

module.exports = BaseController;
