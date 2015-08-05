var
  stringify = require('json-stable-stringify'),
  uuid = require('node-uuid'),
  q = require('q'),
  _ = require('lodash'),
  async = require('async'),
  crypto = require('crypto');

function RequestObject(object, additionnalData, protocol) {

  this.data = {};
  this.protocol = null;
  this.controller = null;
  this.collection = null;
  this.action = null;
  this.persist = true;
  this.requestId = null;
  this.writeResponseRoom = null;

  this.prefixWriteResponseRoom = 'write_response_';

  construct.call(this, object, additionnalData, protocol);
}


function construct (object, additionalData, protocol) {

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
  else if (object.query !== undefined) {
    this.data = object;
  }
  else if (additionalData.query !== undefined) {
    this.data = additionalData;
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

  // Add a internal private room name for identify when we get the response
  this.writeResponseRoom = this.prefixWriteResponseRoom + uuid.v1();

  // add protocol into requestObject: rest, ws or mq
  this.protocol = protocol;


  // The request Id is optional, but we have to generate it if the user
  // not provide it. We need to return this id for let the user know
  // how to get real time information about his data
  if (!object.requestId) {
    var stringifyObject = stringify(this);
    this.requestId = crypto.createHash('md5').update(stringifyObject).digest('hex');
  }
  else {
    this.requestId = object.requestId;
  }

  return object;
}

RequestObject.prototype.checkInformation = function () {
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

RequestObject.prototype.isValid = function () {
  var deferred = q.defer();

  // TODO: implement validation
  if (this.data.body === undefined || _.isEmpty(this.data.body)) {
    deferred.reject('The body can\'t be empty');
    return deferred.promise;
  }

  deferred.resolve();
  return deferred.promise;
};

RequestObject.prototype.isPersistent = function () {
  return this.persist;
};

RequestObject.prototype.waitForWriteEngine = function () {
  return ['write', 'admin', 'bulk'].indexOf(this.controller) !== -1 && this.isPersistent();
};

module.exports = RequestObject;