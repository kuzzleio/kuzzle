const Request = require('kuzzle-common-objects').Request;

module.exports = {
  /**
   * @param {Request} request
   * @returns {string}
   */
  getRequestRoute(request) {
    return request instanceof Request ? `${request.input.controller}:${request.input.action}` : '';
  }
};