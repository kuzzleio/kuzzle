var BadRequestError = require('kuzzle-common-objects').errors.BadRequestError;

module.exports = {
  /**
   * @param {Request} request
   * @param {string} action
   */
  assertHadBody: function requestassertHadBody (request, action) {
    if (!request.input.body) {
      throw new BadRequestError(`${action} must specify a body.`);
    }
  },

  /**
   * @param {Request} request
   * @param {string} attribute
   * @param {string} action
   */
  assertBodyHasAttribute: function requestassertBodyHasAttribute (request, attribute, action) {
    if (!request.input.body.hasOwnProperty(attribute)) {
      throw new BadRequestError(`${action} must specify a body attribute "${attribute}".`);
    }
  },

  /**
   * @param {Request} request
   * @param {string} attribute
   * @param {string} action
   */
  assertBodyHasNotAttribute: function requestassertBodyHasAttribute (request, attribute, action) {
    if (request.input.body[attribute]) {
      throw new BadRequestError(`${action} must not specify the body attribute "${attribute}".`);
    }
  },

  /**
   * @param {Request} request
   * @param {string} action
   */
  assertHasId: function requestassertHasId (request, action) {
    if (!request.input.resource._id) {
      throw new BadRequestError(`${action} must specify an _id.`);
    }
  },

  /**
   * @param {Request} request
   * @param {string} action
   */
  assertHasIndex: function requestassertHasIndex (request, action) {
    if (!request.input.resource.index) {
      throw new BadRequestError(`${action} must specify an index.`);
    }
  },

  /**
   * @param {Request} request
   * @param {string} action
   */
  assertHasIndexAndCollection: function requestassertHasIndexAndCollection (request, action) {
    if (!request.input.resource.index) {
      throw new BadRequestError(`${action} must specify an index.`);
    }
    if (!request.input.resource.collection) {
      throw new BadRequestError(`${action} must specify a collection.`);
    }
  }
};