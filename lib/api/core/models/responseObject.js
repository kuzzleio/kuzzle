var
  _ = require('lodash'),
  util = require('util'),
  InternalError = require('../errors/internalError');

function ResponseObject (requestObject, response) {
  this.data = null;
  this.metadata = null;
  this.protocol = null;
  this.action = null;
  this.collection = null;
  this.index = null;
  this.controller = null;
  this.requestId = null;
  this.error = null;
  this.timestamp = null;
  this.status = null;
  this.state = null;
  this.scope = null;

  construct.call(this, requestObject, response);
}

/**
 * Format a response and add data from requestObject
 * @param {RequestObject} requestObject
 * @param {Object} response
 * @returns {Object}
 */
function construct (requestObject, response) {
  response = response || {};

  if (response.status) {
    this.status = response.status;
  } else if (util.isError(response)) {
    response = new InternalError(response);
    this.status = 500;
  } else {
    this.status = 200;
  }

  if (response.action && response.controller) {
    Object.keys(response).forEach(attr => this[attr] = response[attr]);
    return this;
  }
  else if (util.isError(response)) {
    this.error = formatError.call(this, requestObject, response);
  }

  this.protocol = requestObject.protocol;
  this.action = requestObject.action;
  this.collection = requestObject.collection;
  this.index = requestObject.index;
  this.controller = requestObject.controller;
  this.requestId = requestObject.requestId;
  this.timestamp = requestObject.timestamp;
  this.metadata = requestObject.metadata;
  this.state = requestObject.state || 'done';

  // The real document content is past in 'body' attribute in order to be iso with RequestObject for dsl.testFilters function,
  // that will loop on all body attributes
  this.data = {
    body: !util.isError(response) ? response : null
  };
}

/**
 * Format an error data
 * @param {RequestObject} requestObject
 * @param {Object} error Object
 * @returns {Object}
 */
function formatError(requestObject, error) {
  var response = {
    message: 'Internal error',
    count: 1,
    stack: '',
    _source: null
  };

  error = error || {};

  if (error.message) {
    response.message = error.message;
  }
  if (error.count) {
    response.count = error.count;
  }
  if (error.status === 500) {
    if (error.stack) {
      response.stack = error.stack;
    }
    else if (error.body) {
      response.stack = error.body;
    } else {
      response.stack = error;
    }
  }
  if (error.errors) {
    response.errors = error.errors;
  }

  if (error.details) {
    response.details = error.details;
  }

  // If there is an error, we want to return the content
  // and let the user see which request produce the error
  if (requestObject.data && requestObject.data.body) {
    response._source = requestObject.data.body;
  }

  return response;
}

/**
 * Construct an object that will be return to the client
 * The parameter blackList allow to exclude attributes from response
 * @param {Array?} blackList
 * @returns {Object} object sent to client
 */
ResponseObject.prototype.toJson = function (blackList) {
  var
    result = {};

  blackList = blackList || [];

  if (!this.data || !this.data.body) {
    return {
      status: this.status,
      error: this.error,
      requestId: this.requestId,
      controller: this.controller,
      action: this.action,
      collection: this.collection,
      index: this.index,
      metadata: this.metadata,
      state: this.state,
      result: null
    };
  }

  Object.keys(this.data.body).forEach(attr => {
    if (!blackList.length || _.indexOf(blackList,attr) === -1) {
      result[attr] = this.data.body[attr];
    }
  });

  return {
    status: this.status,
    error: this.error,
    requestId: this.requestId,
    controller: this.controller,
    action: this.action,
    collection: this.collection,
    index: this.index,
    metadata: this.metadata,
    state: this.state,
    scope: this.scope,
    result: result
  };
};

/**
 * Construct an object ResponseObject from a serializedObject
 * @param {Object} serializedObject
 * @returns {ResponseObject}
 */
ResponseObject.prototype.unserialize = function (serializedObject) {
  return new ResponseObject({}, serializedObject);
};

module.exports = ResponseObject;
