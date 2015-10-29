var
  BadRequestError = require('../errors/badRequestError'),
  stringify = require('json-stable-stringify'),
  uuid = require('node-uuid'),
  q = require('q'),
  _ = require('lodash'),
  async = require('async'),
  crypto = require('crypto');

function RequestObject(object, additionalData, protocol) {

  this.data = {};
  this.protocol = null;
  this.controller = null;
  this.collection = null;
  this.action = null;
  this.persist = true;
  this.requestId = null;
  this.timestamp = null;

  construct.call(this, object, additionalData, protocol);
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

  // add protocol into requestObject: rest, ws or mq
  this.protocol = protocol;

  // add the creation date (can be used for 'created at' or 'update at')
  this.timestamp = (new Date().getTime());

  // The request Id is optional, but we have to generate it if the user
  // not provide it. We need to return this id for let the user know
  // how to get real time information about his data
  if (!object.requestId) {
    if (this.controller === 'subscribe') {
      this.requestId = crypto.createHash('md5').update(stringify(this)).digest('hex');
    }
    else {
      this.requestId = uuid.v1();
    }
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
        callback(new BadRequestError('No controller provided for object'));
        return false;
      }

      callback(false);
    }.bind(this),

    // Test if the action is well defined
    function (callback) {
      if (!this.action) {
        callback(new BadRequestError('No action provided for object'));
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
  });

  return deferred.promise;
};

RequestObject.prototype.isValid = function () {
  var deferred = q.defer();

  // TODO: implement validation
  if (this.data.body === undefined || _.isEmpty(this.data.body)) {
    deferred.reject(new BadRequestError('The body can\'t be empty'));
    return deferred.promise;
  }

  deferred.resolve();
  return deferred.promise;
};

RequestObject.prototype.isPersistent = function () {
  var persistType = typeof this.persist;

  if (persistType === 'string') {
    return this.persist === 'true';
  }
  else if (persistType === 'boolean') {
    return this.persist;
  }

  return false;
};

module.exports = RequestObject;
