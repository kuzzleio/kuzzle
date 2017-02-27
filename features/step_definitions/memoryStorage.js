'use strict';

const
  Promise = require('bluebird'),
  should = require('should');

module.exports = function () {
  this.When(/^I call the (.*?) method of the memory storage with arguments$/, function (command, args) {
    let realArgs = args ? JSON.parse(args.replace(/#prefix#/g, this.idPrefix)) : args;

    return this.api.callMemoryStorage(command, realArgs)
      .then(response => {
        if (response.error) {
          return Promise.reject(response.error);
        }

        this.memoryStorageResult = response;

        return response;
      });
  });

  this.When(/^I scan the database using the (.+?) method$/, function (command) {
    let realArgs = args ? JSON.parse(args.replace(/#prefix#/g, this.idPrefix)) : args;

    this.memoryStorageResult = null;

    return scanRedis(this.api.callMemoryStorage, this.idPrefix, command, 0);
  });

  this.Then(/^The (sorted )?ms result should match the (regex|json) (.*?)$/, function (sorted, type, pattern, callback) {
    let
      regex,
      val = this.memoryStorageResult.result;

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
        return callback(new Error('Error: ' + JSON.stringify(val) + ' does not match ' + pattern));
      }
    }
  });
};


/**
 * Executes on of the *scan family command, recursively, until
 * the scan completes
 *
 * @param {function} apiExecute - function to call to execute the scan
 * @param {string} prefix - functional tests keys prefix
 * @param {string} command - name of the scan command (scan, hscan, sscan, zscan)
 * @param {number} cursor - scan's cursor position
 */
function scanRedis (apiExecute, prefix, command, cursor) {
  return apiExecute(command, {cursor, match: `${prefix}*`})
    .then(response => {
      if (response.error) {
        return Promise.reject(response.error);
      }

      if (this.memoryStorageResult === null) {
        this.memoryStorageResult = response;
      }
      else {
        this.memoryStorageResult.result.push(...response.result.slice(1));
      }

      return response.result[0] === 0 ? response : scanRedis(apiExecute, prefix, command, response.result[0]);
    });
}