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
  errorsManager = require('../config/error-codes/throw').wrap('api', 'request_assertions');

module.exports = {
  /**
   * @param {Request} request
   */
  assertHasBody: request => {
    if (request.input.body === undefined || request.input.body === null) {
      errorsManager.throw('must_specify_body');
    }
  },

  /**
   * Note: Assumes assertHasBody has been called first
   *
   * @param {Request} request
   * @param {string} attribute
   */
  assertBodyHasAttribute: (request, attribute) => {
    if (_.isNil(request.input.body[attribute])) {
      errorsManager.throw('missing_body_attribute', attribute);
    }
  },

  /**
   *
   * @param {Request} request
   * @param {string} attribute
   */
  assertArgsHasAttribute: (request, attribute) => {
    if (_.isNil(request.input.args[attribute])) {
      errorsManager.throw('missing_attribute', attribute);
    }
  },

  /**
   * @param {Request} request
   * @param {string} attribute
   */
  assertBodyHasNotAttribute: (request, attribute) => {
    if (!_.isNil(request.input.body[attribute])) {
      errorsManager.throw('must_not_specify_body_attribute', attribute);
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
        if (typeof request.input.body[attribute] === type) {
          return true;
        }
        break;
      case 'array':
        if (Array.isArray(request.input.body[attribute])) {
          return true;
        }
        break;
      case 'object':
        if (request.input.body[attribute] instanceof Object && !Array.isArray(request.input.body[attribute])) {
          return true;
        }
        break;
      default:
        errorsManager.throw('unexpected_type_assertion_on_attribute', type, attribute);
    }

    errorsManager.throw('wrong_body_attribute_type', attribute, type);
  },


  /**
   * Note: Assumes content exists
   *
   * @param {Request} request
   * @param {string} attribute
   */
  assertContentHasAttribute: (request, attribute) => {
    if (!_.has(request.input.body.content, attribute)) {
      errorsManager.throw('missing_body_attribute', attribute);
    }
  },

  /**
   * @param {Request} request
   * @param {string} attribute
   */
  assertContentHasNotAttribute: (request, attribute) => {
    if (request.input.body.content[attribute]) {
      errorsManager.throw('must_not_specify_body_attribute', attribute);
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
        if (typeof request.input.body.content[attribute] === type) {
          return true;
        }
        break;
      case 'array':
        if (Array.isArray(request.input.body.content[attribute])) {
          return true;
        }
        break;
      case 'object':
        if (request.input.body.content[attribute] instanceof Object && !Array.isArray(request.input.body.content[attribute])) {
          return true;
        }
        break;
      default:
        errorsManager.throw('unexpected_type_assertion_on_attribute', type, `content.${attribute}`);
    }
    errorsManager.throw('wrong_body_attribute_type', `content.${attribute}`, type);
  },

  /**
   * @param {Request} request
   */
  assertHasId: request => {
    if (!request.input.resource._id) {
      errorsManager.throw('missing_id');
    }
  },

  /**
   * @param {Request} request
   */
  assertIdStartsNotUnderscore: request => {
    if (request.input.resource._id && request.input.resource._id.charAt(0) === '_') {
      errorsManager.throw('wrong_id_format');
    }
  },

  /**
   * @param {Request} request
   */
  assertHasIndex: request => {
    if (!request.input.resource.index) {
      errorsManager.throw('missing_index');
    }
  },

  /**
   * @param {Request} request
   */
  assertHasIndexAndCollection: request => {
    if (!request.input.resource.index) {
      errorsManager.throw('missing_index');
    }
    if (!request.input.resource.collection) {
      errorsManager.throw('missing_collection');
    }
  },

  /**
   * @param {Request} request
   */
  assertHasStrategy: request => {
    if (!request.input.args.strategy) {
      errorsManager.throw('missing_strategy');
    }
    if (typeof request.input.args.strategy !== 'string') {
      errorsManager.throw('wrong_strategy_type');
    }
  },

  /**
   * @param {Request} request
   */
  assertHasScrollId: request => {
    if (!request.input.args.scrollId) {
      errorsManager.throw('missing_scrollId');
    }
    if (typeof request.input.args.scrollId !== 'string') {
      errorsManager.throw('wrong_scrollId_type');
    }
  },

  /**
   * @param {Kuzzle} kuzzle
   * @param {Request} request
   */
  assertIsAuthenticated: (anonymousId, request) => {
    if (request.context.user._id === anonymousId) {
      errorsManager.throw('must_be_authenticated_to_execute_action');
    }
  },

  /**
   * @param {Kuzzle} kuzzle
   * @param {Request} request
   */
  assertIsStrategyRegistered: (kuzzle, request) => {
    if (kuzzle.pluginsManager.listStrategies().indexOf(request.input.args.strategy) === -1) {
      errorsManager.throw('unknown_strategy', request.input.args.strategy);
    }
  },

  /**
   * @param  {*} value
   * @throws {BadRequestError} If the value is not an object
   */
  assertIsObject: value => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      errorsManager.throw('must_be_an_object', value);
    }
  }
};
