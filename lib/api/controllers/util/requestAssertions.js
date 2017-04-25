/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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
  { BadRequestError, InternalError: KuzzleInternalError } = require('kuzzle-common-objects').errors;

module.exports = {
  /**
   * @param {Request} request
   */
  assertHasBody: request => {
    if (!request.input.body) {
      throw new BadRequestError(`${request.input.controller}:${request.input.action} must specify a body.`);
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
      throw new BadRequestError(`${request.input.controller}:${request.input.action} must specify a body attribute "${attribute}".`);
    }
  },

  /**
   * @param {Request} request
   * @param {string} attribute
   */
  assertBodyHasNotAttribute: (request, attribute) => {
    if (request.input.body[attribute]) {
      throw new BadRequestError(`${request.input.controller}:${request.input.action} must not specify the body attribute "${attribute}".`);
    }
  },

  /**
   * Note: Assumes assertHasBody and assertBodyHasAttribte have been called first
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
        throw new KuzzleInternalError(`${request.input.controller}:${request.input.action} an unexepected type assertion "${type}" has been invoked on attribute "${attribute}".`);
    }

    throw new BadRequestError(`${request.input.controller}:${request.input.action} must specify the body attribute "${attribute}" of type "${type}".`);
  },

  /**
   * @param {Request} request
   */
  assertHasId: request => {
    if (!request.input.resource._id) {
      throw new BadRequestError(`${request.input.controller}:${request.input.action} must specify an _id.`);
    }
  },

  /**
   * @param {Request} request
   */
  assertIdStartsNotUnderscore: request => {
    if (request.input.resource._id && request.input.resource._id.charAt(0) === '_') {
      throw new BadRequestError(`${request.input.controller}:${request.input.action} must not specify an _id that starts with an underscore (_).`);
    }
  },

  /**
   * @param {Request} request
   */
  assertHasIndex: request => {
    if (!request.input.resource.index) {
      throw new BadRequestError(`${request.input.controller}:${request.input.action} must specify an index.`);
    }
  },

  /**
   * @param {Request} request
   */
  assertHasIndexAndCollection: request => {
    if (!request.input.resource.index) {
      throw new BadRequestError(`${request.input.controller}:${request.input.action} must specify an index.`);
    }
    if (!request.input.resource.collection) {
      throw new BadRequestError(`${request.input.controller}:${request.input.action} must specify a collection.`);
    }
  }
};
