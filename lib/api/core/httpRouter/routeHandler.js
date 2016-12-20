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
 * @param {object} query - HTTP request query parameters
 * @param {object} headers
 */
function RouteHandler(url, query, requestId, headers) {
  this.handler = null;
  this.url = url;
  this.data = {requestId};
  this.request = null;

  Object.keys(headers).forEach(k => {
    if (k.toLowerCase() !== 'authorization') {
      this.data[k] = headers[k];
    }
    else if (headers[k].startsWith('Bearer ')) {
      this.data.jwt = headers[k].substring('Bearer '.length);
    }
  });

  Object.assign(this.data, query);

  return this;
}

/**
 * Add a parametric argument to the request object
 * @param {string} name
 * @param {string} value
 */
RouteHandler.prototype.addArgument = function addArgument (name, value) {
  this.data[name] = value;
};

/**
 * Parse a string content and adds it to the right request object place
 *
 * @throws
 * @param {string} content
 */
RouteHandler.prototype.addContent = function addContent (content) {
  this.getRequest().input.body = JSON.parse(content);
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

  this.request = new Request(this.data);

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
