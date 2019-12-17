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

'use strict';

const
  _ = require('lodash'),
  { has, get, isPlainObject } = require('./safeObject'),
  errorsManager = require('./errors');

const assertionError = errorsManager.wrap('api', 'assert');

module.exports = {
  /**
   * @param {Request} request
   */
  assertHasBody: request => {
    if (_.isNil(request.input.body)) {
      assertionError.throw('body_required');
    }
  },

  /**
   * Note: Assumes assertHasBody has been called first
   *
   * @param {Request} request
   * @param {string} attribute
   */
  assertBodyHasAttribute: (request, attribute) => {
    if (_.isNil(get(request.input.body, attribute))) {
      assertionError.throw('missing_argument', `body.${attribute}`);
    }
  },

  /**
   *
   * @param {Request} request
   * @param {string} attribute
   */
  assertArgsHasAttribute: (request, attribute) => {
    if (_.isNil(get(request.input.args, attribute))) {
      assertionError.throw('missing_argument', attribute);
    }
  },

  /**
   * @param {Request} request
   * @param {string} attribute
   */
  assertBodyHasNotAttribute: (request, attribute) => {
    if (!_.isNil(get(request.input.body, attribute))) {
      assertionError.throw('forbidden_argument', `body.${attribute}`);
    }
  },

  /**
   * Note: Assumes assertHasBody and assertBodyHasAttribute have been called first
   *
   * @param {Request} request
   * @param {string} attribute
   * @param {string} type
   */
  assertBodyAttributeType: (request, attribute, type) => {
    switch(type) {
      case 'number':
      case 'boolean':
      case 'string':
        // The body should always be passed as JSON, we don't consider type conversion possibilities
        if (typeof get(request.input.body, attribute) === type) {
          return true;
        }
        break;
      case 'array':
        if (Array.isArray(get(request.input.body, attribute))) {
          return true;
        }
        break;
      case 'object':
        if (isPlainObject(get(request.input.body, attribute))) {
          return true;
        }
        break;
      default:
        assertionError.throw('unexpected_type_assertion', type, attribute);
    }

    assertionError.throw('invalid_type', `body.${attribute}`, type);
  },


  /**
   * Note: Assumes content exists
   *
   * @param {Request} request
   * @param {string} attribute
   */
  assertContentHasAttribute: (request, attribute) => {
    if (!has(request.input.body.content, attribute)) {
      assertionError.throw('missing_argument', `body.content.${attribute}`);
    }
  },

  /**
   * @param {Request} request
   * @param {string} attribute
   */
  assertContentHasNotAttribute: (request, attribute) => {
    if (has(request.input.body.content, attribute)) {
      assertionError.throw('forbidden_argument', `body.content.${attribute}`);
    }
  },

  /**
   * Note: Assumes content exists
   *
   * @param {Request} request
   * @param {string} attribute
   * @param {string} type
   */
  assertContentAttributeType: (request, attribute, type) => {
    switch(type) {
      case 'number':
      case 'boolean':
      case 'string':
        // The body should always be passed as JSON, we don't consider type conversion possibilities
        if (typeof get(request.input.body.content, attribute) === type) {
          return true;
        }
        break;
      case 'array':
        if (Array.isArray(get(request.input.body.content, attribute))) {
          return true;
        }
        break;
      case 'object':
        if (isPlainObject(get(request.input.body.content, attribute))) {
          return true;
        }
        break;
      default:
        assertionError.throw('unexpected_type_assertion', type, `content.${attribute}`);
    }
    assertionError.throw('invalid_type', `body.content.${attribute}`, type);
  },

  /**
   * @param {Request} request
   */
  assertHasId: request => {
    if (!request.input.resource._id) {
      assertionError.throw('missing_argument', '_id');
    }
  },

  /**
   * @param {Request} request
   */
  assertIdStartsNotUnderscore: request => {
    if (request.input.resource._id && request.input.resource._id.charAt(0) === '_') {
      assertionError.throw('invalid_id');
    }
  },

  /**
   * @param {Request} request
   */
  assertHasIndex: request => {
    if (!request.input.resource.index) {
      assertionError.throw('missing_argument', 'index');
    }
  },

  /**
   * @param {Request} request
   */
  assertHasIndexAndCollection: request => {
    if (!request.input.resource.index) {
      assertionError.throw('missing_argument', 'index');
    }

    if (!request.input.resource.collection) {
      assertionError.throw('missing_argument', 'collection');
    }
  },

  /**
   * @param {Request} request
   */
  assertHasStrategy: request => {
    if (!request.input.args.strategy) {
      assertionError.throw('missing_argument', 'strategy');
    }

    if (typeof request.input.args.strategy !== 'string') {
      assertionError.throw('invalid_type', 'strategy', 'string');
    }
  },

  /**
   * @param {Request} request
   */
  assertHasScrollId: request => {
    if (!request.input.args.scrollId) {
      assertionError.throw('missing_argument', 'scrollId');
    }

    if (typeof request.input.args.scrollId !== 'string') {
      assertionError.throw('invalid_type', 'scrollId', 'string');
    }
  },

  /**
   * @param {Kuzzle} kuzzle
   * @param {Request} request
   */
  assertIsAuthenticated: (anonymousId, request) => {
    if (request.context.user._id === anonymousId) {
      errorsManager.throw('security', 'rights', 'unauthorized');
    }
  },

  /**
   * @param {Kuzzle} kuzzle
   * @param {Request} request
   */
  assertIsStrategyRegistered: (kuzzle, request) => {
    if (kuzzle.pluginsManager.listStrategies().indexOf(request.input.args.strategy) === -1) {
      errorsManager.throw(
        'security',
        'credentials',
        'unknown_strategy',
        request.input.args.strategy);
    }
  },

  /**
   * @param  {*} value
   * @throws {BadRequestError} If the value is not an object
   */
  assertIsObject: value => {
    if (!isPlainObject(value)) {
      assertionError.throw('invalid_argument', value, 'object');
    }
  }
};
