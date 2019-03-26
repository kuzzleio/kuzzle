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
  {BadRequestError, InternalError: KuzzleInternalError, UnauthorizedError} = require('kuzzle-common-objects').errors;

module.exports = {
  /**
   * @param {Request} request
   */
  assertHasBody: request => {
    if (!request.input.body) {
      throw new BadRequestError('The request must specify a body.');
    }
  },

  /**
   * Note: Assumes assertHasBody has been called first
   *
   * @param {Request} request
   * @param {string} attribute
   */
  assertBodyHasAttribute: (request, attribute) => {
    if (!request.input.body.hasOwnProperty(attribute)) {
      throw new BadRequestError(`The request must specify a body attribute "${attribute}".`);
    }
  },

  /**
   *
   * @param {Request} request
   * @param {string} attribute
   */
  assertArgsHasAttribute: (request, attribute) => {
    if (!request.input.args || !request.input.args.hasOwnProperty(attribute)) {
      throw new BadRequestError(`The request must specify an attribute "${attribute}".`);
    }
  },

  /**
   * @param {Request} request
   * @param {string} attribute
   */
  assertBodyHasNotAttribute: (request, attribute) => {
    if (request.input.body[attribute]) {
      throw new BadRequestError(`The request must not specify the body attribute "${attribute}".`);
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
        throw new KuzzleInternalError(`An unexepected type assertion "${type}" has been invoked on attribute "${attribute}".`);
    }

    throw new BadRequestError(`The request must specify the body attribute "${attribute}" of type "${type}".`);
  },


  /**
   * Note: Assumes content exists
   *
   * @param {Request} request
   * @param {string} attribute
   */
  assertContentHasAttribute: (request, attribute) => {
    if (!request.input.body.content.hasOwnProperty(attribute)) {
      throw new BadRequestError(`The request must specify a body attribute "content.${attribute}".`);
    }
  },

  /**
   * @param {Request} request
   * @param {string} attribute
   */
  assertContentHasNotAttribute: (request, attribute) => {
    if (request.input.body.content[attribute]) {
      throw new BadRequestError(`The request must not specify the body attribute "content.${attribute}".`);
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
        throw new KuzzleInternalError(`An unexepected type assertion "${type}" has been invoked on attribute "content.${attribute}".`);
    }

    throw new BadRequestError(`The request must specify the body attribute "content.${attribute}" of type "${type}".`);
  },

  /**
   * @param {Request} request
   */
  assertHasId: request => {
    if (!request.input.resource._id) {
      throw new BadRequestError('The request must specify an _id.');
    }
  },

  /**
   * @param {Request} request
   */
  assertIdStartsNotUnderscore: request => {
    if (request.input.resource._id && request.input.resource._id.charAt(0) === '_') {
      throw new BadRequestError('The request must not specify an _id that starts with an underscore (_).');
    }
  },

  /**
   * @param {Request} request
   */
  assertHasIndex: request => {
    if (!request.input.resource.index) {
      throw new BadRequestError('The request must specify an index.');
    }
  },

  /**
   * @param {Request} request
   */
  assertHasIndexAndCollection: request => {
    if (!request.input.resource.index) {
      throw new BadRequestError('The request must specify an index.');
    }
    if (!request.input.resource.collection) {
      throw new BadRequestError('The request must specify a collection.');
    }
  },

  /**
   * @param {Request} request
   */
  assertHasStrategy: request => {
    if (!request.input.args.strategy) {
      throw new BadRequestError('The request must specify a strategy.');
    }
    if (typeof request.input.args.strategy !== 'string') {
      throw new BadRequestError('The request argument\'s strategy must be a string.');
    }
  },

  /**
   * @param {Request} request
   */
  assertHasScrollId: request => {
    if (!request.input.args.scrollId) {
      throw new BadRequestError('The request must specify a scrollId.');
    }
    if (typeof request.input.args.scrollId !== 'string') {
      throw new BadRequestError('The request argument\'s scrollId must be a string.');
    }
  },

  /**
   * @param {Kuzzle} kuzzle
   * @param {Request} request
   */
  assertIsAuthenticated: (anonymousId, request) => {
    if (request.context.user._id === anonymousId) {
      throw new UnauthorizedError(
        'You must be authenticated to execute that action');
    }
  },

  /**
   * @param {Kuzzle} kuzzle
   * @param {Request} request
   */
  assertIsStrategyRegistered: (kuzzle, request) => {
    if (kuzzle.pluginsManager.listStrategies().indexOf(request.input.args.strategy) === -1) {
      throw new BadRequestError(`The strategy "${request.input.args.strategy}" is not a known strategy.`);
    }
  }
};
