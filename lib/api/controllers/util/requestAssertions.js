var BadRequestError = require('kuzzle-common-objects').errors.BadRequestError;

module.exports = {
  /**
   * @param {Request} request
   * @param {string} action
   */
  assertBody: function requestAssertBody (request, action) {
    if (!request.input.body) {
      throw new BadRequestError(`${action} must specify a body.`);
    }
  },

  /**
   * @param {Request} request
   * @param {string} attribute
   * @param {string} action
   */
  assertBodyAttribute: function requestAssertBodyAttribute (request, attribute, action) {
    if (!request.input.body[attribute]) {
      throw new BadRequestError(`${action} must specify a body attribute "${attribute}".`);
    }
  },

  /**
   * @param {Request} request
   * @param {string} attribute
   * @param {string} action
   */
  assertBodyAttributeAbsence: function requestAssertBodyAttribute (request, attribute, action) {
    if (request.input.body[attribute]) {
      throw new BadRequestError(`${action} must not specify the body attribute "${attribute}".`);
    }
  },

  /**
   * @param {Request} request
   * @param {string} action
   */
  assertId: function requestAssertId (request, action) {
    if (!request.input.resource._id) {
      throw new BadRequestError(`${action} must specify an _id.`);
    }
  },

  /**
   * @param {Request} request
   * @param {string} action
   */
  assertIndex: function requestAssertIndex (request, action) {
    if (!request.input.resource.index) {
      throw new BadRequestError(`${action} must specify an index.`);
    }
  },

  /**
   * @param {Request} request
   * @param {string} action
   */
  assertIndexAndCollection: function requestAssertIndexAndCollection (request, action) {
    if (!request.input.resource.index) {
      throw new BadRequestError(`${action} must specify an index.`);
    }
    if (!request.input.resource.collection) {
      throw new BadRequestError(`${action} must specify a collection.`);
    }
  }
};