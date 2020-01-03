'use strict';

const
  {
    Then
  } = require('cucumber'),
  _ = require('lodash'),
  should = require('should');

Then(/^The (sorted )?result should match the (regex|json) (.*?)$/, function (sorted, type, pattern, callback) {
  let
    regex,
    val = this.result.result;

  if (sorted && Array.isArray(val)) {
    val = val.sort();
  }

  if (type === 'regex') {
    regex = new RegExp(pattern.replace(/#prefix#/g, this.idPrefix));
    if (regex.test(val.toString())) {
      callback();
    }
    else {
      callback(new Error('pattern mismatch: \n' + JSON.stringify(val) + '\n does not match \n' + regex));
    }
  }

  if (type === 'json') {
    pattern = pattern.replace(/#prefix#/g, this.idPrefix);

    try {
      should(JSON.parse(pattern)).be.eql(val);
      callback();
    }
    catch(err) {
      if (err instanceof should.AssertionError) {
        return callback(new Error(JSON.stringify(val) + ' does not match ' + pattern));
      }

      return callback(err);
    }
  }
});

Then('The result should raise an error with message {string}', function (message, callback) {
  const
    val = _.get(this.result, 'error.error') || this.result.error;

  try {
    should(val.message).be.eql(message);
    callback();
  }
  catch(err) {
    if (err instanceof should.AssertionError) {
      return callback(new Error(`"${val.message}" does not match "${message}"`));
    }

    return callback(err);
  }
});

Then(/^The mapping should contain a nested "(.*?)" field with property "(.*?)" of type "(.*?)"$/, function (field, prop, type, callback) {
  if (! this.result[field]) {
    return callback(new Error('Field ' + field + ' not found in mapping'));
  }
  if (! this.result[field].properties) {
    return callback(new Error('No properties found for field ' + field));
  }
  if (! this.result[field].properties[prop]) {
    return callback(new Error(field + '.' + prop + ' not found in mapping'));
  }
  if (! this.result[field].properties[prop].type) {
    return callback(new Error('No type found for field ' + field + '.' + prop));
  }
  if (this.result[field].properties[prop].type !== type) {
    return callback(new Error('Bad type for field ' + field + '.' + prop + ':\nExpected: ' + type + '\nActual: ' + this.result[field].type));
  }
  callback();
});

Then(/^The mapping should contain "(.*?)" field of type "(.*?)"$/, function (field, type, callback) {
  if (! this.result[field]) {
    return callback(new Error('Field ' + field + ' not found in mapping'));
  }
  if (! this.result[field].type) {
    return callback(new Error('No type found for field ' + field));
  }
  if (this.result[field].type !== type) {
    return callback(new Error('Bad type for field ' + field + ':\nExpected: ' + type + '\nActual: ' + this.result[field].type));
  }
  callback();
});
