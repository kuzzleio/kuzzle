const
  {
    defineSupportCode
  } = require('cucumber'),
  stepUtils = require('../support/stepUtils');

defineSupportCode(function ({When, Then}) {
  When(/^I list "([^"]*)" data collections(?: in index "([^"]*)")?$/, function (type, index, callback) {
    this.api.listCollections(index, type)
      .then(response => {
        if (response.error) {
          callback(new Error(response.error.message));
          return false;
        }

        if (!response.result) {
          return callback(new Error('No result provided'));
        }

        this.result = response.result;
        callback();
      })
      .catch(error => callback(error));
  });

  Then(/^I can ?(not)* find a ?(.*?) collection ?(.*)$/, function (not, type, collection, callback) {
    if (!this.result.collections) {
      return callback('Expected a collections list result, got: ' + this.result);
    }

    if (!collection) {
      if (this.result.collections.length === 0) {
        if (not) {
          return callback();
        }

        return callback('Collection list is empty, expected collections to be listed');
      }
    }

    if (this.result.collections.filter(item => item.type === type && item.name === collection).length !== 0) {
      if (not) {
        return callback('Expected collection ' + collection + ' not to appear in the collection list');
      }

      return callback();
    }

    callback('Expected to find the collection <' + collection + '> in this collections list: ' + JSON.stringify(this.result.collections));
  });

  Then(/^I change the mapping(?: in index "([^"]*)")?$/, function (index, callback) {
    this.api.updateMapping()
      .then(body => {
        if (body.error !== null) {
          callback(new Error(body.error.message));
          return false;
        }

        callback();
      })
      .catch(function (error) {
        callback(new Error(error));
      });
  });

  Then(/^I truncate the collection(?: "(.*?)")?(?: in index "([^"]*)")?$/, function (collection, index, callback) {
    this.api.truncateCollection(index, collection)
      .then(body => {
        if (body.error !== null) {
          return callback(body.error);
        }

        callback();
      })
      .catch(error => callback(error));
  });

  When(/^I check if index "(.*?)" exists$/, function (index, cb) {
    return stepUtils.getReturn.call(this, 'indexExists', index, cb);
  });

  When(/I check if collection "(.*?)" exists on index "(.*?)"$/, function (collection, index, cb) {
    return stepUtils.getReturn.call(this, 'collectionExists', index, collection, cb);
  });
});

