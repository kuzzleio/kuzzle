var
  _ = require('lodash'),
  util = require('util');

function ResponseObject (requestObject, response) {

  this.data = null;
  this.protocol = null;
  this.action = null;
  this.collection = null;
  this.controller = null;
  this.requestId = null;
  this.writeResponseRoom = null;
  this.error = null;

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

  if (response.action && response.controller) {
    Object.keys(response).forEach(function (attr) {
      this[attr] = response[attr];
    }.bind(this));

    return this;
  }
  else if (util.isError(response)) {
    this.error = response.message;
  }

  this.protocol = requestObject.protocol;
  this.action = requestObject.action;
  this.collection = requestObject.collection;
  this.controller = requestObject.controller;
  this.writeResponseRoom = requestObject.writeResponseRoom;
  this.requestId = requestObject.requestId;

  // TODO: check if the  user want also data from requestObject or just response from Elasticsearch
  this.data = _.extend(requestObject.data, response);
}

/**
 * Construct an object that will be return to the client
 * The parameter blackList allow to exclude attributes from response
 * @param {Array?} blackList
 * @returns {Object} object sent to client
 */
ResponseObject.prototype.toJson = function (blackList) {
  var
    formattedData = {};

  blackList = blackList || [];

  if (!this.data) {
    return {
      error: this.error,
      result: null
    };
  }

  Object.keys(this.data).forEach(function (attr) {
    if (blackList.indexOf(attr) === -1) {
      formattedData[attr] = this.data[attr];
    }
  }.bind(this));

  formattedData.requestId = this.requestId;
  formattedData.controller = this.controller;
  formattedData.action = this.action;
  formattedData.collection = this.collection;

  formattedData._source = formattedData._source || formattedData.body;
  delete formattedData.body;

  return {
    error: this.error,
    result: formattedData
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

ResponseObject.prototype.addBody = function () {
  if (this.data._source) {
    this.data.body = this.data._source;
  }
};

module.exports = ResponseObject;