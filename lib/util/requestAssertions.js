const
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  UnauthorizedError = require('kuzzle-common-objects').errors.UnauthorizedError,
  getRequestRoute = require('./string').getRequestRoute;

module.exports = {
  /**
   * @param {Request} request
   */
  assertHasBody: function requestAssertHasBody (request) {
    if (!request.input.body) {
      throw new BadRequestError(`${getRequestRoute(request)} must specify a body.`);
    }
  },

  /**
   * Note: Assumes assertHasBody has been called first
   *
   * @param {Request} request
   * @param {string} attribute
   */
  assertBodyHasAttribute: function requestAssertBodyHasAttribute (request, attribute) {
    if (!request.input.body.hasOwnProperty(attribute)) {
      throw new BadRequestError(`${getRequestRoute(request)} must specify a body attribute "${attribute}".`);
    }
  },

  /**
   * @param {Request} request
   * @param {string} attribute
   */
  assertBodyHasNotAttribute: function requestAssertBodyHasAttribute (request, attribute) {
    if (request.input.body[attribute]) {
      throw new BadRequestError(`${getRequestRoute(request)} must not specify the body attribute "${attribute}".`);
    }
  },

  /**
   * Note: Assumes assertHasBody and assertBodyHasAttribte have been called first
   *
   * @param {Request} request
   * @param {string} attribute
   * @param {string} type
   */
  assertBodyAttributeType: function requestAssertBodyAttributeType (request, attribute, type) {
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
        throw new InternalError(`${getRequestRoute(request)} an unexepected type assertion "${type}" has been invoked on attribute "${attribute}".`);
    }

    throw new BadRequestError(`${getRequestRoute(request)} must specify the body attribute "${attribute}" of type "${type}".`);
  },

  /**
   * @param {Request} request
   */
  assertHasId: function requestAssertHasId (request) {
    if (!request.input.resource._id) {
      throw new BadRequestError(`${getRequestRoute(request)} must specify an _id.`);
    }
  },

  /**
   * @param {Request} request
   */
  assertIdStartsNotUnderscore: function requestAssertIdStartsNotUnderscore (request) {
    if (request.input.resource._id && request.input.resource._id.charAt(0) === '_') {
      throw new BadRequestError(`${getRequestRoute(request)} must not specify an _id that starts with an underscore (_).`);
    }
  },

  /**
   * @param {Request} request
   */
  assertHasIndex: function requestAssertHasIndex (request) {
    if (!request.input.resource.index) {
      throw new BadRequestError(`${getRequestRoute(request)} must specify an index.`);
    }
  },

  /**
   * @param {Request} request
   */
  assertHasIndexAndCollection: function requestAssertHasIndexAndCollection (request) {
    if (!request.input.resource.index) {
      throw new BadRequestError(`${getRequestRoute(request)} must specify an index.`);
    }
    if (!request.input.resource.collection) {
      throw new BadRequestError(`${getRequestRoute(request)} must specify a collection.`);
    }
  },

  /**
   * @param {Request} request
   */
  assertHasStrategy: function requestAssertHasStrategy (request) {
    if (!request.input.args.strategy) {
      throw new BadRequestError(`${getRequestRoute(request)} must specify a strategy.`);
    }
    if (typeof request.input.args.strategy !== 'string') {
      throw new BadRequestError(`${getRequestRoute(request)} argument's strategy must be a string.`);
    }
  },

  /**
   * @param {Request} request
   */
  assertHasScrollId: function requestAssertHasScrollId (request) {
    if (!request.input.args.scrollId) {
      throw new BadRequestError(`${getRequestRoute(request)} must specify a scrollId.`);
    }
    if (typeof request.input.args.scrollId !== 'string') {
      throw new BadRequestError(`${getRequestRoute(request)} argument's scrollId must be a string.`);
    }
  },

  /**
   * @param {Kuzzle} kuzzle
   * @param {Request} request
   */
  assertIsConnected: function requestAssertIsConnected (kuzzle, request) {
    if (request.context.user._id === kuzzle.repositories.user.anonymous()._id) {
      throw new UnauthorizedError(`${getRequestRoute(request)} User must be connected.`);
    }
  },

  /**
   * @param {Kuzzle} kuzzle
   * @param {Request} request
   */
  assertIsStrategyRegistered: function requestAssertIsStrategyRegistered (kuzzle, request) {
    if (kuzzle.pluginsManager.listStrategies().indexOf(request.input.args.strategy) === -1) {
      throw new BadRequestError(`${getRequestRoute(request)} strategy "${request.input.args.strategy}" is not a known strategy.`);
    }
  }
};