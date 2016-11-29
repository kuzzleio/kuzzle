'use strict';

const Request = require('kuzzle-common-objects').Request;

/**
 * Object returned by routePart.getHandler(),
 * containing the information gathered about
 * a requested route and the corresponding handler
 * to invoke
 * @constructor
 *
 * @param {string} url - parsed URL
 * @param {string} requestId
 * @param {Object} query - HTTP request query parameters
 * @param {Object} headers
 */
function RouteHandler(url, query, requestId, headers) {
  this.handler = null;
  this.url = url;
  this.base = {requestId, headers};
  this.query = query;
  this.args = {};

  Object.defineProperty(this, 'request', {
    writable: true,
    value: null
  });

  return this;
}

/**
 * Add a parametric argument to the request object
 * @param {string} name
 * @param {string} value
 */
RouteHandler.prototype.addArgument = function addArgument (name, value) {
  this.args[name] = value;
};

/**
 * Parse a string content and adds it to the right request object place
 *
 * @throws
 * @param {string} content
 */
RouteHandler.prototype.addContent = function addContent (content) {
  let pojo = JSON.parse(content);

  Object.assign(pojo.body ? this.getRequest().data : this.getRequest().data.body, pojo);
};

/**
 * Builds the request object and returns it
 *
 * @return {Request}
 */
RouteHandler.prototype.getRequest = function getRequest () {
  if (this.request !== null) {
    return this.request;
  }

  /*
   Do not duplicate those informations to the data.body part of the request object
   */
  ['index', 'collection'].forEach(attr => {
    if (this.args[attr]) {
      this.base[attr] = this.args[attr];
      delete this.args[attr];
    }
  });

  // TODO refactor
  this.request = new Request(this.base, this.args, 'rest');
  Object.assign(this.request.input.body, this.query);

  return this.request;
};

/**
 * Invokes the registered handler
 *
 * @param {Function} callback
 */
RouteHandler.prototype.invokeHandler = function callHandler (callback) {
  this.handler(this.getRequest(), callback);
};

/**
 * @type {RouteHandler}
 */
module.exports = RouteHandler;
