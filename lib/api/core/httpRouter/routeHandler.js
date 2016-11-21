'use strict';

const RequestObject = require('kuzzle-common-objects').Models.requestObject;

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

  Object.defineProperty(this, 'requestObject', {
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

  Object.assign(pojo.body ? this.getRequestObject().data : this.getRequestObject().data.body, pojo);
};

/**
 * Builds the request object and returns it
 *
 * @return {RequestObject}
 */
RouteHandler.prototype.getRequestObject = function getRequestObject () {
  if (this.requestObject !== null) {
    return this.requestObject;
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

  this.requestObject = new RequestObject(this.base, this.args, 'rest');
  Object.assign(this.requestObject.data.body, this.query);

  return this.requestObject;
};

/**
 * Invokes the registered handler
 *
 * @param {Function} callback
 */
RouteHandler.prototype.invokeHandler = function callHandler (callback) {
  this.handler(this.getRequestObject(), callback);
};

/**
 * @type {RouteHandler}
 */
module.exports = RouteHandler;
