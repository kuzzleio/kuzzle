var
  stringify = require('json-stable-stringify'),
  uuid = require('node-uuid'),
  q = require('q'),
  _ = require('lodash'),
  async = require('async'),
  crypto = require('crypto');

module.exports = RequestObject = function RequestObject(object, additionnalData) {

  this.data = {};
  this.controller = null;
  this.collection = null;
  this.action = null;
  this.persist = true;
  this.requestId = null;
  this.writeResponseRoom = null;

  this.prefixWriteResponseRoom = 'write_response_';

  this.checkInformation = function () {
    var deferred = q.defer();

    async.parallel([
        // Test if the controller is well defined
        function (callback) {
          if (!this.controller) {
            callback('No controller provided for object');
            return false;
          }

          callback(false);
        }.bind(this),

        // Test if the action is well defined
        function (callback) {
          if (!this.action) {
            callback('No action provided for object');
            return false;
          }

          callback(null);
        }.bind(this)
      ], function onTestError (err) {
        if (err) {
          deferred.reject(err);
          return false;
        }

        deferred.resolve();
      }
    );

    return deferred.promise;
  };

  this.isPersistent = function () {
    return this.persist;
  };

  this.isValid = function () {
    var deferred = q.defer();

    // TODO: implement validation
    if (this.data.body === undefined || _.isEmpty(this.data.body)) {
      deferred.reject('The body can\'t be empty');
      return deferred.promise;
    }

    deferred.resolve();
    return deferred.promise;
  };

  construct.call(this, object, additionnalData);
};


function construct (object, additionalData) {

  if (!additionalData) {
    additionalData = {};
  }

  this.action = object.action || additionalData.action;
  this.controller = object.controller || additionalData.controller;
  this.collection = object.collection || additionalData.collection;

  // the user can define the _id either in body or directly in object
  if (object.body && object.body._id !== undefined) {
    this.data._id = object.body._id;
  }

  if (object._id) {
    this.data._id = object._id;
  }

  if (object.body !== undefined) {
    this.data.body = object.body;
  }
  else {
    this.data.body = additionalData.body || additionalData;
  }

  if (additionalData.persist !== undefined) {
    this.persist = additionalData.persist;
  }
  else if (object.persist !== undefined) {
    this.persist = object.persist;
  }
  else {
    this.persist = true;
  }

  // The request Id is optional, but we have to generate it if the user
  // not provide it. We need to return this id for let the user know
  // how to get real time information about his data
  if (!object.requestId) {
    var stringifyObject = stringify(object);
    this.requestId = crypto.createHash('md5').update(stringifyObject).digest('hex');
  }
  else {
    this.requestId = object.requestId;
  }

  // Add a internal private room name for identify when we get the response
  this.writeResponseRoom = this.prefixWriteResponseRoom + uuid.v1();

  return object;
}
