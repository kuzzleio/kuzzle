'use strict';

const
  should = require('should'),
  {
    Then,
    When
  } = require('cucumber'),
  async = require('async');

Then(/^I can retrieve actions from bulk import$/, function (callback) {
  var main = function (callbackAsync) {
    setTimeout(() => {
      // execute in parallel both tests: test if create/update work well and test if delete works well
      async.parallelLimit({
        testUpdate: callbackAsyncParallel => {
          this.api.get('1')
            .then(body => {
              if (body.error !== null) {
                callbackAsyncParallel(body.error.message);
                return false;
              }

              if (body.result && body.result._source && body.result._source.title === 'foobar') {
                callbackAsyncParallel();
                return false;
              }

              callbackAsyncParallel('Document was not updated or created successfully in bulk import');
            })
            .catch(function (error) {
              callbackAsyncParallel(error);
            });
        },
        testDelete: callbackAsyncParallel => {
          this.api.get('2')
            .then((body) => {
              if (body.error !== null) {
                callbackAsyncParallel();
                return false;
              }

              if (body.result && body.result._source) {
                callbackAsyncParallel('Document still exists');
                return false;
              }

              callback();
            })
            .catch(function () {
              callbackAsyncParallel();
            });
        }
      }, 1, function (error) {
        // Only when we have response from async.parallelLimit we can stop retry by calling callbackAsync
        if (error) {
          callbackAsync(error);
          return false;
        }

        callbackAsync();
      }); // end async.parallel
    }, 20); // end setTimeout
  }; // end method main

  async.retry(20, main.bind(this), function (err) {
    if (err) {
      if (err.message) {
        err = err.message;
      }

      callback(new Error(err));
      return false;
    }

    callback();
  });
});

When(/^I ?(can't)* do a bulk import(?: from index "([^"]*)")?$/, function (not, index, callback) {
  this.api.bulkImport(this.bulk, index)
    .then(body => {
      if (body.error !== null) {
        if (not) {
          callback();
          return;
        }
        callback(new Error(body.error.message));
        return false;
      }

      if (not) {
        callback(new Error('User can do a bulk import on a restricted index'));
        return false;
      }
      callback();
    })
    .catch(function (error) {
      if (not) {
        callback();
        return;
      }
      callback(error);
    });
});

When(/^I do a global bulk import$/, function (callback) {
  this.api.globalBulkImport(this.globalBulk)
    .then(body => {
      if (body.error !== null) {
        callback(new Error(body.error.message));
        return false;
      }

      callback();
    })
    .catch(function (error) {
      callback(error);
    });
});

When('I use bulk:mWrite action with', function (bodyRaw) {
  const body = JSON.parse(bodyRaw);

  return this.api.bulkMWrite(this.index, this.collection, body);
});

When('I use bulk:write action with {string}', function (bodyRaw) {
  const body = JSON.parse(bodyRaw);

  return this.api.bulkWrite(this.index, this.collection, body);
});

When('I use bulk:write action with id {string} and content {string}', function (id, bodyRaw) {
  const body = JSON.parse(bodyRaw);

  return this.api.bulkWrite(this.index, this.collection, body, id);
});

Then('The documents does not have kuzzle metadata', function () {
  return this.api.search({}, this.index, this.collection, { size: 100 })
    .then(({ result }) => {
      for (const hit of result.hits) {
        should(hit._source._kuzzle_info).be.undefined();
      }
    });
});

Then('The documents have the following kuzzle metadata {string}', function (metadatRaw) {
  const metadata = JSON.parse(metadatRaw);

  return this.api.search({}, this.index, this.collection, { size: 100 })
    .then(({ result }) => {
      for (const hit of result.hits) {
        should(hit._source._kuzzle_info).match(metadata);
      }
    });
});

Then('I can found a document {string}', function (documentId) {
  return this.api.get(documentId, this.index, this.collection);
});
